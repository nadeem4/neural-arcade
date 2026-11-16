// Usage: node scripts/city/convert.js <config.json> <out.json> [overpass.json]
//   e.g. node scripts/city/convert.js scripts/city/chicago.config.json games/city/chicago.json
// Turns an Overpass export into the City: a coarse learning grid plus vector geometry for the 3D view.
// The input (default scripts/city/data/chicago-overpass.json) is git-ignored; it is produced by
// `node scripts/city/fetch-overpass.mjs` (the query and fetch date are recorded in that script's header).
//
// Output coordinates are metres east/north of the bbox south-west corner, rounded to 0.1.
// Grid: cell (col, row) has its centre at x = (col + 0.5) * cellM, y = (rows - 1 - row + 0.5) * cellM,
// so row 0 is the north edge (north = row - 1, as the sim expects).
// Cell kinds, highest priority first: b building, w water, x fence, r road, f footpath/plaza, p park.
// Ground that no feature covers is 'f' (open pavement: drivable, but fined like a footpath).
// Lines (roads, paths, fences) are rasterised at least MIN_HALF_CELLS * cellM either side of the line,
// so a street is never thinner than a cell and stays connected on a four-move grid.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const EARTH_R = 6371000;
const DEFAULT_HEIGHT = 12; // metres, when a building has no height or levels
const LEVEL_HEIGHT = 3.5; // metres per building:levels
const LANE_WIDTH = 3.5; // metres per lane, when the way has a lanes tag
const MIN_HALF_CELLS = 0.75;

// Road width in metres by highway class (a "_link" suffix is stripped first).
const ROAD_WIDTH = {
  motorway: 20, trunk: 16, primary: 14, secondary: 12, tertiary: 10,
  unclassified: 8, residential: 8, living_street: 6, service: 5,
};
const PATH_WIDTH = { footway: 2, pedestrian: 6, path: 2, steps: 2 };

const round1 = (v) => Math.round(v * 10) / 10;

// Equirectangular projection about the bbox centre, origin at the south-west corner.
export function project(lat, lon, bbox) {
  const [south, west, north] = bbox;
  const rad = Math.PI / 180;
  const cosC = Math.cos(((south + north) / 2) * rad);
  return [round1((lon - west) * rad * EARTH_R * cosC), round1((lat - south) * rad * EARTH_R)];
}

function distToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function pointInRing(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const cellCentre = (c, r, rows, cellM) => [(c + 0.5) * cellM, (rows - 1 - r + 0.5) * cellM];

// Calls fn(col, row, cx, cy) for every cell whose centre may lie within pad of the box a..b.
function eachCellNear(a, b, pad, cols, rows, cellM, fn) {
  const c0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - pad) / cellM) - 1);
  const c1 = Math.min(cols - 1, Math.ceil((Math.max(a[0], b[0]) + pad) / cellM) + 1);
  const r0 = Math.max(0, rows - 2 - Math.ceil((Math.max(a[1], b[1]) + pad) / cellM));
  const r1 = Math.min(rows - 1, rows - Math.floor((Math.min(a[1], b[1]) - pad) / cellM));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const [cx, cy] = cellCentre(c, r, rows, cellM);
      fn(c, r, cx, cy);
    }
  }
}

const halfWidth = (w, cellM) => Math.max(w / 2, MIN_HALF_CELLS * cellM);
const FENCE_HALF_CELLS = 0.5; // fences are thin: about the cells the line passes through

// features: { parks, plazas, buildings, water: rings; paths, roads: {pts, w}; fences: {pts} } (all optional).
// Returns one string per row, one char per cell, by cell-centre sampling in priority order.
export function rasterise(features, cols, rows, cellM) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill('f'));
  const paintArea = (ch, ring) => {
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    const lo = [Math.min(...xs), Math.min(...ys)];
    const hi = [Math.max(...xs), Math.max(...ys)];
    eachCellNear(lo, hi, 0, cols, rows, cellM, (c, r, cx, cy) => {
      if (pointInRing(cx, cy, ring)) grid[r][c] = ch;
    });
  };
  const paintLine = (ch, pts, half) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      eachCellNear(pts[i], pts[i + 1], half, cols, rows, cellM, (c, r, cx, cy) => {
        if (distToSegment(cx, cy, pts[i], pts[i + 1]) <= half) grid[r][c] = ch;
      });
    }
  };
  for (const ring of features.parks ?? []) paintArea('p', ring);
  for (const ring of features.plazas ?? []) paintArea('f', ring);
  for (const p of features.paths ?? []) paintLine('f', p.pts, halfWidth(p.w, cellM));
  for (const p of features.roads ?? []) paintLine('r', p.pts, halfWidth(p.w, cellM));
  for (const p of features.fences ?? []) paintLine('x', p.pts, FENCE_HALF_CELLS * cellM);
  for (const ring of features.water ?? []) paintArea('w', ring);
  for (const ring of features.buildings ?? []) paintArea('b', ring);
  return grid.map((row) => row.join(''));
}

