// Reward City people: pedestrians as scenery. Pure and deterministic, no DOM, no three.js.
// They walk the footpath and park cells of the same world the sim uses, and cross a road only at a mapped crossing,
// and only while the cars across them are on red. They only REACT to the taxi (they jump aside when it drives a
// footpath or park tile close to them; a red light run scares nobody, because no mapped crossing lies beside a run's signal on this map). Nothing here feeds back into the sim, the reward,
// the Q-table or training; the one number they touch is the city's score ("What the city wanted", goal.js).
// Everything is baked once at trip start from (map, taxi route, seed) with a seeded generator and read by trip time
// in ticks: no clock and no unseeded random numbers, so ?record=1 frames are identical on every run.
import { mulberry32 } from '../../engine/rng.js';
import { ACTIONS, lightRed } from './sim.js';
import { cellCentre } from './geometry.js';

const ROAD = 0, FOOT = 1, PARK = 2;
export const WALK_TICKS = 4;    // ticks to walk one cell on a footpath (3 m a tick on a 12 m cell)
export const MAX_SPAN = 4;      // the widest road, in cells, a person will cross (shortened to half a light period if that is less)
export const SPAWN_RADIUS = 8;  // people start within this many cells of the taxi's route, so the drive shows them
export const SCARE_M = 8;       // a person this close (map units) to the taxi's path on a footpath or park step is scared
export const JUMP_M = 3;        // how far a scared person jumps aside, in map units
export const JUMP_TICKS = 1;    // and how long the jump takes
const STRAIGHT = 0.6;           // chance to keep walking straight when a person can

// One population on every device, so the city score never depends on the screen. A phone only DRAWS the first few (quality.js peopleDrawn).
export const POPULATION = 60;

// Clothing and skin colours (sRGB hex), picked by a seeded hash of the person's number.
const CLOTHES = [0xc0392b, 0x2e6da4, 0x3a7d44, 0xd9a21b, 0x6c4a8f, 0x222831, 0xe8e4da, 0x8a5a3c, 0xd5679a, 0x4a9ba8];
const SKINS = [0xf1c9a5, 0xd9a273, 0xb67c52, 0x8d5a3b, 0x5a3825, 0xe8b894];
const hash = (seed, i, k) => mulberry32((seed * 7919 + i * 104729 + k * 1299709 + 1) >>> 0)();
export const outfitOf = (seed, i) => ({
  cloth: CLOTHES[Math.floor(hash(seed, i, 1) * CLOTHES.length)],
  skin: SKINS[Math.floor(hash(seed, i, 2) * SKINS.length)],
});

// One Float32Array per field, so the per-frame pose fill allocates nothing. y is the hop height of a scared person.
// surface is what they stand on: SURF_WALK, SURF_PARK or SURF_CROSS (scene-people.js turns it into a height).
export const SURF_WALK = 0, SURF_PARK = 1, SURF_CROSS = 2;
export const newPoses = (n) => ({ x: new Float32Array(n), z: new Float32Array(n), y: new Float32Array(n), walking: new Uint8Array(n), scared: new Uint8Array(n), surface: new Uint8Array(n) });

// Which road cells have a mapped crossing: bit 1 when people cross it north-south, bit 2 east-west. Only signalled cells count,
// so people never stand on road the taxi may legally drive through without a light protecting them.
// A crossing's angle is the bearing of travel across the road. Rows run south, and the grid's row is rows - 1 - floor(y / cellM).
export function crossingFlags(world, city) {
  const flags = new Uint8Array(world.cols * world.rows);
  for (const p of city.crossings || []) {
    const col = Math.floor(p.x / city.cellM), row = world.rows - 1 - Math.floor(p.y / city.cellM);
    if (col < 0 || col >= world.cols || row < 0 || row >= world.rows) continue;
    const c = row * world.cols + col;
    if (world.kind[c] !== ROAD || !world.signal[c]) continue;
    const a = ((p.angle % 180) + 180) % 180;
    flags[c] |= a < 45 || a > 135 ? 1 : 2;
  }
  return flags;
}

// The pedestrian light: walking along an axis is allowed while the cars across that axis have red (the sim's own light function).
export const walkAllowed = (world, tick, dir) => lightRed(world, tick, 1 - (dir % 2));

const step = (world, c, a) => {
  const r = Math.floor(c / world.cols) + ACTIONS[a].dr, col = (c % world.cols) + ACTIONS[a].dc;
  return r < 0 || r >= world.rows || col < 0 || col >= world.cols ? -1 : r * world.cols + col;
};
const walkable = (world, c) => c >= 0 && (world.kind[c] === FOOT || world.kind[c] === PARK);

