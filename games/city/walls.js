// Keeps the drawn taxi out of building walls. Pure, no DOM, no three.js.
// The sim grid is 12 m cells and a footpath cell can sit right against a wall, so the cell centre (where the taxi is
// driven) can be closer to a building than half the car's width. The sim still decides the trip; this only nudges
// where the car is drawn, sideways, just far enough that no part of its box is inside a building outline.
import { lampSpecs, pairRails, railColumns, columnLegs } from './street-furniture.js';
import { headPlacement } from './signal-heads.js';

const HALF_W = 0.95 * 1.5, HALF_L = 2.1 * 1.5; // the taxi model's half width and length times TAXI_SCALE (scene-taxi.js)
const GAP = 0.1; // metres left between the car and the wall
const NEAR = 8;  // only outlines within this many metres of the route can ever touch the car

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

// The outlines near any frame of a route, so the per-frame work stays small.
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
// The shortest move from (x, y), inside the ring, to just outside it.
function outOf(x, y, ring) {
  let best = null;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i], dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    const vx = a[0] + t * dx - x, vy = a[1] + t * dy - y, d = Math.hypot(vx, vy);
    if (!best || d < best.d) best = { d, vx, vy };
  }
  const k = (best.d + GAP) / (best.d || 1);
  return best.d ? [best.vx * k, best.vy * k] : [GAP, 0];
}

// Sample points over the car's box (map x, y) at a pose (world x, z, heading).
export function boxPoints(x, z, heading, nx = 13, nl = 25) {
  const fx = Math.sin(heading), fz = Math.cos(heading), pts = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nl; j++) {
    const a = -HALF_W + (2 * HALF_W * i) / (nx - 1), b = -HALF_L + (2 * HALF_L * j) / (nl - 1);
    pts.push([x + fz * a + fx * b, -(z - fx * a + fz * b)]);
  }
  return pts;
}


// Move the car sideways out of any outline it overlaps; clear is false if it still overlaps (a gap too narrow for it).
function slide(x, z, heading, rings) {
  let px = x, py = -z, clear = false;
  for (let pass = 0; pass < 8 && !clear; pass++) {
    let move = null;
    for (const p of boxPoints(px, -py, heading)) {
      for (const { ring, box } of rings) {
        if (p[0] < box[0] || p[0] > box[2] || p[1] < box[1] || p[1] > box[3] || !inside(p[0], p[1], ring)) continue;
        const m = outOf(p[0], p[1], ring);
        if (!move || Math.hypot(...m) > Math.hypot(...move)) move = m;
      }
    }
    // A corner of an outline poking into the box between sample points: push the car off it by the shortest way out of the box.
    const fx = Math.sin(heading), fz = Math.cos(heading); // forward in world (x, z); in map (x, y) it is (fx, -fz)
    for (const { ring } of rings) {
      for (const [vx, vy] of ring) {
        const dx = vx - px, dy = vy - py, along = dx * fx - dy * fz, across = dx * fz + dy * fx;
        if (Math.abs(along) >= HALF_L || Math.abs(across) >= HALF_W) continue;
        const ea = HALF_L - Math.abs(along) + GAP, ec = HALF_W - Math.abs(across) + GAP; // how far the car moves to free this corner
        const k = ea < ec ? -(Math.sign(along) || 1) * ea : -(Math.sign(across) || 1) * ec; // move away from the corner's side
        const m = ea < ec ? [fx * k, -fz * k] : [fz * k, fx * k]; // along the car's forward (fx, -fz) or right (fz, fx) in map metres
        if (!move || Math.hypot(...m) > Math.hypot(...move)) move = m;
      }
    }
    if (move) { px += move[0]; py += move[1]; } else clear = true;
  }
  return { x: px, z: -py, heading, clear };
}

// The pose kept out of every outline: { x, z, heading } in world metres. It slides sideways first; in a gap too narrow for the car
// at its heading (a turn through an alley) it also straightens towards the nearest street direction.
export function clearOfWalls(x, z, heading, rings) {
  if (!rings?.length) return { x, z, heading };
  let out = slide(x, z, heading, rings);
  if (out.clear) return out;
  const street = Math.round(heading / (Math.PI / 2)) * (Math.PI / 2);
  for (const k of [0.5, 0.75, 1]) {
    out = slide(x, z, heading + (street - heading) * k, rings);
    if (out.clear) break;
  }
  return out;
}
