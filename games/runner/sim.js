// Coin Runner: a short side-scrolling level, and a hero whose brain learns to play it from reward alone.
// No DOM, so it runs in tests and in the page alike. Units are tiles; y points up; the ground's top is at y = 2.
import { mulberry32 } from '../../engine/rng.js';
import { createLearner, choose, update } from '../../engine/reinforce.js';

// ---------- The level ----------
export const W = 48, GROUND = 2, FLAG_X = 45;
export const PITS = [[14, 15], [24, 25]];   // columns with no ground (inclusive)
export const BLOCK = { x: 1, y: 5 };        // the coin block, right above the start: pays a coin every time it is bumped from below
export const STEP = { x: 38, h: 1 };        // a one-tile step to hop
export const COINS = [9, 11, 20, 30, 34];   // coins lying on the ground
export const ENEMY = { from: 30, to: 35, speed: 2 }; // walks back and forth; landing on it squashes it

export const isPit = x => PITS.some(([a, b]) => x >= a && x <= b);
export function solid(tx, ty) {
  if (tx < 0 || tx >= W) return true;
  if (ty < 0) return false;
  if (ty < GROUND) return !isPit(tx);
  if (tx === BLOCK.x && ty === BLOCK.y) return true;
  return tx === STEP.x && ty < GROUND + STEP.h;
}

// ---------- Physics, 60 steps a second ----------
export const DT = 1 / 60, HW = 0.8, HH = 0.9, RUN = 7;
// A jump 3.5 tiles high that peaks after 0.35 s, falling faster than it rises (it feels less floaty).
const JUMP_H = 3.5, APEX_T = 0.35;
export const G = (2 * JUMP_H) / APEX_T ** 2, V0 = (2 * JUMP_H) / APEX_T, FALL_G = G * 1.8;
// A try lasts at most 20 seconds; the brain picks an action every 7 steps (about 8.5 times a second).
export const LIMIT = 20 * 60, DECIDE = 7;

export function newGame() {
  return { x: 1, y: GROUND, vx: 0, vy: 0, onGround: true, armed: true, coins: COINS.slice(),
    ex: ENEMY.from, edir: 1, eAlive: true, t: 0, maxX: 1 };
}

function overlaps(x, y) {
  for (let tx = Math.floor(x); tx <= Math.floor(x + HW - 1e-6); tx++)
    for (let ty = Math.floor(y); ty <= Math.floor(y + HH - 1e-6); ty++) if (solid(tx, ty)) return { tx, ty };
  return null;
}

// The four things it can do. No walking left: everything worth doing is to the right or right here.
export const ACTIONS = ['Wait', 'Run', 'Leap', 'Jump']; // Leap: run and jump

// One step. Returns what happened, for scoring and for the drawing's effects.
export function step(g, action) {
  const ev = { coins: 0, died: false, finished: false, stomped: false, bumped: false, jumped: false, landed: false };
  g.vx = action === 1 || action === 2 ? RUN : 0;
  if ((action === 2 || action === 3) && g.onGround) { g.vy = V0; g.onGround = false; ev.jumped = true; }
  g.vy -= (g.vy > 0 ? G : FALL_G) * DT;

  let nx = g.x + g.vx * DT, hit = overlaps(nx, g.y);
  if (hit) nx = g.vx > 0 ? hit.tx - HW : hit.tx + 1;
  g.x = nx;

  let ny = g.y + g.vy * DT;
  hit = overlaps(g.x, ny);
  const wasGround = g.onGround;
  g.onGround = false;
  if (hit) {
    if (g.vy < 0) {
      ny = hit.ty + 1; g.onGround = true;
      if (!wasGround) { g.armed = true; ev.landed = true; }
    } else {
      ny = hit.ty - HH;
      if (hit.tx === BLOCK.x && hit.ty === BLOCK.y && g.armed) { ev.coins++; ev.bumped = true; g.armed = false; }
    }
    g.vy = 0;
  }
  g.y = ny;

  for (let i = g.coins.length - 1; i >= 0; i--) {
    const c = g.coins[i];
    if (g.x + HW > c && g.x < c + 1 && g.y < GROUND + 1) { g.coins.splice(i, 1); ev.coins++; }
  }

  g.ex += g.edir * ENEMY.speed * DT;
  if (g.ex > ENEMY.to) g.edir = -1; else if (g.ex < ENEMY.from) g.edir = 1;
  if (g.eAlive && g.x + HW > g.ex && g.x < g.ex + 0.9 && g.y < GROUND + 0.9) {
    if (g.vy < 0 && g.y > GROUND + 0.3) { g.eAlive = false; g.vy = V0 * 0.5; ev.stomped = true; }
    else ev.died = true;
  }
  if (g.y < -1) ev.died = true;
  if (g.x >= FLAG_X) ev.finished = true;
  g.t++;
  return ev;
}

// ---------- What it senses: twelve numbers ----------
export const N_IN = 12;
export const RUNNER_SIZES = [N_IN, 8, ACTIONS.length]; // 140 weights
export const IN_LABELS = ['Pit 1 ahead', 'Pit 2 ahead', 'Pit 3 ahead', 'Wall ahead', 'Enemy gap', 'Enemy near',
  'On ground', 'Rising', 'Under block', 'Block ready', 'How far', 'Time left'];

