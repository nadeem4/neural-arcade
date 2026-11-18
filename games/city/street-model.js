// The street surfaces, pure (no DOM, no three.js): asphalt from the OSM roads, lane marks, one-way arrows, zebra crossings and raised
// sidewalks with kerbs. Map metres in (x east, y north), typed arrays out (y up, north is -z). scene.js turns the arrays into a few merged meshes.
import { ribbon, ribbonEdges, finishFlat, cellCentre } from './geometry.js';

// Heights, named so nothing fights: ground -0.5, water 0.2, park 0.4, footpath 0.6, then these. The heat overlay sits at 1.2, above all of them.
export const Y_ROAD = 0.8, Y_MARK = 1.0, Y_CROSS = 1.05, WALK_RISE = 0.3, Y_WALK = Y_ROAD + WALK_RISE;

const LANE_W = 3.5;
const CLASS_W = { trunk: 14, primary: 14, secondary: 10.5, tertiary: 8.5, residential: 7, unclassified: 7, service: 4 };

// The drawn width: what the map says, else lanes at 3.5 m, else a default for the class.
export function roadWidth(r) {
  if (r.w > 0) return r.w;
  if (r.lanes > 0) return r.lanes * LANE_W;
  return CLASS_W[r.cls] ?? 7;
}
export const roadLanes = (r) => (r.lanes > 0 ? r.lanes : Math.max(1, Math.round(roadWidth(r) / LANE_W)));

const segDist = (px, py, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2));
  return Math.hypot(px - a[0] - dx * t, py - a[1] - dy * t);
};

// Road cells (kind 'r') whose centre no road ribbon covers. The grid is coarser than the streets, so the taxi can sit on a cell the ribbons miss;
// these get an asphalt square so it never drives on bare ground.
export function uncoveredRoadCells(city) {
  const SZ = 32, grid = new Map();
  const roads = city.roads ?? [];
  roads.forEach((r, i) => {
    const hw = roadWidth(r) / 2;
    for (let k = 0; k < r.pts.length - 1; k++) {
      const [a, b] = [r.pts[k], r.pts[k + 1]];
      for (let gx = Math.floor((Math.min(a[0], b[0]) - hw) / SZ); gx <= Math.floor((Math.max(a[0], b[0]) + hw) / SZ); gx++) {
        for (let gy = Math.floor((Math.min(a[1], b[1]) - hw) / SZ); gy <= Math.floor((Math.max(a[1], b[1]) + hw) / SZ); gy++) {
          const key = gx * 100003 + gy;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push([i, k]);
        }
      }
    }
  });
  const out = [];
  for (let r = 0; r < city.rows; r++) for (let c = 0; c < city.cols; c++) {
    if (city.kind[r][c] !== 'r') continue;
    const [x, z] = cellCentre(c, r, city), y = -z;
    let covered = false;
    for (const [i, k] of grid.get(Math.floor(x / SZ) * 100003 + Math.floor(y / SZ)) ?? []) {
      if (segDist(x, y, roads[i].pts[k], roads[i].pts[k + 1]) <= roadWidth(roads[i]) / 2) { covered = true; break; }
    }
    if (!covered) out.push([c, r]);
  }
  return out;
}

