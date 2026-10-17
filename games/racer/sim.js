// Neural Racer simulation: no DOM, so it runs in tests and in the page alike.
import { createActs, forward, genomeLength } from '../../engine/tinynet.js';
import { randomGenome, nextGeneration } from '../../engine/evolve.js';
import { Lineage } from '../../engine/lineage.js';

export const WORLD_W = 800, WORLD_H = 500, TRACK_W = 54, N = 300;
// Ten cars: few enough to follow by eye, and random luck rarely solves the track in round one.
export const POP = 10, LAPS = 2, MAXF = 3600, STALL = 150;
export const RAY_MAX = 160, RAY_STEP = 3, MAX_SPEED = 4.5, TURN = 0.07, ACCEL = 0.1;
export const SENSOR_ANGLES = [-Math.PI / 3, -Math.PI / 6, 0, Math.PI / 6, Math.PI / 3];
export const SIZES = [6, 8, 2];
export const GENOME = genomeLength(SIZES); // 74
export const IN_LABELS = ['Left 60°', 'Left 30°', 'Ahead', 'Right 30°', 'Right 60°', 'Speed'];
export const OUT_LABELS = ['Steer', 'Throttle'];

// Plain words for the brain panel. Inputs 0-4 are feelers (1 = clear road), 5 is speed; outputs are steer, throttle.
export function describeInput(i, v) {
  if (i === 5) return v < 0.25 ? 'slow' : v < 0.7 ? 'cruising' : 'fast';
  return v >= 0.99 ? 'clear' : v > 0.5 ? 'far' : v > 0.25 ? 'near' : 'close';
}

export function describeOutput(i, v) {
  if (i === 0) return v < -0.15 ? 'turning left' : v > 0.15 ? 'turning right' : 'going straight';
  return v > 0.15 ? 'speeding up' : v < -0.15 ? 'braking' : 'coasting';
}

// Distance as a share of the goal, so "0.4" never reads as a speed.
export function distanceLabel(pct) {
  return `${Math.round(pct) / 100} of ${LAPS} laps`;
}

// A random brain solves the track in round one about one time in five; say so instead of calling it learning.
export function firstFinishNote(gen) {
  if (gen === 1) return `Generation 1: a car finished ${LAPS} laps, but nobody bred it. A random brain got lucky. Watch whether its children can do it reliably: luck finishes once, learning keeps finishing.`;
  return `Generation ${gen}: a car finished ${LAPS} laps. Nobody wrote a single driving rule. Its ancestors just drove slightly better than the others, round after round, and their weights were passed on.`;
}

// ---------- Track ----------
// A star-shaped closed loop: the radius wobbles with a few sine waves, so it never crosses itself.
export function makeTrack(rng = Math.random) {
  const r = (a, b) => a + rng() * (b - a);
  const A1 = r(0.08, 0.18), A2 = r(0.05, 0.12), A3 = r(0.02, 0.06);
  const p1 = r(0, 6.28), p2 = r(0, 6.28), p3 = r(0, 6.28);
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const rad = 1 + A1 * Math.sin(2 * t + p1) + A2 * Math.sin(3 * t + p2) + A3 * Math.sin(5 * t + p3);
    pts.push({ x: 400 + 270 * rad * Math.cos(t), y: 250 + 160 * rad * Math.sin(t) });
  }
  const startAngle = Math.atan2(pts[3].y - pts[0].y, pts[3].x - pts[0].x);
  return { pts, startAngle, grid: buildGrid(pts, TRACK_W / 2) };
}

// Road occupancy as a 1px grid, so sensors and crash checks are O(1) lookups.
// Built by stamping discs along the centerline instead of rasterizing on a canvas.
function buildGrid(pts, half) {
  const grid = new Uint8Array(WORLD_W * WORLD_H);
  const r2 = half * half, SUB = 4;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    for (let s = 0; s < SUB; s++) {
      const cx = a.x + ((b.x - a.x) * s) / SUB, cy = a.y + ((b.y - a.y) * s) / SUB;
      const x0 = Math.max(0, Math.floor(cx - half)), x1 = Math.min(WORLD_W - 1, Math.ceil(cx + half));
      const y0 = Math.max(0, Math.floor(cy - half)), y1 = Math.min(WORLD_H - 1, Math.ceil(cy + half));
      for (let y = y0; y <= y1; y++) {
        const dy = y + 0.5 - cy, row = y * WORLD_W;
        for (let x = x0; x <= x1; x++) {
          const dx = x + 0.5 - cx;
          if (dx * dx + dy * dy <= r2) grid[row + x] = 1;
        }
      }
    }
  }
  return grid;
}

