// Keeps the drawn taxi out of building walls. Pure, no DOM, no three.js.
// The sim grid is 12 m cells and a footpath cell can sit right against a wall, so the cell centre (where the taxi is
// driven) can be closer to a building than half the car's width. The sim still decides the trip; this finds ONE small
// sideways shift for each route tile (once per trip) that keeps the car's box clear of every solid outline, and drive.js
// eases the shift between tiles. The car never turns and nothing is searched per frame.
import { lampSpecs, pairRails, railColumns, columnLegs } from './street-furniture.js';
import { headPlacement } from './signal-heads.js';

const HALF_W = 0.95 * 1.5, HALF_L = 2.1 * 1.5; // the taxi model's half width and length times TAXI_SCALE (scene-taxi.js)
const GAP = 0.1; // metres left between the car and the wall
const NEAR = 12; // only outlines within this many metres of the route can ever touch the car (a half-cell shift plus its half length)

// How far a tile's shift may go: half a 12 m cell, less half the car's width (so the car stays on its own tile).
export const SHIFT_CAP = 12 / 2 - HALF_W;

// Everything solid at street level as outlines in map metres (x, y): buildings that touch the ground (a bridge between towers is
// raised and the taxi passes under it), street lamps, signal poles and the L's columns (small squares of half-width r).
export function solidRings(city) {
  const roads = city.roads ?? [];
  const posts = [];
  const poles = (city.signalHeads ?? []).map((h) => { const p = headPlacement(h, roads); return { x: p.x, z: -p.y }; });
  for (const p of poles) posts.push([p.x, -p.z, 0.3]);
  for (const p of lampSpecs(city.lamps ?? [], roads, poles)) posts.push([p.x, -p.z, 0.3]);
  for (const r of pairRails(city.rail ?? [])) {
    if (!r.elevated) continue;
    for (const k of railColumns(r.pts, roads, { sep: r.sep ?? 0 })) for (const [x, z] of columnLegs(k)) posts.push([x, -z, 0.5]);
  }
  const rings = (city.buildings ?? []).filter((b) => !(b.hasParts && !b.part) && (b.minH ?? 0) < 2).map((b) => b.ring);
  for (const [x, y, r] of posts) rings.push([[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]]);
  return rings.map((ring) => {
    const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
    return { ring, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
  });
}

// The outlines near any frame of a route, so the per-tile work stays small.
export function ringsNear(solids, frames) {
  return solids.filter(({ box }) => frames.some((f) => f.x >= box[0] - NEAR && f.x <= box[2] + NEAR && -f.z >= box[1] - NEAR && -f.z <= box[3] + NEAR));
}

const inside = (x, y, ring) => {
  let in_ = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) in_ = !in_;
  }
  return in_;
};

// How many places the car's box (grown by GAP) touches an outline at a pose (world x, z, heading): sample points of the box
// inside an outline, plus outline corners inside the box. Zero means clear.
function overlaps(x, z, heading, rings) {
  const fx = Math.sin(heading), fz = Math.cos(heading), py = -z, hw = HALF_W + GAP, hl = HALF_L + GAP, r = Math.hypot(hw, hl);
  let n = 0;
  for (const { ring, box } of rings) {
    if (x + r < box[0] || x - r > box[2] || py + r < box[1] || py - r > box[3]) continue;
    for (const [vx, vy] of ring) { // a corner poking into the box
      const dx = vx - x, dy = vy - py;
      if (Math.abs(dx * fx - dy * fz) < hl && Math.abs(dx * fz + dy * fx) < hw) n++;
    }
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 17; j++) {
        const a = -hw + (2 * hw * i) / 8, b = -hl + (2 * hl * j) / 16;
        const qx = x + fz * a + fx * b, qy = py + fx * a - fz * b;
        if (qx >= box[0] && qx <= box[2] && qy >= box[1] && qy <= box[3] && inside(qx, qy, ring)) n++;
      }
    }
  }
  return n;
}

// Candidate shifts, nearest first: a grid of 0.25 m steps, sorted by length (built once per cap).
const STEP = 0.25, grids = new Map();
const gridFor = (cap) => {
  if (!grids.has(cap)) {
    const g = [], k = Math.floor(cap / STEP);
    for (let i = -k; i <= k; i++) for (let j = -k; j <= k; j++) if (Math.hypot(i, j) * STEP <= cap) g.push([i * STEP, j * STEP]);
    grids.set(cap, g.sort((p, q) => Math.hypot(...p) - Math.hypot(...q)));
  }
  return grids.get(cap);
};

