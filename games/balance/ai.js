// The AI for Balance: a tiny network that senses the cart and pole and pushes. No DOM.
// It trains with small random pushes, never with wind, so switching wind on never retrains it.
import { forward, createActs } from '../../engine/tinynet.js';
import { newGame, step, X_LIMIT, FAIL_ANGLE, LIMIT, START_TILT, PUSH_DV } from './sim.js';

export const SIZES = [4, 6, 1];               // 37 weights
export const IN_LABELS = ['Cart position', 'Cart speed', 'Pole angle', 'Pole spin'];
export const OUT_LABELS = ['Push'];

const clamp1 = v => Math.max(-1, Math.min(1, v));

// What the brain sees, each scaled to [-1, 1].
export function sense(g, out = new Float32Array(4)) {
  out[0] = clamp1(g.x / X_LIMIT);
  out[1] = clamp1(g.v / 2);
  out[2] = clamp1(g.th / FAIL_ANGLE);
  out[3] = clamp1(g.w / 3);
  return out;
}

// The normalized force in [-1, 1].
export function aiAct(genome, g, acts, input) {
  sense(g, input);
  return forward(genome, SIZES, input, acts)[0];
}

export const TRAIN_PUSHES = 3;

export function makePushes(rng, n = TRAIN_PUSHES) {
  const list = [];
  for (let i = 0; i < n; i++) {
    list.push({
      t: 60 + Math.floor(rng() * (LIMIT - 120 + 1)),
      dir: rng() < 0.5 ? -1 : 1,
      dv: (0.5 + 0.5 * rng()) * PUSH_DV,
    });
  }
  return list;
}

// Steps one try survives (0..LIMIT): a random small tilt and a few random pushes.
export function evaluate(genome, rng) {
  const g = newGame((rng() * 2 - 1) * START_TILT);
  const pushes = makePushes(rng), acts = createActs(SIZES), input = new Float32Array(4);
  while (g.t < LIMIT) {
    for (const p of pushes) if (p.t === g.t) g.v += p.dir * p.dv;
    if (step(g, aiAct(genome, g, acts, input))) break;
  }
  return g.t;
}
