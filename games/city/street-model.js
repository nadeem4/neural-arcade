// The street surfaces, pure (no DOM, no three.js): asphalt from the OSM roads, lane marks, one-way arrows, zebra crossings and raised
// sidewalks with kerbs. Map metres in (x east, y north), typed arrays out (y up, north is -z). scene.js turns the arrays into a few merged meshes.
import { ribbon, ribbonEdges, finishFlat, cellCentre } from './geometry.js';
import { ROAD_Y, MARK_Y } from './scene-math.js';

// Heights, named so nothing fights: ground -0.5, water 0.2, park 0.4, footpath 0.6, then these. The heat overlay sits at 1.2, above all of them.
export const Y_ROAD = ROAD_Y, Y_MARK = MARK_Y, Y_CROSS = 1.05, WALK_RISE = 0.3, Y_WALK = Y_ROAD + WALK_RISE;

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

const nearestOnRoads = (x, y, roads) => {
  let best = null, bd = Infinity;
  for (const r of roads) for (let k = 0; k < r.pts.length - 1; k++) {
    const [p, q] = [r.pts[k], r.pts[k + 1]], dx = q[0] - p[0], dy = q[1] - p[1], l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / l2)), px = p[0] + dx * t, py = p[1] + dy * t, d = Math.hypot(x - px, y - py);
    if (d < bd) { bd = d; best = [px, py]; }
  }
  return best;
};

// A one-lane strip for each uncovered road cell, from the nearest point on a road to a little past the cell centre. Cached per city.
const PATCH_W = 7, PATCH_OVER = 2, patchCache = new WeakMap();
export function roadPatches(city) {
  if (patchCache.has(city)) return patchCache.get(city);
  const out = [];
  for (const [c, r] of uncoveredRoadCells(city)) {
    const [cx, cz] = cellCentre(c, r, city), cy = -cz, q = nearestOnRoads(cx, cy, city.roads ?? []);
    if (!q) continue;
    const d = Math.hypot(cx - q[0], cy - q[1]) || 1;
    out.push({ pts: [q, [cx + ((cx - q[0]) / d) * PATCH_OVER, cy + ((cy - q[1]) / d) * PATCH_OVER]], w: PATCH_W });
  }
  patchCache.set(city, out);
  return out;
}

// Where two differently named roads meet or cross: { x, y, r } with r a little over the wider road's half width, so a disc of asphalt
// fills the pale gaps the two ribbons leave in a wide or skewed junction. Points within DOT_MERGE metres of each other count once.
const FILL_GROW = 1.25, FILL_TOUCH = 1, DOT_MERGE = 4;
export function junctionFills(roads) {
  const segs = [];
  roads.forEach((r, i) => { for (let k = 0; k < r.pts.length - 1; k++) segs.push({ i, a: r.pts[k], b: r.pts[k + 1], hw: roadWidth(r) / 2 }); });
  const out = [];
  for (let m = 0; m < segs.length; m++) for (let n = m + 1; n < segs.length; n++) {
    const s = segs[m], t = segs[n];
    if (s.i === t.i || (roads[s.i].name && roads[s.i].name === roads[t.i].name)) continue;
    const rx = s.b[0] - s.a[0], ry = s.b[1] - s.a[1], qx = t.b[0] - t.a[0], qy = t.b[1] - t.a[1], den = rx * qy - ry * qx;
    if (Math.abs(den) < 1e-9) continue;
    const wx = t.a[0] - s.a[0], wy = t.a[1] - s.a[1], u = (wx * qy - wy * qx) / den, v = (wx * ry - wy * rx) / den;
    const eu = FILL_TOUCH / (Math.hypot(rx, ry) || 1), ev = FILL_TOUCH / (Math.hypot(qx, qy) || 1);
    if (u < -eu || u > 1 + eu || v < -ev || v > 1 + ev) continue;
    const x = s.a[0] + rx * Math.min(1, Math.max(0, u)), yy = s.a[1] + ry * Math.min(1, Math.max(0, u)), r = Math.max(s.hw, t.hw) * FILL_GROW;
    const near = out.find((d) => Math.hypot(d.x - x, d.y - yy) < DOT_MERGE);
    if (near) near.r = Math.max(near.r, r); else out.push({ x, y: yy, r });
  }
  return out;
}

// All the asphalt: a ribbon per road, a disc at each junction and a one-lane strip for each road cell the ribbons miss.
export function buildAsphalt(city, y = Y_ROAD) {
  const positions = [], indices = [];
  for (const r of city.roads ?? []) ribbon(r.pts, roadWidth(r) / 2, y, positions, indices);
  for (const { x, y: jy, r } of junctionFills(city.roads ?? [])) { // an eight-sided fan
    const base = positions.length / 3;
    positions.push(x, y, -jy);
    for (let k = 0; k < 8; k++) positions.push(x + Math.cos((k * Math.PI) / 4) * r, y, -(jy + Math.sin((k * Math.PI) / 4) * r));
    for (let k = 0; k < 8; k++) indices.push(base, base + 1 + k, base + 1 + ((k + 1) % 8));
  }
  for (const r of roadPatches(city)) ribbon(r.pts, r.w / 2, y, positions, indices);
  return finishFlat(positions, indices);
}