// From a walkable cell, a road to cross in direction a: the first road cell must hold a crossing along that axis,
// then the person walks straight over road cells to the far footpath or park. Returns { to, span } or null.
function hopFrom(world, flags, c, a, maxSpan) {
  let cur = step(world, c, a);
  if (cur < 0 || world.kind[cur] !== ROAD || !(flags[cur] & (a % 2 === 0 ? 1 : 2))) return null;
  let span = 0;
  while (cur >= 0 && world.kind[cur] === ROAD && span < maxSpan) { span++; cur = step(world, cur, a); }
  return walkable(world, cur) ? { to: cur, span } : null;
}

// Walkable cells within SPAWN_RADIUS of the taxi's route.
function spawnCells(world, events) {
  const near = new Uint8Array(world.cols * world.rows);
  const R = SPAWN_RADIUS;
  const mark = (c) => {
    const r0 = Math.floor(c / world.cols), c0 = c % world.cols;
    for (let r = Math.max(0, r0 - R); r <= Math.min(world.rows - 1, r0 + R); r++) {
      for (let col = Math.max(0, c0 - R); col <= Math.min(world.cols - 1, c0 + R); col++) near[r * world.cols + col] = 1;
    }
  };
  const steps = events.steps;
  if (steps.length) mark(steps[0].from);
  for (const s of steps) mark(s.cell);
  const out = [];
  for (let c = 0; c < near.length; c++) if (near[c] && walkable(world, c)) out.push(c);
  return out;
}

// One person's walk, as times and cells: at ts[k] they are at cs[k] and move straight to cs[k + 1] by ts[k + 1].
// taxiCell(t) is the taxi's cell at tick t: a person never starts a crossing while the taxi is in its road cells.
function walk(world, flags, rng, start, horizon, maxSpan, taxiCell) {
  const ts = [0], cs = [start], hops = [], isHop = [false];
  let t = 0, cell = start, dir = Math.floor(rng() * 4);
  while (t < horizon) {
    const opts = [];
    for (let a = 0; a < 4; a++) {
      const n = step(world, cell, a);
      if (walkable(world, n)) opts.push({ a, to: n, span: 0 });
      else { const h = hopFrom(world, flags, cell, a, maxSpan); if (h) opts.push({ a, ...h }); }
    }
    if (!opts.length) { t += WALK_TICKS; ts.push(t); cs.push(cell); isHop.push(false); continue; }
    const ahead = opts.find((o) => o.a === dir);
    const forward = opts.filter((o) => o.a !== (dir + 2) % 4);
    const pool = forward.length ? forward : opts;
    const pick = ahead && rng() < STRAIGHT ? ahead : pool[Math.floor(rng() * pool.length)];
    if (pick.span) {
      let te = t; // wait at the kerb until the light lets the whole crossing happen
      const roadCells = []; for (let k = 1, c = cell; k <= pick.span; k++) { c = step(world, c, pick.a); roadCells.push(c); }
      const fits = (s) => {
        for (let k = 0; k < pick.span; k++) if (!walkAllowed(world, s + k, pick.a)) return false;
        for (let k = -1; k <= pick.span + 1; k++) if (roadCells.includes(taxiCell(s + k))) return false;
        return true;
      };
      while (!fits(te) && te < t + world.period) te++;
      if (!fits(te)) { t += WALK_TICKS; ts.push(t); cs.push(cell); isHop.push(false); continue; } // this crossing is shut for now: stand at the kerb a while, then choose again
      if (te > t) { ts.push(te); cs.push(cell); isHop.push(false); }
      t = te + pick.span;
      hops.push({ tEnter: te, span: pick.span, dir: pick.a, from: cell, to: pick.to });
    } else t += WALK_TICKS;
    ts.push(t); cs.push(pick.to); isHop.push(pick.span > 0); cell = pick.to; dir = pick.a;
  }
  return { ts, cs, hops, isHop };
}