// One-way direction ('N','E','S','W' or '.') per cell; only road cells carry one.
// A one-way street wins over a crossing two-way street; the nearest one-way segment decides.
function onewayRows(roads, kind, cols, rows, cellM) {
  const out = Array.from({ length: rows }, () => Array(cols).fill('.'));
  const best = Array.from({ length: rows }, () => Array(cols).fill(Infinity));
  for (const road of roads) {
    if (road.oneway === 0) continue;
    const half = halfWidth(road.w, cellM);
    for (let i = 0; i + 1 < road.pts.length; i++) {
      const [a, b] = [road.pts[i], road.pts[i + 1]];
      const dx = (b[0] - a[0]) * road.oneway;
      const dy = (b[1] - a[1]) * road.oneway;
      const dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : dy > 0 ? 'N' : 'S';
      eachCellNear(a, b, half, cols, rows, cellM, (c, r, cx, cy) => {
        if (kind[r][c] !== 'r') return;
        const d = distToSegment(cx, cy, a, b);
        if (d <= half && d < best[r][c]) {
          best[r][c] = d;
          out[r][c] = dir;
        }
      });
    }
  }
  return out.map((row) => row.join(''));
}

function buildingHeight(tags) {
  const h = parseFloat(tags.height);
  if (h > 0) return round1(h);
  const levels = parseFloat(tags['building:levels']);
  if (levels > 0) return round1(levels * LEVEL_HEIGHT);
  return DEFAULT_HEIGHT;
}

function roadWidth(tags, cls) {
  const lanes = parseInt(tags.lanes, 10);
  return lanes > 0 ? lanes * LANE_WIDTH : ROAD_WIDTH[cls];
}

// Only street level is mapped: tunnels, negative layers and indoor ways are skipped (bridges stay).
function underground(tags) {
  return (tags.tunnel && tags.tunnel !== 'no') || parseInt(tags.layer, 10) < 0 || !!tags.indoor;
}

function oneWayOf(tags) {
  if (tags.oneway === '-1') return -1;
  return ['yes', 'true', '1'].includes(tags.oneway) ? 1 : 0;
}

const lineLength = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
const ringArea = (ring) =>
  Math.abs(ring.reduce((s, p, i) => s + p[0] * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * p[1], 0)) / 2;