// All the asphalt: a ribbon per road and a square for each road cell the ribbons miss.
export function buildAsphalt(city, y = Y_ROAD) {
  const positions = [], indices = [];
  for (const r of city.roads ?? []) ribbon(r.pts, roadWidth(r) / 2, y, positions, indices);
  const h = city.cellM / 2;
  for (const [c, r] of uncoveredRoadCells(city)) {
    const [x, z] = cellCentre(c, r, city), base = positions.length / 3;
    positions.push(x - h, y, z - h, x + h, y, z - h, x + h, y, z + h, x - h, y, z + h);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return finishFlat(positions, indices);
}

// ---- marks ----
const STEP = 1, DASH = 3, MARK_W = 0.15, CENTRE_GAP = 0.2, ARROW_EVERY = 45, JUNCTION_PAD = 2;

// Which points of a road lie inside another road (a junction)? A road of the same name does not count, so a street split into two ways stays marked.
function junctionTest(roads) {
  const SZ = 32, grid = new Map();
  roads.forEach((r, i) => {
    const pad = roadWidth(r) / 2 + JUNCTION_PAD;
    for (let k = 0; k < r.pts.length - 1; k++) {
      const [a, b] = [r.pts[k], r.pts[k + 1]];
      for (let gx = Math.floor((Math.min(a[0], b[0]) - pad) / SZ); gx <= Math.floor((Math.max(a[0], b[0]) + pad) / SZ); gx++) {
        for (let gy = Math.floor((Math.min(a[1], b[1]) - pad) / SZ); gy <= Math.floor((Math.max(a[1], b[1]) + pad) / SZ); gy++) {
          const key = gx * 100003 + gy;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push([i, k]);
        }
      }
    }
  });
  return (x, y, self) => {
    for (const [i, k] of grid.get(Math.floor(x / SZ) * 100003 + Math.floor(y / SZ)) ?? []) {
      if (i === self) continue;
      const o = roads[i];
      if (o.name && o.name === roads[self].name) continue;
      if (segDist(x, y, o.pts[k], o.pts[k + 1]) < roadWidth(o) / 2 + JUNCTION_PAD) return true;
    }
    return false;
  };
}

// The road resampled every STEP metres: [x, y, tx, ty, arc] with the unit tangent.
function resample(pts) {
  const out = [];
  let arc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 1e-9) continue;
    const tx = (x1 - x0) / len, ty = (y1 - y0) / len;
    for (let d = 0; d < len; d += STEP) out.push([x0 + tx * d, y0 + ty * d, tx, ty, arc + d]);
    arc += len;
  }
  const last = pts[pts.length - 1], prev = out[out.length - 1];
  if (prev) out.push([last[0], last[1], prev[2], prev[3], arc]);
  return out;
}

// One arrow, as polygons in map metres: a stem and a head, pointing along (dx, dy), centred on (x, y).
export function arrowPolys(x, y, dx, dy) {
  const nx = -dy, ny = dx, at = (a, b) => [x + dx * a + nx * b, y + dy * a + ny * b];
  return [
    [at(-1.4, -0.2), at(0.4, -0.2), at(0.4, 0.2), at(-1.4, 0.2)],
    [at(0.2, -0.8), at(1.6, 0), at(0.2, 0.8)],
  ];
}

// Lane marks and one-way arrows, as two flat meshes: white (dashes between lanes, arrows) and yellow (double centre line on two-way streets).
// Nothing is drawn across a junction. Streets under 5 m wide (alleys) get none. `dashes: false` (phones) leaves the lane dashes out; `arrows: false` leaves the arrows out.
export function buildRoadMarks(roads, { dashes = true, arrows = true } = {}) {
  const wp = [], wi = [], yp = [], yi = [];
  const inJunction = junctionTest(roads);
  roads.forEach((road, ri) => {
    const w = roadWidth(road);
    if (w < 5) return;
    const lanes = roadLanes(road), laneW = w / lanes, oneway = road.oneway === 1 || road.oneway === -1;
    const s = resample(road.pts);
    if (s.length < 2) return;
    const free = s.map(([x, y]) => !inJunction(x, y, ri));
    // A line at lateral offset `off` (left of travel is positive); `dash` on/off by arc length.
    const line = (off, hw, dash, P, I) => {
      let run = [];
      const flush = () => { if (run.length > 1) ribbon(run, hw, Y_MARK, P, I); run = []; };
      s.forEach(([x, y, tx, ty, arc], i) => {
        const on = free[i] && (!dash || Math.floor(arc / DASH) % 2 === 0);
        if (on) run.push([x - ty * off, y + tx * off]); else flush();
      });
      flush();
    };
    if (!oneway && lanes >= 2) {
      line(CENTRE_GAP, MARK_W, false, yp, yi);
      line(-CENTRE_GAP, MARK_W, false, yp, yi);
    }
    if (dashes) {
      const half = oneway ? lanes : Math.floor(lanes / 2);
      for (let k = 1; k < half; k++) {
        if (oneway) line((k - lanes / 2) * laneW, MARK_W, true, wp, wi);
        else { line(k * laneW, MARK_W, true, wp, wi); line(-k * laneW, MARK_W, true, wp, wi); }
      }
    }
    if (arrows && oneway && s.length > 30) {
      const sign = road.oneway, total = s[s.length - 1][4];
      for (let a = 20; a < total - 10; a += ARROW_EVERY) {
        const i = s.findIndex((p) => p[4] >= a);
        if (i < 0) break;
        if (![i - 3, i, i + 3].every((j) => free[Math.min(s.length - 1, Math.max(0, j))])) continue;
        const [x, y, tx, ty] = s[i];
        for (let l = 0; l < lanes; l++) {
          const off = (l + 0.5 - lanes / 2) * laneW;
          for (const poly of arrowPolys(x - ty * off, y + tx * off, tx * sign, ty * sign)) {
            const base = wp.length / 3;
            for (const [px, py] of poly) wp.push(px, Y_MARK, -py);
            for (let k = 1; k < poly.length - 1; k++) wi.push(base, base + k, base + k + 1);
          }
        }
      }
    }
  });
  return { white: finishFlat(wp, wi), yellow: finishFlat(yp, yi) };
}