// Bakes the people for one trip. events is events.js tripEvents (the taxi's route); opts is { seed, count } (count defaults to POPULATION).
// Returns { count, scares: [{ id, tick, dx, dz }], scaresAt(n), fillPoses(t, out, opts), crossings, crossingAt(id, t) }.
// `t` is the trip clock in ticks (the drive's progress). scaresAt(n) is the people scared by the first n whole steps.
export function bakePeople(world, city, events, { seed = 1, count = POPULATION } = {}) {
  const rng = mulberry32((seed * 2654435761 + 12345) >>> 0);
  const flags = crossingFlags(world, city);
  const maxSpan = Math.min(MAX_SPAN, Math.floor(world.period / 2));
  const horizon = events.steps.length + 2;
  const taxiCell = (t) => (events.steps.length ? (t <= 0 ? events.steps[0].from : events.steps[Math.min(t, events.steps.length) - 1].cell) : -1);
  const pool = spawnCells(world, events);
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) { const j = i + Math.floor(rng() * (pool.length - i)); [pool[i], pool[j]] = [pool[j], pool[i]]; } // seeded partial shuffle
  const folk = [];
  for (let id = 0; id < n; id++) {
    const w = walk(world, flags, rng, pool[id], horizon, maxSpan, taxiCell);
    w.ox = (rng() - 0.5) * city.cellM * 0.5; w.oz = (rng() - 0.5) * city.cellM * 0.5; // where on the cell they walk
    folk.push(w);
  }
  const centre = (c) => cellCentre(c % world.cols, Math.floor(c / world.cols), city);
  const scares = [], scared = new Map();

  // Position of person id at time t, without any jump.
  const base = (id, t) => {
    const { ts, cs, ox, oz } = folk[id];
    let lo = 0, hi = ts.length - 1;
    const park = (c) => (world.kind[c] === PARK ? SURF_PARK : SURF_WALK);
    if (t >= ts[hi]) { const [x, z] = centre(cs[hi]); return { x: x + ox, z: z + oz, walking: false, surface: park(cs[hi]) }; }
    if (t <= 0) { const [x, z] = centre(cs[0]); return { x: x + ox, z: z + oz, walking: false, surface: park(cs[0]) }; }
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ts[mid] <= t) lo = mid; else hi = mid; }
    const [ax, az] = centre(cs[lo]), [bx, bz] = centre(cs[lo + 1]);
    const u = (t - ts[lo]) / (ts[lo + 1] - ts[lo]);
    const hop = folk[id].isHop[lo + 1] && u > 0 && u < 1;
    return { x: ax + (bx - ax) * u + ox, z: az + (bz - az) * u + oz, walking: cs[lo] !== cs[lo + 1], surface: hop ? SURF_CROSS : park(u < 0.5 ? cs[lo] : cs[lo + 1]) };
  };

  // Scares: on a footpath or park step, anyone not yet scared within SCARE_M of the step's path.
  events.steps.forEach((s, i) => {
    if (!s.off) return;
    const [ax, az] = centre(s.from), [bx, bz] = centre(s.cell);
    const len2 = (bx - ax) ** 2 + (bz - az) ** 2;
    for (let id = 0; id < n; id++) {
      if (scared.has(id)) continue;
      for (const t of [i + 1, i]) {
        const p = base(id, t);
        const u = len2 ? Math.max(0, Math.min(1, ((p.x - ax) * (bx - ax) + (p.z - az) * (bz - az)) / len2)) : 0;
        const nx = ax + u * (bx - ax), nz = az + u * (bz - az);
        const d = Math.hypot(p.x - nx, p.z - nz);
        if (d > SCARE_M) continue;
        const dx = d > 1e-6 ? (p.x - nx) / d : -(bz - az) / (Math.sqrt(len2) || 1); // straight away from the path
        const dz = d > 1e-6 ? (p.z - nz) / d : (bx - ax) / (Math.sqrt(len2) || 1);
        const sc = { id, tick: i, dx, dz };
        scares.push(sc); scared.set(id, sc);
        break;
      }
    }
  });

  const crossings = folk.flatMap((w) => w.hops);
  return {
    count: n,
    seed,
    scares,
    // The people scared by the first n whole steps. The step i that scares someone counts once step i is done.
    scaresAt: (k) => { let c = 0; for (const s of scares) if (s.tick < k) c++; return c; },
    // Fills out.x, z, y (hop height), walking and scared for every person at trip time t. opts.noJump leaves the jump off.
    fillPoses(t, out, { noJump = false } = {}) {
      for (let id = 0; id < n; id++) {
        const p = base(id, t);
        const sc = noJump ? null : scared.get(id);
        const u = sc ? Math.max(0, Math.min(1, (t - sc.tick) / JUMP_TICKS)) : 0;
        out.x[id] = p.x + (sc ? sc.dx * JUMP_M * u : 0);
        out.z[id] = p.z + (sc ? sc.dz * JUMP_M * u : 0);
        out.y[id] = sc && u > 0 && u < 1 ? Math.sin(Math.PI * u) * 1.2 : 0;
        out.walking[id] = p.walking ? 1 : 0;
        out.scared[id] = sc && t >= sc.tick ? 1 : 0;
        out.surface[id] = p.surface;
      }
    },
    crossings,
    // True while person id is between the kerbs of a crossing at time t.
    crossingAt: (id, t) => folk[id].hops.some((h) => t >= h.tEnter && t <= h.tEnter + h.span),
  };
}