export function onTrack(track, x, y) {
  if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return false;
  return track.grid[(y | 0) * WORLD_W + (x | 0)] === 1;
}

// ---------- Cars ----------
// A saved brain driving on its own from the start line, for the ghost race.
export function makeGhost(genome, track, slot = 0) {
  return makeCar({ id: 0, kind: 'ghost', parents: [], genome }, track, slot);
}

// Where each gene of a child came from: 'a' or 'b' (copied from that parent) or 'm' (mutated).
export function inheritance(child, a, b) {
  return Array.from(child, (g, i) => (g === a[i] ? 'a' : g === b[i] ? 'b' : 'm'));
}

function makeCar(ind, track, slot = 0) {
  const car = { id: ind.id, kind: ind.kind, parents: ind.parents, genome: ind.genome, acts: createActs(SIZES), slot };
  resetCar(car, track);
  return car;
}

// Starting grid: rows of five behind the start line (centre first, then alternating sides), like a real race,
// so no two cars start on the same spot. Progress counts from the line, so a back-row car starts below zero.
const GRID_ROW = 5, GRID_LANE = 9, GRID_GAP = 18;
function gridSpot(track, slot) {
  const pts = track.pts, row = Math.floor(slot / GRID_ROW), k = slot % GRID_ROW;
  const lane = (k % 2 ? -1 : 1) * Math.ceil(k / 2) * GRID_LANE;
  const seg = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
  const back = Math.round((row * GRID_GAP) / seg), j = (N - back) % N;
  const angle = Math.atan2(pts[(j + 3) % N].y - pts[j].y, pts[(j + 3) % N].x - pts[j].x);
  return { x: pts[j].x - Math.sin(angle) * lane, y: pts[j].y + Math.cos(angle) * lane, angle, idx: j, back };
}

function resetCar(c, track) {
  const g = gridSpot(track, c.slot ?? 0);
  c.x = g.x; c.y = g.y; c.angle = g.angle; c.speed = 0;
  c.idx = g.idx; c.prog = -g.back || 0; c.maxProg = 0; c.stall = 0;
  c.alive = true; c.finished = false; c.finishFrame = 0;
  for (const a of c.acts) a.fill(0);
}

export function progressPct(c) {
  return Math.min(LAPS * 100, (c.maxProg / N) * 100);
}

// 1. Sense: march each ray outward until it leaves the road. Fills `input` with the six numbers a brain gets.
export function sense(c, track, input = c.acts[0]) {
  for (let s = 0; s < 5; s++) {
    const a = c.angle + SENSOR_ANGLES[s], ca = Math.cos(a), sa = Math.sin(a);
    let d = RAY_STEP;
    while (d < RAY_MAX && onTrack(track, c.x + ca * d, c.y + sa * d)) d += RAY_STEP;
    input[s] = Math.min(d, RAY_MAX) / RAY_MAX;
  }
  input[5] = c.speed / MAX_SPEED;
  return input;
}

// 3. Act on a steer and throttle in [-1, 1], then track progress, stalls and the finish.
export function drive(c, track, steer, throttle, frame) {
  c.angle += steer * TURN * Math.min(1, c.speed / 1.5);
  c.speed = Math.max(0, Math.min(MAX_SPEED, (c.speed + throttle * ACCEL) * 0.985));
  c.x += Math.cos(c.angle) * c.speed;
  c.y += Math.sin(c.angle) * c.speed;
  if (!onTrack(track, c.x, c.y)) { c.alive = false; c.crashed = true; return; }

  // Progress: nearest centerline point just around where the car was.
  const pts = track.pts;
  let best = c.idx, bd = Infinity;
  for (let k = -4; k <= 16; k++) {
    const j = (c.idx + k + N) % N;
    const dx = pts[j].x - c.x, dy = pts[j].y - c.y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = j; }
  }
  let diff = best - c.idx;
  if (diff > N / 2) diff -= N;
  if (diff < -N / 2) diff += N;
  c.idx = best; c.prog += diff;
  if (c.prog > c.maxProg) { c.maxProg = c.prog; c.stall = 0; } else c.stall++;

  // Stalled or spinning in place: out of the race.
  if (c.stall > STALL) { c.alive = false; return; }
  if (c.maxProg >= N * LAPS) { c.finished = true; c.alive = false; c.finishFrame = frame; }
}

