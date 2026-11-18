// Pure layout for the street furniture: tree looks, lamp spots and the elevated L (no DOM, no three.js).
// Data points are [x, y]; the world is x, z with z = -y. Every look comes from a seeded hash of an index (nothing unseeded or timed),
// so two runs give the same trees (and `?record=1` footage does not change).
// scene-furniture.js turns these specs into InstancedMeshes.

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
const BEAM_H = 0.4, BEAM_D = 1, LEG = 0.7, LEG_TOP_GAP = 1.6, SLIDE_MAX = 5;
const LATERALS = [3.2, 4.2, 5.2, 6.2, 7.2]; // how far each leg stands from the line, nearest first
const BED = { w: 4.2, t: 0.2, y: 0.35 }, GROUND_RAIL_Y = 0.55;

const worldPts = (pts) => pts.map(([x, y]) => [x, -y]);

// One box per polyline segment (world midpoint, length a little long so joints overlap, heading about y).
export function railSegments(pts) {
  const p = worldPts(pts), out = [];
  for (let i = 1; i < p.length; i++) {
    const dx = p[i][0] - p[i - 1][0], dz = p[i][1] - p[i - 1][1], len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    out.push({ x: (p[i][0] + p[i - 1][0]) / 2, z: (p[i][1] + p[i - 1][1]) / 2, len: len + 0.4, yaw: Math.atan2(-dz, dx) });
  }
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

// Columns every `spacing` metres along the line. Each is moved a little along the track and out to the side until both legs are clear of the driving lanes (or as clear as it gets).
export function railColumns(pts, roads, { spacing = 20 } = {}) {
  const p = worldPts(pts), cum = [0];
  for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  const total = cum[cum.length - 1];
  if (total < 1e-6) return [];
  const n = Math.max(1, Math.round(total / spacing)), out = [];
  const slides = [0, -2.5, 2.5, -SLIDE_MAX, SLIDE_MAX];
  for (let k = 0; k < n; k++) {
    const s0 = ((k + 0.5) * total) / n;
    let best = null, bestCost = Infinity;
    for (const slide of slides) {
      const s = Math.max(0, Math.min(total, s0 + slide));
      let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
      const seg = cum[i] - cum[i - 1] || 1, t = (s - cum[i - 1]) / seg;
      const x = p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, z = p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t;
      const yaw = Math.atan2(-(p[i][1] - p[i - 1][1]), p[i][0] - p[i - 1][0]);
      for (const lat of LATERALS) {
        const c = { x, z, yaw, lat };
        const cost = columnLegs(c).reduce((a, [lx, lz]) => a + Math.max(0, -(clearanceFromRoads(lx, lz, roads) - 0.3)), 0);
        if (cost < bestCost - 1e-9) { best = c; bestCost = cost; }
        if (cost === 0) break;
      }
      if (bestCost === 0) break;
    }
    out.push(best);
  }
  return out;
}

const across = (yaw, d) => [Math.sin(yaw) * d, Math.cos(yaw) * d];

// Every box of one rail entry: { x, y, z, yaw, sx (along), sy, sz (across), colour }. Elevated: deck, girders, rails and portal columns. Otherwise: a track bed and two rails.
export function railParts(rail, roads) {
  const parts = [], segs = railSegments(rail.pts);
  const box = (x, y, z, yaw, sx, sy, sz, colour) => parts.push({ x, y, z, yaw, sx, sy, sz, colour });
  const side = (s, d, y, sy, sz, colour) => { const [ox, oz] = across(s.yaw, d); box(s.x + ox, y, s.z + oz, s.yaw, s.len, sy, sz, colour); };
  if (rail.elevated) {
    const h = rail.h;
    for (const s of segs) {
      box(s.x, h - DECK_T / 2, s.z, s.yaw, s.len, DECK_T, DECK_W, 'deck');
      for (const d of [-1, 1]) side(s, d * (DECK_W / 2 - GIRDER_W / 2), h - GIRDER_H / 2, GIRDER_H, GIRDER_W, 'steel');
      for (const d of [-1, 1]) side(s, d * GAUGE, h + RAIL_H / 2, RAIL_H, RAIL_W, 'rail');
    }
    const legH = Math.max(1, h - LEG_TOP_GAP);
    for (const k of railColumns(rail.pts, roads)) {
      box(k.x, h - GIRDER_H - BEAM_H / 2, k.z, k.yaw, BEAM_D, BEAM_H, 2 * k.lat + LEG, 'steel');
      for (const [lx, lz] of columnLegs(k)) box(lx, legH / 2, lz, k.yaw, LEG, legH, LEG, 'steel');
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
