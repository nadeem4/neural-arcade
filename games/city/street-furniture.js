// Pure layout for the street furniture: tree looks, lamp spots and the elevated L (no DOM, no three.js).
// Data points are [x, y]; the world is x, z with z = -y. Every look comes from a seeded hash of an index (nothing unseeded or timed),
// so two runs give the same trees (and `?record=1` footage does not change).
// scene-furniture.js turns these specs into InstancedMeshes.
import { Y_ROAD, Y_WALK } from './street-model.js';

export function hash01(i, salt = 0) {
  let h = (Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

// ---- Trees ----
// One spec per tree: trunk height, crown size, a squash so no two crowns match, a turn, and a small green shift (hue, lightness).
// `step` keeps every nth tree (the phone tier); each tree is looked up by its own index so it keeps its look.
export function treeSpecs(trees, step = 1) {
  const out = [];
  for (let i = 0; i < trees.length; i += step) {
    const [x, y] = trees[i];
    out.push({
      x, z: -y,
      trunkH: 2 + hash01(i, 1) * 1.6,
      crownR: 1.8 + hash01(i, 2) * 1.8,
      sx: 0.85 + hash01(i, 3) * 0.3,
      sz: 0.85 + hash01(i, 4) * 0.3,
      rot: hash01(i, 5) * Math.PI * 2,
      dh: (hash01(i, 6) - 0.5) * 0.08,
      dl: (hash01(i, 7) - 0.5) * 0.2,
    });
  }
  return out;
}

// The crown is a few overlapping low-poly blobs (unit offsets from the crown centre, radius as a fraction of the crown). One blob for phones.
const BLOBS = [
  { x: 0, y: 0, z: 0, r: 1 },
  { x: 0.55, y: -0.3, z: 0.25, r: 0.7 },
  { x: -0.45, y: 0.15, z: -0.4, r: 0.8 },
];
export const crownBlobs = (n = 3) => BLOBS.slice(0, n).map((b) => ({ ...b }));

// ---- Lamps ----
export const lampSpecs = (lamps) => lamps.map(([x, y]) => ({ x, z: -y }));


// ---- The L ----
const DECK_W = 4.8, DECK_T = 0.6, GIRDER_W = 0.4, GIRDER_H = 1.2, GAUGE = 0.75, RAIL_W = 0.18, RAIL_H = 0.25;
const BEAM_H = 0.4, BEAM_D = 1, LEG = 0.7, LEG_TOP_GAP = 1.6, SLIDE_MAX = 10, SLIDE_STEP = 2.5;
const LATERALS = [3.2, 4.2, 5.2, 6.2, 7.2]; // how far each leg stands from a single track's line, nearest first
// Surface heights (street-model.js: roads 0.8, walks 1.1; the ground plane is at -0.45). Lamps stand on the walk, trunks start at park grass,
// L columns reach down to the ground plane (so none floats beside a road) and the deck height is measured from the road.
export const SURFACE = { ground: -0.45, grass: 0.4, lampBase: Y_WALK - 0.1 };
const BED_TOP = Y_ROAD + 0.2, BED = { w: 4.2, t: BED_TOP - SURFACE.ground, y: (BED_TOP + SURFACE.ground) / 2 }, GROUND_RAIL_Y = BED_TOP + RAIL_H / 2;
const MIN_SEP = 3.2, PAIR_NEAR = 7, PAIR_SHARE = 0.5, PAIR_SEP_MAX = 5.5;

const worldPts = (pts) => pts.map(([x, y]) => [x, -y]);

// One box per polyline segment (world midpoint, length a little long so joints overlap, heading about y). With a deck half-width,
// each end is lengthened by halfW * tan(turn / 2) so the outer deck edge has no notch at a bend.
export function railSegments(pts, halfW = 0) {
  const p = worldPts(pts).filter((q, i, a) => !i || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > 1e-6);
  const dirs = [];
  for (let i = 1; i < p.length; i++) { const dx = p[i][0] - p[i - 1][0], dz = p[i][1] - p[i - 1][1], l = Math.hypot(dx, dz); dirs.push([dx / l, dz / l, l]); }
  const ext = (i) => { // lengthening at vertex i (between segment i-1 and i)
    if (!halfW || i <= 0 || i >= dirs.length) return 0;
    const dot = Math.max(-1, Math.min(1, dirs[i - 1][0] * dirs[i][0] + dirs[i - 1][1] * dirs[i][1]));
    return Math.min(4, halfW * Math.tan(Math.min(Math.acos(dot), 2.6) / 2));
  };
  return dirs.map(([ux, uz, l], i) => {
    const e0 = ext(i), e1 = ext(i + 1), cx = (p[i][0] + p[i + 1][0]) / 2 + (ux * (e1 - e0)) / 2, cz = (p[i][1] + p[i + 1][1]) / 2 + (uz * (e1 - e0)) / 2;
    return { x: cx, z: cz, len: l + e0 + e1 + 0.4, yaw: Math.atan2(-uz, ux) };
  });
}

// ---- Pairing the two tracks of one L line ----
// OSM draws the L as one way per track, 3 to 5 m apart. Two elevated ways at the same height that run side by side
// become one item (a centreline between them and `sep`, the gap) so they get one deck and one set of columns.
const nearOn = (p, pts) => {
  let best = Infinity, q = null;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2)) : 0;
    const x = ax + t * dx, y = ay + t * dy, d = Math.hypot(p[0] - x, p[1] - y);
    if (d < best) { best = d; q = [x, y]; }
  }
  return { d: best, q };
};
const resample = (pts, step) => {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
};
const overlap = (a, b) => { // share of a's samples within PAIR_NEAR of b, and their mean distance
  const ds = resample(a.pts, 5).map((p) => nearOn(p, b.pts).d).filter((d) => d < PAIR_NEAR);
  return { share: ds.length / resample(a.pts, 5).length, mean: ds.length ? ds.reduce((x, y) => x + y, 0) / ds.length : 0 };
};

