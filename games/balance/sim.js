// Balance: a cart with a pole on top. Keep the pole up by pushing the cart left or right.
// No DOM, so it runs in tests and in the page alike. Positive x, v, force and th mean right; th = 0 is upright.
// A rightward force makes th fall (the top tips left relative to the cart).

export const G = 9.8, M_CART = 1.0, M_POLE = 0.1, HALF_POLE = 1.0;
export const DT = 1 / 60, F_MAX = 10, X_LIMIT = 2.4, FAIL_ANGLE = 0.4;
export const LIMIT = 20 * 60;                 // a try lasts at most 20 seconds
export const START_TILT = 0.05;
export const PUSH_DV = 0.8;                   // Push: an instant kick to the cart's speed, m/s
export const WIND_FORCE = 0.6;                // Wind: a steady sideways force, newtons
export const HUMAN_POWER = 0.4;               // fraction of F_MAX a held key applies (tuning knob)

export function newGame(tilt = START_TILT) {
  return { x: 0, v: 0, th: tilt, w: 0, t: 0 };
}

// One step of the classic cart-pole equations, velocities first, then positions.
// u is the push in [-1, 1]; wind is extra newtons. Returns null, 'tilt' or 'rail'.
export function step(g, u, wind = 0) {
  const F = Math.max(-1, Math.min(1, u)) * F_MAX + wind;
  const tot = M_CART + M_POLE, s = Math.sin(g.th), c = Math.cos(g.th);
  const tmp = (F + M_POLE * HALF_POLE * g.w * g.w * s) / tot;
  const thAcc = (G * s - c * tmp) / (HALF_POLE * (4 / 3 - (M_POLE * c * c) / tot));
  const xAcc = tmp - (M_POLE * HALF_POLE * thAcc * c) / tot;
  g.v += xAcc * DT; g.w += thAcc * DT; g.x += g.v * DT; g.th += g.w * DT; g.t++;
  if (Math.abs(g.th) > FAIL_ANGLE) return 'tilt';
  if (Math.abs(g.x) > X_LIMIT) return 'rail';
  return null;
}

// Push: kick the cart's speed by PUSH_DV, to the right (dir 1) or the left (dir -1).
export function push(g, dir) {
  g.v += dir * PUSH_DV;
}

// PID: three dials. Cart centring turns "stay near the middle" into a small lean the pole is asked to hold.
export const K_X = 0.03, K_V = 0.01;          // centring: how hard position and speed lean the target angle
export const CENTER_MAX = 0.1;                // the target angle never exceeds this, radians
export const I_MAX = 3;                       // the I memory is capped, so it cannot wind up forever
export const PID_RANGES = {
  p: { min: 0, max: 60, step: 1, def: 25 },
  i: { min: 0, max: 30, step: 1, def: 0 },
  d: { min: 0, max: 10, step: 0.5, def: 0 },
};

const clamp = (v, m) => Math.max(-m, Math.min(m, v));

export function createPid() {
  return { sum: 0, prev: null };
}

// Returns a normalized force in [-1, 1]. Keeps its memory in pid, so make a fresh one for each try.
export function pidAct(pid, g, { p, i, d }) {
  const ref = -clamp(K_X * g.x + K_V * g.v, CENTER_MAX);
  const e = g.th - ref;
  pid.sum = clamp(pid.sum + e * DT, I_MAX);
  const de = pid.prev === null ? 0 : (e - pid.prev) / DT;
  pid.prev = e;
  return clamp((p * e + i * pid.sum + d * de) / F_MAX, 1);
}

// A try: one game plus one fresh PID memory. outcome is null while it runs, then 'fell' or 'limit'.
export function startTry(tilt = START_TILT) {
  return { g: newGame(tilt), pid: createPid(), outcome: null, reason: null };
}

// One step of a try. Does nothing once the try has ended.
export function advance(run, u, wind = 0) {
  if (run.outcome) return run.outcome;
  const r = step(run.g, u, wind);
  if (r) { run.outcome = 'fell'; run.reason = r; }
  else if (run.g.t >= LIMIT) run.outcome = 'limit';
  return run.outcome;
}

// Push only while the try is running.
export function pushTry(run, dir) {
  if (run.outcome === null) push(run.g, dir);
}

export const seconds = run => run.g.t / 60;

// Keys: arrows or A and D. Both held at once cancel out.
export const KEY_MAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
export const keyDir = held => (held.right ? 1 : 0) - (held.left ? 1 : 0);