export function sense(g, out) {
  const front = Math.floor(g.x + HW);
  for (let k = 0; k < 3; k++) out[k] = isPit(front + k) ? 1 : -1;
  out[3] = solid(front, GROUND) && g.y < GROUND + 1 ? 1 : -1;
  const dx = g.ex - g.x, near = g.eAlive && dx > -1 && dx < 8;
  out[4] = near ? Math.max(-1, Math.min(1, dx / 6)) : 1;
  out[5] = near ? 1 : -1;
  out[6] = g.onGround ? 1 : -1;
  out[7] = Math.max(-1, Math.min(1, g.vy / 20));
  out[8] = Math.abs(g.x + HW / 2 - (BLOCK.x + 0.5)) < 0.6 ? 1 : -1;
  out[9] = g.armed ? 1 : -1;
  out[10] = (g.x / W) * 2 - 1;
  out[11] = 1 - (2 * g.t) / LIMIT;
  return out;
}

export function describeInput(i, v) {
  if (i <= 3) return v > 0 ? 'yes' : 'no';
  if (i === 4) return v >= 1 ? 'far' : `${Math.max(0, Math.round(v * 6))} tiles`;
  if (i === 5 || i === 6 || i === 8 || i === 9) return v > 0 ? 'yes' : 'no';
  if (i === 7) return v > 0.05 ? 'going up' : v < -0.05 ? 'falling' : 'no';
  if (i === 10) return `${Math.round(((v + 1) / 2) * 100)}%`;
  return `${Math.max(0, Math.round(((v + 1) / 2) * 20))} s`;
}

// ---------- The reward rules ----------
// What each slider pays. `second` is per second alive: negative is a cost for taking time, positive pays for staying alive.
export const RULES = {
  flag: { name: 'Reaching the flag', min: 0, max: 50, step: 1 },
  coin: { name: 'Each coin', min: 0, max: 5, step: 0.5 },
  progress: { name: 'Each new tile forward', min: 0, max: 2, step: 0.1 },
  death: { name: 'Dying costs', min: 0, max: 50, step: 1 },
  second: { name: 'Each second alive', min: -1, max: 1, step: 0.1 },
};
export const PRESETS = {
  balanced: { name: 'Balanced', rules: { flag: 30, coin: 0.5, progress: 1, death: 5, second: -0.5 } },
  coinHungry: { name: 'Coin hungry', rules: { flag: 1, coin: 3, progress: 0, death: 2, second: 0 } },
  afraid: { name: 'Afraid of dying', rules: { flag: 0, coin: 0, progress: 0, death: 50, second: 1 } },
};

// The reward for one step, given what happened in it. Progress pays only for new ground, so pacing back and forth earns nothing.
export function scoreFrame(g, ev, rules) {
  let r = ev.coins * rules.coin + rules.second * DT;
  if (g.x > g.maxX) { r += (g.x - g.maxX) * rules.progress; g.maxX = g.x; }
  if (ev.died) r -= rules.death;
  if (ev.finished) r += rules.flag;
  return r;
}

// ---------- Tries ----------
// A try as a sequence of steps that the page can show frame by frame and the trainer can run flat out.
export function startTry(L, rules, rng) {
  return { L, rules, rng, g: newGame(), steps: [], input: new Float32Array(N_IN), current: null,
    outcome: null, coins: 0, score: 0, frameEvents: null };
}
// Advance one 60 Hz step. Returns the step's events; `run.outcome` is set when the try ends.
export function tick(run) {
  const { g } = run;
  if (g.t % DECIDE === 0) {
    const input = Float32Array.from(sense(g, run.input));
    const c = choose(run.L, input, run.rng);
    run.current = { input, out: c.out, p: c.p, a: c.a, rew: 0 };
    run.steps.push(run.current);
  }
  const ev = step(g, run.current.a);
  const r = scoreFrame(g, ev, run.rules);
  run.current.rew += r; run.score += r; run.coins += ev.coins;
  if (ev.died) run.outcome = 'died';
  else if (ev.finished) run.outcome = 'finished';
  else if (g.t >= LIMIT) run.outcome = 'timeout';
  run.frameEvents = ev;
  return ev;
}
export function playTry(L, rules, rng) {
  const run = startTry(L, rules, rng);
  while (!run.outcome) tick(run);
  return run;
}

// ---------- Learning ----------
// Twelve tries per update; the reward for exploring fades over the first TRY_BUDGET tries, then stays small.
export const BATCH = 12, TRY_BUDGET = 4000;
export const exploration = tries => Math.max(0.001, 0.01 * (1 - tries / TRY_BUDGET));

export function createTrainer(rules, seed) {
  const rng = mulberry32(seed);
  const tr = { rules, rng, L: createLearner(RUNNER_SIZES, rng), batch: [], tries: 0, updates: 0, history: [] };
  // Add a finished try (played here, or shown on the page) to the batch; learn when the batch is full.
  tr.learnFrom = run => {
    tr.batch.push(run.steps); tr.tries++;
    tr.history.push({ outcome: run.outcome, coins: run.coins, maxX: run.g.maxX, score: run.score });
    if (tr.batch.length === BATCH) { update(tr.L, tr.batch, exploration(tr.tries)); tr.batch = []; tr.updates++; }
  };
  tr.start = () => startTry(tr.L, tr.rules, tr.rng);
  tr.runTry = () => { const run = playTry(tr.L, tr.rules, tr.rng); tr.learnFrom(run); return run; };
  return tr;
}