export function pairRails(rails) {
  const cands = [];
  rails.forEach((a, i) => {
    if (!a.elevated) return;
    for (let j = i + 1; j < rails.length; j++) {
      const b = rails[j];
      if (!b.elevated || b.h !== a.h) continue;
      const ab = overlap(a, b), ba = overlap(b, a), share = Math.min(ab.share, ba.share);
      if (share >= PAIR_SHARE && ab.mean <= PAIR_SEP_MAX) cands.push({ i, j, share, sep: ab.mean });
    }
  });
  cands.sort((x, y) => y.share - x.share || x.i - y.i);
  const used = new Set(), made = new Map();
  for (const c of cands) {
    if (used.has(c.i) || used.has(c.j)) continue;
    used.add(c.i); used.add(c.j);
    const a = rails[c.i], b = rails[c.j], mid = [];
    for (const p of resample(a.pts, 8)) {
      const n = nearOn(p, b.pts), m = n.d < PAIR_NEAR ? [(p[0] + n.q[0]) / 2, (p[1] + n.q[1]) / 2] : p;
      if (!mid.length || Math.hypot(m[0] - mid[mid.length - 1][0], m[1] - mid[mid.length - 1][1]) > 0.5) mid.push(m);
    }
    made.set(c.i, { pts: mid, h: a.h, elevated: true, sep: Math.max(MIN_SEP, c.sep), ways: [c.i, c.j] });
  }
  const out = [];
  rails.forEach((r, i) => {
    if (made.has(i)) out.push(made.get(i));
    else if (!used.has(i)) out.push({ ...r, ways: [i] });
  });
  // Lines that cross are drawn at the same height in the data; nudging each item a few centimetres apart keeps crossing decks from z-fighting.
  out.forEach((r, i) => { if (r.elevated) r.lift = (i % 6) * 0.1; });
  return out;
}

// Distance from a world point to the edge of the nearest driving lane (negative inside a road). Roads are data-space polylines with width w.
export function clearanceFromRoads(x, z, roads) {
  const px = x, py = -z;
  let best = Infinity;
  for (const r of roads) {
    const hw = r.w / 2, pts = r.pts;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      if (px < Math.min(ax, bx) - hw - best || px > Math.max(ax, bx) + hw + best || py < Math.min(ay, by) - hw - best || py > Math.max(ay, by) + hw + best) continue;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
      best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy) - hw);
    }
  }
  return best;
}

// A column is a portal: two legs either side of the track joined by a cross beam under the deck.
export function columnLegs(k) {
  const nx = Math.sin(k.yaw), nz = Math.cos(k.yaw); // unit across the track (it runs (cos yaw, -sin yaw))
  return [[k.x + nx * k.lat, k.z + nz * k.lat], [k.x - nx * k.lat, k.z - nz * k.lat]];
}