// One shift [dx, dz] (world metres) per route tile. poseSets[i] is the raw poses the car takes around tile i (its headings
// there). Each tile gets the smallest shift within `cap` metres that keeps every one of those poses clear; if none does, the
// one with the fewest overlaps, and the tile is counted in unclear.
export function clearOffsets(poseSets, rings, cap, nearEach = null) {
  const grid = gridFor(cap), offsets = [];
  let unclear = 0;
  for (let t = 0; t < poseSets.length; t++) {
    const poses = poseSets[t], mine = nearEach ? nearEach[t] : rings;
    let best = grid[0], bestN = Infinity;
    for (const [dx, dz] of grid) {
      let n = 0;
      for (const p of poses) { n += overlaps(p.x + dx, p.z + dz, p.heading, mine); if (n >= bestN) break; }
      if (n < bestN) { best = [dx, dz]; bestN = n; if (n === 0) break; }
    }
    if (bestN > 0) unclear++;
    offsets.push(best);
  }
  return { offsets, unclear };
}

// The shift at time t (in tiles) from the per-tile shifts: eased from one tile's shift to the next with the drive's own smoothstep.
// Returns a shared [dx, dz]; read it before the next call.
export const smooth = (u) => u * u * (3 - 2 * u);
const shiftOut = [0, 0];
export function shiftAt(offsets, t) {
  const last = offsets.length - 1, tt = Math.min(Math.max(t, 0), last), i = Math.min(Math.floor(tt), last - 1);
  if (i < 0) { shiftOut[0] = offsets[0][0]; shiftOut[1] = offsets[0][1]; return shiftOut; }
  const a = offsets[i], b = offsets[i + 1], k = smooth(tt - i);
  shiftOut[0] = a[0] + (b[0] - a[0]) * k; shiftOut[1] = a[1] + (b[1] - a[1]) * k;
  return shiftOut;
}

export const PER = 16; // poses per tile
// The shifts for a whole route. poses are the raw poses PER to a tile (poses[k] is at tile k / PER), tiles + 1 tiles in all.
// maxStep is the most one tile's shift may differ from the next (so the eased shift never moves faster than the caller allows).
// First each tile on its own (clearOffsets); then passes, back and forth, that re-pick any tile that is blocked between tiles
// (the eased shifts either side in place) or steps too far from a neighbour, taking the allowed shift nearest the previous tile's.
export function fitShifts(poses, tiles, allRings, cap, maxStep = Infinity) {
  const near = Array.from({ length: tiles + 1 }, (_, i) => { // only outlines that can reach a car near tile i
    const p = poses[i * PER], r = 12 + cap + HALF_L + GAP;
    return allRings.filter(({ box }) => p.x + r >= box[0] && p.x - r <= box[2] && -p.z + r >= box[1] && -p.z - r <= box[3]);
  });
  const win = (i) => { const s = []; for (let k = Math.max(0, i * PER - PER / 2); k <= Math.min(tiles * PER, i * PER + PER / 2); k++) s.push(poses[k]); return s; };
  const { offsets } = clearOffsets(Array.from({ length: tiles + 1 }, (_, i) => win(i)), allRings, cap, near);
  const blocked = (i) => {
    for (let k = Math.max(0, i * PER - PER); k <= Math.min(tiles * PER, i * PER + PER); k++) {
      const s = shiftAt(offsets, k / PER), p = poses[k];
      if (overlaps(p.x + s[0], p.z + s[1], p.heading, near[i])) return true;
    }
    return false;
  };
  const far = (i, c) => [i - 1, i + 1].some((j) => j >= 0 && j <= tiles && Math.hypot(c[0] - offsets[j][0], c[1] - offsets[j][1]) > maxStep);
  const grid = gridFor(cap), lost = new Set(); // lost: tiles no allowed shift clears (a dead end narrower than the car)
  const settle = () => {
    for (let pass = 0; pass < 24; pass++) {
      let changed = false;
      for (let n = 0; n <= tiles; n++) {
        const i = pass % 2 ? tiles - n : n, prev = offsets[pass % 2 ? Math.min(i + 1, tiles) : Math.max(i - 1, 0)];
        const hit = !lost.has(i) && blocked(i);
        if (!hit && !far(i, offsets[i])) continue;
        const keep = offsets[i];
        const order = grid.map((c) => [c, Math.hypot(c[0], c[1]) + Math.hypot(c[0] - prev[0], c[1] - prev[1])]).sort((p, q) => p[1] - q[1]);
        let fixed = false;
        for (const [c] of order) { if (!hit && far(i, c)) continue; offsets[i] = c; if (lost.has(i) || !blocked(i)) { fixed = true; break; } }
        if (fixed) changed = true; else { offsets[i] = keep; if (hit) lost.add(i); }
      }
      if (!changed) break;
    }
  };
  settle();
  if (lost.size) settle(); // the lost tiles are left to clip a little; now only keep their shifts from jumping
  let unclear = 0;
  for (let i = 0; i <= tiles; i++) if (blocked(i)) unclear++;
  return { offsets, unclear };
}