function closeRing(pts) {
  const first = pts[0];
  const last = pts[pts.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? pts : [...pts, first];
}

function elementLatLon(el) {
  if (el.type === 'node') return [el.lat, el.lon];
  if (el.bounds) return [(el.bounds.minlat + el.bounds.maxlat) / 2, (el.bounds.minlon + el.bounds.maxlon) / 2];
  const geom = el.geometry ?? el.members?.find((m) => m.geometry)?.geometry;
  if (!geom?.length) return null;
  return [
    geom.reduce((s, p) => s + p.lat, 0) / geom.length,
    geom.reduce((s, p) => s + p.lon, 0) / geom.length,
  ];
}

export function convert(osm, config) {
  const { bbox, cellM } = config;
  const [width, height] = project(bbox[2], bbox[3], bbox);
  const cols = Math.ceil(width / cellM);
  const rows = Math.ceil(height / cellM);
  const toPts = (geom) => geom.map((p) => project(p.lat, p.lon, bbox));
  const touchesMap = (pts) =>
    Math.max(...pts.map((p) => p[0])) >= 0 && Math.min(...pts.map((p) => p[0])) <= width &&
    Math.max(...pts.map((p) => p[1])) >= 0 && Math.min(...pts.map((p) => p[1])) <= height;
  // Rings are closed (first point repeated); anything with fewer than 3 distinct corners or off the map is dropped.
  const ringOf = (geom) => {
    const ring = closeRing(toPts(geom));
    return ring.length >= 4 && touchesMap(ring) ? ring : null;
  };
  const lineOf = (geom) => {
    const pts = toPts(geom);
    return pts.length >= 2 && touchesMap(pts) ? pts : null;
  };

  const buildings = [], roads = [], paths = [], sidewalks = [], parks = [], water = [], plazas = [], fences = [];
  const signalPts = [];
  for (const el of osm.elements) {
    const t = el.tags ?? {};
    if (el.type === 'node') {
      if (t.highway === 'traffic_signals') signalPts.push(project(el.lat, el.lon, bbox));
    } else if (el.type === 'relation') {
      if (!t.building) continue;
      for (const m of el.members ?? []) {
        if ((m.role !== 'outer' && m.role !== 'outline') || !m.geometry) continue;
        const ring = ringOf(m.geometry);
        if (ring) buildings.push({ ring, h: buildingHeight(t) });
      }
    } else if (el.geometry) {
      const hw = (t.highway ?? '').replace('_link', '');
      if (!t.building && underground(t)) continue;
      if (t.building) {
        const ring = ringOf(el.geometry);
        if (ring) buildings.push({ ring, h: buildingHeight(t) });
      } else if (ROAD_WIDTH[hw]) {
        const pts = lineOf(el.geometry);
        if (pts) roads.push({ pts, w: roadWidth(t, hw), oneway: oneWayOf(t) });
      } else if (PATH_WIDTH[hw] && t.area === 'yes') {
        const ring = ringOf(el.geometry);
        if (ring) plazas.push(ring);
      } else if (PATH_WIDTH[hw]) {
        const pts = lineOf(el.geometry);
        if (!pts) continue;
        // sidewalks and crossings shape the grid but are not emitted (keeps chicago.json small)
        if (t.footway === 'sidewalk' || t.footway === 'crossing') sidewalks.push({ pts, w: PATH_WIDTH[hw] });
        else paths.push({ pts, w: PATH_WIDTH[hw] });
      } else if (t['area:highway'] === 'footway') {
        const ring = ringOf(el.geometry);
        if (ring) plazas.push(ring);
      } else if (['park', 'garden', 'pitch'].includes(t.leisure) || t.landuse === 'grass') {
        const ring = ringOf(el.geometry);
        if (ring) parks.push(ring);
      } else if (t.natural === 'water') {
        const ring = ringOf(el.geometry);
        if (ring) water.push(ring);
      } else if (t.barrier === 'fence' || t.barrier === 'wall') {
        const pts = lineOf(el.geometry);
        if (pts) fences.push({ pts });
      }
    }
  }

  const kind = rasterise(
    { parks, plazas, paths: [...paths, ...sidewalks], roads, fences, water, buildings: buildings.map((b) => b.ring) },
    cols, rows, cellM,
  );
  const oneway = onewayRows(roads, kind, cols, rows, cellM);

  const cellOf = (x, y) => [Math.floor(x / cellM), rows - 1 - Math.floor(y / cellM)];
  const onMap = (x, y) => x >= 0 && x <= width && y >= 0 && y <= height;
  const roadCell = (label, p) => {
    const [x, y] = project(p.lat, p.lon, bbox);
    if (!onMap(x, y)) throw new Error(`${label} (${p.lat}, ${p.lon}) is outside the bbox`);
    const [c, r] = cellOf(x, y);
    if (kind[r][c] !== 'r') {
      throw new Error(`${label} cell (${c}, ${r}) is not a road cell (it is '${kind[r][c]}')`);
    }
    return [c, r];
  };
  const pickup = roadCell('pickup', config.pickup);
  const dropoff = roadCell('dropoff', config.dropoff);

  // Each signal snaps to the road cell whose centre is nearest (first in row-major order on a tie).
  const signalKeys = new Set();
  const signals = [];
  for (const [x, y] of signalPts) {
    if (!onMap(x, y)) continue;
    let best = null;
    let bestD = Infinity;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (kind[r][c] !== 'r') continue;
        const [cx, cy] = cellCentre(c, r, rows, cellM);
        const d = Math.hypot(cx - x, cy - y);
        if (d < bestD) {
          bestD = d;
          best = [c, r];
        }
      }
    }
    if (best && !signalKeys.has(best.join(','))) {
      signalKeys.add(best.join(','));
      signals.push(best);
    }
  }
  signals.sort((a, b) => a[1] - b[1] || a[0] - b[0]);

  const landmarks = [];
  for (const name of config.landmarks ?? []) {
    const el = osm.elements.find((e) => e.tags?.name === name);
    const ll = el && elementLatLon(el);
    if (!ll) continue;
    const [x, y] = project(ll[0], ll[1], bbox);
    if (onMap(x, y)) landmarks.push({ name, x, y });
  }

  // Features smaller than one cell still shaped the grid above but are not emitted (keeps chicago.json small).
  const emitPaths = paths.filter((p) => lineLength(p.pts) >= cellM);
  const emitParks = parks.filter((r) => ringArea(r) >= cellM * cellM);

  return {
    id: config.id,
    name: config.name,
    bbox,
    cellM,
    lightPeriod: config.lightPeriod,
    cols,
    rows,
    kind,
    oneway,
    signals,
    pickup,
    dropoff,
    buildings,
    roads,
    parks: emitParks,
    paths: emitPaths,
    water,
    landmarks,
    size: [width, height],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [configPath, outPath, inPath] = process.argv.slice(2);
  if (!configPath || !outPath) {
    console.error('Usage: node scripts/city/convert.js <config.json> <out.json> [overpass.json]');
    process.exit(1);
  }
  const input = inPath ?? resolve(dirname(fileURLToPath(import.meta.url)), 'data/chicago-overpass.json');
  const city = convert(JSON.parse(readFileSync(input, 'utf8')), JSON.parse(readFileSync(configPath, 'utf8')));
  mkdirSync(dirname(resolve(outPath)), { recursive: true });
  writeFileSync(outPath, JSON.stringify(city) + '\n');
  console.log(`${outPath}: ${city.cols}x${city.rows} cells, ${city.buildings.length} buildings, ${city.roads.length} roads`);
}