// Sidewalks with the parts removed that run inside a road ribbon, or that would cover a road cell centre (where the taxi drives).
// Each walk is sampled every STEP_W metres; samples that fail are dropped and the rest are rejoined into pieces of two or more points.
const STEP_W = 2, WALK_MARGIN = 1, HASH = 32;
export function clipWalks(walks, city) {
  const roads = [...(city.roads ?? []), ...roadPatches(city)], hash = new Map();
  roads.forEach((r, i) => {
    const hw = roadWidth(r) / 2;
    for (let k = 0; k < r.pts.length - 1; k++) {
      const [p, q] = [r.pts[k], r.pts[k + 1]];
      for (let gx = Math.floor((Math.min(p[0], q[0]) - hw) / HASH); gx <= Math.floor((Math.max(p[0], q[0]) + hw) / HASH); gx++) {
        for (let gy = Math.floor((Math.min(p[1], q[1]) - hw) / HASH); gy <= Math.floor((Math.max(p[1], q[1]) + hw) / HASH); gy++) {
          const key = gx * 100003 + gy;
          if (!hash.has(key)) hash.set(key, []);
          hash.get(key).push([i, k]);
        }
      }
    }
  });
  const cellHash = new Map();
  for (let r = 0; r < city.rows; r++) for (let c = 0; c < city.cols; c++) {
    if (city.kind[r][c] !== 'r') continue;
    const [x, z] = cellCentre(c, r, city), key = c * 100003 + (city.rows - 1 - r);
    cellHash.set(key, [x, -z]);
  }
  const blocked = (x, y, w) => {
    for (const [i, k] of hash.get(Math.floor(x / HASH) * 100003 + Math.floor(y / HASH)) ?? []) {
      if (segDist(x, y, roads[i].pts[k], roads[i].pts[k + 1]) < roadWidth(roads[i]) / 2) return true;
    }
    const gx = Math.floor(x / city.cellM), gy = Math.floor(y / city.cellM), reach = w / 2 + WALK_MARGIN;
    for (let i = gx - 1; i <= gx + 1; i++) for (let j = gy - 1; j <= gy + 1; j++) {
      const c = cellHash.get(i * 100003 + j);
      if (c && Math.hypot(x - c[0], y - c[1]) < reach) return true;
    }
    return false;
  };
  const out = [];
  for (const walk of walks ?? []) {
    if (!walk.pts?.length) continue;
    const s = [walk.pts[0]];
    for (let i = 0; i < walk.pts.length - 1; i++) {
      const [p, q] = [walk.pts[i], walk.pts[i + 1]], n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / STEP_W));
      for (let k = 1; k <= n; k++) s.push(k === n ? q : [p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n]);
    }
    let run = [];
    const flush = () => { if (run.length > 1) out.push({ ...walk, pts: run }); run = []; };
    for (const pt of s) { if (blocked(pt[0], pt[1], walk.w)) flush(); else run.push(pt); }
    flush();
  }
  return out;
}

// A white stop line across the approach lanes, STOP_BACK metres before each signal along every road through (or ending at) it.
// Right-hand traffic: a two-way road gets the right-hand half for each direction, a one-way road the full width. A signal with no road within STOP_MATCH metres gets none.
const STOP_BACK = 8, STOP_MATCH = 3, STOP_T = 0.5;
const pointAlong = (pts, at) => { // the point `at` metres along the polyline, and the travel direction there
  let run = 0;
  for (let k = 0; k < pts.length - 1; k++) {
    const l = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
    if (l && (at <= run + l || k === pts.length - 2)) {
      const f = Math.min(1, Math.max(0, (at - run) / l));
      return [pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f, (pts[k + 1][0] - pts[k][0]) / l, (pts[k + 1][1] - pts[k][1]) / l];
    }
    run += l;
  }
  return null;
};
export function buildStopLines(heads, roads) {
  const P = [], I = [];
  for (const h of heads ?? []) {
    for (const r of roads) {
      const pts = r.pts;
      let arc = 0, bd = Infinity, total = 0;
      for (let k = 0; k < pts.length - 1; k++) {
        const [p, q] = [pts[k], pts[k + 1]], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy), l2 = l * l || 1;
        const t = Math.max(0, Math.min(1, ((h.x - p[0]) * dx + (h.y - p[1]) * dy) / l2)), d = Math.hypot(h.x - p[0] - dx * t, h.y - p[1] - dy * t);
        if (d < bd) { bd = d; arc = total + l * t; }
        total += l;
      }
      if (bd > STOP_MATCH) continue;
      const hw = roadWidth(r) / 2, oneWay = r.oneway === 1 || r.oneway === -1;
      for (const dir of [1, -1]) { // travelling along the stored points (1) or against them (-1)
        if ((r.oneway === 1 && dir === -1) || (r.oneway === -1 && dir === 1)) continue;
        const at = dir === 1 ? arc - STOP_BACK : arc + STOP_BACK;
        if (at < 0.5 || at > total - 0.5) continue; // too short to approach from this side
        const f = pointAlong(pts, at);
        if (!f) continue;
        const [px, py] = f, dx = f[2] * dir, dy = f[3] * dir, rx = dy, ry = -dx; // travel direction and its right-hand side (x east, y north)
        const from = oneWay ? -(hw - 0.2) : CENTRE_GAP + 0.15, to = hw - 0.2, base = P.length / 3;
        for (const [lat, along] of [[from, -1], [to, -1], [to, 1], [from, 1]]) {
          P.push(px + rx * lat + dx * along * STOP_T / 2, Y_MARK, -(py + ry * lat + dy * along * STOP_T / 2));
        }
        I.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
  }
  return finishFlat(P, I);
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