// Zebra crossings where the map has them: bars run along the traffic, side by side across the road.
const BAR_W = 0.6, BAR_PITCH = 1.3, BAR_LEN = 3;
export function buildCrosswalks(crossings, y = Y_CROSS) {
  const positions = [], indices = [];
  for (const { x, y: cy, angle, w } of crossings ?? []) {
    const a = (angle * Math.PI) / 180, tx = Math.sin(a), ty = Math.cos(a); // travel across the road
    const rx = -ty, ry = tx; // along the road
    const n = Math.max(1, Math.floor((w - BAR_W) / BAR_PITCH) + 1);
    for (let k = 0; k < n; k++) {
      const s = (k - (n - 1) / 2) * BAR_PITCH, c = [x + tx * s, cy + ty * s], base = positions.length / 3;
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        positions.push(c[0] + tx * u * BAR_W / 2 + rx * v * BAR_LEN / 2, y, -(c[1] + ty * u * BAR_W / 2 + ry * v * BAR_LEN / 2));
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  return finishFlat(positions, indices);
}

// Sidewalks as raised slabs: a flat top at Y_WALK and a kerb wall down to the road on each side, with normals.
export function buildRaisedWalks(walks, { rise = WALK_RISE, base = Y_ROAD } = {}) {
  const P = [], N = [], I = [];
  const top = base + rise;
  for (const { pts, w } of walks ?? []) {
    const e = ribbonEdges(pts, w / 2);
    if (!e) continue;
    const at = P.length / 3;
    for (const [lx, ly, rx, ry] of e) { P.push(lx, top, -ly, rx, top, -ry); N.push(0, 1, 0, 0, 1, 0); }
    for (let i = 0; i < e.length - 1; i++) { const l = at + i * 2; I.push(l, l + 1, l + 2, l + 1, l + 3, l + 2); }
    for (const side of [0, 1]) { // 0 = left edge, 1 = right edge; the wall faces away from the other edge
      const w0 = P.length / 3;
      e.forEach((p, i) => {
        const ex = p[side * 2], ey = p[side * 2 + 1], ox = p[(1 - side) * 2], oy = p[(1 - side) * 2 + 1];
        const l = Math.hypot(ex - ox, ey - oy) || 1;
        const n = [(ex - ox) / l, 0, -(ey - oy) / l];
        P.push(ex, base, -ey, ex, top, -ey); N.push(...n, ...n);
        if (i < e.length - 1) { const q = w0 + i * 2; I.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
      });
    }
  }
  const Pa = new Float32Array(P), Na = new Float32Array(N), Ia = new Uint32Array(I);
  for (let t = 0; t < Ia.length; t += 3) { // make every triangle's winding agree with its normal
    const [a, b, c] = [Ia[t], Ia[t + 1], Ia[t + 2]];
    const u = [0, 1, 2].map((k) => Pa[b * 3 + k] - Pa[a * 3 + k]), v = [0, 1, 2].map((k) => Pa[c * 3 + k] - Pa[a * 3 + k]);
    const d = (u[1] * v[2] - u[2] * v[1]) * Na[a * 3] + (u[2] * v[0] - u[0] * v[2]) * Na[a * 3 + 1] + (u[0] * v[1] - u[1] * v[0]) * Na[a * 3 + 2];
    if (d < 0) { Ia[t + 1] = c; Ia[t + 2] = b; }
  }
  return { positions: Pa, normals: Na, indices: Ia };
}