// Columns about every `spacing` metres along the line. Each is moved along the track and out to the side until both legs are clear of the
// driving lanes; one that cannot get clear is dropped (the deck spans the gap). `sep` widens the stance for a two-track deck.
export function railColumns(pts, roads, { spacing = 20, sep = 0 } = {}) {
  const p = worldPts(pts), cum = [0];
  for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  const total = cum[cum.length - 1];
  if (total < 1e-6) return [];
  const n = Math.max(1, Math.round(total / spacing)), out = [];
  const slides = [0];
  for (let s = SLIDE_STEP; s <= SLIDE_MAX; s += SLIDE_STEP) slides.push(-s, s);
  for (let k = 0; k < n; k++) {
    const s0 = ((k + 0.5) * total) / n;
    let found = null;
    for (const slide of slides) {
      const s = Math.max(0, Math.min(total, s0 + slide));
      let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
      const seg = cum[i] - cum[i - 1] || 1, t = (s - cum[i - 1]) / seg;
      const x = p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, z = p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t;
      const yaw = Math.atan2(-(p[i][1] - p[i - 1][1]), p[i][0] - p[i - 1][0]);
      for (const l of LATERALS) {
        const c = { x, z, yaw, lat: l + sep / 2 };
        if (columnLegs(c).every(([lx, lz]) => clearanceFromRoads(lx, lz, roads) >= 0.3)) { found = c; break; }
      }
      if (found) break;
    }
    if (found) out.push(found);
  }
  return out;
}

const across = (yaw, d) => [Math.sin(yaw) * d, Math.cos(yaw) * d];

// Every box of one rail entry (from pairRails): { x, y, z, yaw, sx (along), sy, sz (across), colour }. Elevated: deck, girders, rails and portal
// columns (a two-track entry, with `sep`, gets one wide deck and four rails; `lift` raises it a little). Otherwise: a track bed and two rails.
export function railParts(rail, roads) {
  const parts = [], sep = rail.sep ?? 0, deckW = DECK_W + sep;
  const segs = railSegments(rail.pts, rail.elevated ? deckW / 2 : 0);
  const box = (x, y, z, yaw, sx, sy, sz, colour) => parts.push({ x, y, z, yaw, sx, sy, sz, colour });
  const side = (s, d, y, sy, sz, colour) => { const [ox, oz] = across(s.yaw, d); box(s.x + ox, y, s.z + oz, s.yaw, s.len, sy, sz, colour); };
  if (rail.elevated) {
    const h = Y_ROAD + rail.h + (rail.lift ?? 0), tracks = sep ? [-sep / 2, sep / 2] : [0];
    for (const s of segs) {
      box(s.x, h - DECK_T / 2, s.z, s.yaw, s.len, DECK_T, deckW, 'deck');
      for (const d of [-1, 1]) side(s, d * (deckW / 2 - GIRDER_W / 2), h - GIRDER_H / 2, GIRDER_H, GIRDER_W, 'steel');
      for (const t of tracks) for (const d of [-1, 1]) side(s, t + d * GAUGE, h + RAIL_H / 2, RAIL_H, RAIL_W, 'rail');
    }
    const legTop = h - LEG_TOP_GAP, legH = Math.max(1, legTop - SURFACE.ground);
    for (const k of railColumns(rail.pts, roads, { sep })) {
      box(k.x, h - GIRDER_H - BEAM_H / 2, k.z, k.yaw, BEAM_D, BEAM_H, 2 * k.lat + LEG, 'steel');
      for (const [lx, lz] of columnLegs(k)) box(lx, SURFACE.ground + legH / 2, lz, k.yaw, LEG, legH, LEG, 'steel');
    }
  } else {
    for (const s of segs) {
      box(s.x, BED.y, s.z, s.yaw, s.len, BED.t, BED.w, 'bed');
      for (const d of [-1, 1]) side(s, d * GAUGE, GROUND_RAIL_Y, RAIL_H, RAIL_W, 'rail');
    }
  }
  return parts;
}

export const RAIL_COLOURS = { deck: '#6e7279', steel: '#555a62', rail: '#2a2c31', bed: '#4b463f' };