export function stepCar(c, track, frame) {
  // 2. Think: six numbers in, steer and throttle out.
  const out = forward(c.genome, SIZES, sense(c, track), c.acts);
  drive(c, track, out[0], out[1], frame);
}

// ---------- Race ----------
// Kept cars and newcomers are 10% of the population, the parent pool 30%, with floors for tiny populations.
function setPopulation(r, pop) {
  r.pop = pop;
  r.elite = Math.max(1, Math.round(pop * 0.1));
  r.fresh = Math.max(1, Math.round(pop * 0.1));
  r.pool = Math.max(2, Math.round(pop * 0.3));
}

export function createRace({ rng = Math.random, pop = POP } = {}) {
  const r = {
    rng, track: makeTrack(rng), trackNo: 1, mutRate: 0.08,
    gen: 1, frame: 0, history: [], finishHistory: [], allTime: 0, finishedOnce: false,
    lineage: new Lineage(4), nextId: 1, cars: [],
  };
  setPopulation(r, pop);
  seedCars(r);
  return r;
}

function seedCars(r) {
  r.cars = Array.from({ length: r.pop }, (_, i) =>
    makeCar({ id: r.nextId++, kind: 'new', parents: [], genome: randomGenome(GENOME, r.rng) }, r.track, i));
}

function fitness(c) {
  return c.maxProg + (c.finished ? ((MAXF - c.finishFrame) / MAXF) * N : 0);
}

export function endGeneration(r) {
  const ranked = [...r.cars].sort((a, b) => fitness(b) - fitness(a));
  const bestPct = progressPct(ranked[0]);
  const firstFinish = ranked[0].finished && !r.finishedOnce;
  if (ranked[0].finished) r.finishedOnce = true;
  const finishers = r.cars.filter(c => c.finished).length;
  r.history.push(bestPct);
  r.finishHistory.push(finishers);
  r.allTime = Math.max(r.allTime, bestPct);
  r.lineage.record(r.gen, r.cars.map(c => ({
    id: c.id, kind: c.kind, parents: c.parents, score: progressPct(c), crashed: !!c.crashed, finished: c.finished,
  })));

  const next = nextGeneration(ranked, {
    popSize: r.pop, elite: r.elite, fresh: r.fresh, poolSize: r.pool, mutRate: r.mutRate, mutScale: 0.4,
    genomeLength: GENOME, rng: r.rng, newId: () => r.nextId++,
  });
  const summary = {
    gen: r.gen, bestPct, finishers, firstFinish, bestId: ranked[0].id,
    ranked: ranked.map(c => ({ id: c.id, genome: c.genome, pct: progressPct(c), finished: c.finished, crashed: !!c.crashed })),
  };
  r.cars = next.map((ind, i) => makeCar(ind, r.track, i));
  r.gen++;
  r.frame = 0;
  return summary;
}

// Advances one frame. Returns a generation summary when that frame ended the generation.
export function tick(r) {
  let alive = 0;
  for (const c of r.cars) if (c.alive) { stepCar(c, r.track, r.frame); if (c.alive) alive++; }
  r.frame++;
  return alive === 0 || r.frame >= MAXF ? endGeneration(r) : null;
}

export function leaderOf(r) {
  let best = null;
  for (const c of r.cars) if (c.alive && (!best || c.maxProg > best.maxProg)) best = c;
  if (!best) for (const c of r.cars) if (!best || c.maxProg > best.maxProg) best = c;
  return best;
}

export function finishedCount(r) {
  let n = 0;
  for (const c of r.cars) if (c.finished) n++;
  return n;
}

export function aliveCount(r) {
  let n = 0;
  for (const c of r.cars) if (c.alive) n++;
  return n;
}

// The live car plus its recorded ancestors, `depth` generations including itself.
export function pedigree(r, car, depth) {
  return {
    node: { id: car.id, kind: car.kind, gen: r.gen, score: progressPct(car), live: true },
    parents: depth > 1 ? car.parents.map(p => r.lineage.ancestry(p, depth - 1)).filter(Boolean) : [],
  };
}

export function newTrack(r, rng = r.rng) {
  r.track = makeTrack(rng);
  r.trackNo++;
  r.frame = 0;
  for (const c of r.cars) { resetCar(c, r.track); c.crashed = false; }
}

export function restart(r, pop = r.pop) {
  setPopulation(r, pop);
  r.gen = 1; r.frame = 0; r.history = []; r.finishHistory = []; r.allTime = 0; r.finishedOnce = false;
  r.lineage.clear();
  seedCars(r);
}
