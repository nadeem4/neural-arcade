// Learning from reward by trial and error (REINFORCE, a policy gradient), for the tiny tanh network.
// The network's outputs become probabilities for each action; the brain samples an action, so it explores.
// After a batch of tries, every action is made more likely if what followed it scored better than expected,
// and less likely if worse. "Expected" comes from a small linear value guess (the baseline), learned alongside.
import { createActs, forward, genomeLength } from './tinynet.js';
import { gradient } from './train.js';
import { randn } from './rng.js';

// Outputs are tanh (between -1 and 1), so they are scaled before the softmax to allow confident choices.
export const TEMP = 3;

export function policy(out, p = new Float64Array(out.length)) {
  let m = -Infinity;
  for (let k = 0; k < out.length; k++) m = Math.max(m, TEMP * out[k]);
  let sum = 0;
  for (let k = 0; k < out.length; k++) { p[k] = Math.exp(TEMP * out[k] - m); sum += p[k]; }
  for (let k = 0; k < out.length; k++) p[k] /= sum;
  return p;
}

export function sample(p, rng) {
  let r = rng(), a = 0;
  while (a < p.length - 1 && (r -= p[a]) > 0) a++;
  return a;
}

// Reward-to-go: each moment's reward plus everything after it, later rewards counting a little less.
export function discount(rewards, gamma) {
  const out = new Array(rewards.length);
  let g = 0;
  for (let i = rewards.length - 1; i >= 0; i--) out[i] = g = rewards[i] + gamma * g;
  return out;
}

// Adam with the whole step clipped to length 1, so one wild batch can't wreck the brain.
function makeAdam(n, lr) {
  const m = new Float64Array(n), v = new Float64Array(n);
  let t = 0;
  return (params, grad) => {
    let norm = 0;
    for (let i = 0; i < n; i++) norm += grad[i] * grad[i];
    const c = Math.sqrt(norm) > 1 ? 1 / Math.sqrt(norm) : 1;
    t++;
    for (let i = 0; i < n; i++) {
      const g = grad[i] * c;
      m[i] = 0.9 * m[i] + 0.1 * g;
      v[i] = 0.999 * v[i] + 0.001 * g * g;
      params[i] -= (lr * m[i] / (1 - 0.9 ** t)) / (Math.sqrt(v[i] / (1 - 0.999 ** t)) + 1e-8);
    }
  };
}

export function createLearner(sizes, rng, { lr = 0.01, gamma = 0.99, init = 0.2, valueLr = 0.05 } = {}) {
  const n = genomeLength(sizes);
  return {
    sizes, gamma, valueLr,
    genome: Float64Array.from({ length: n }, () => randn(rng) * init),
    value: new Float64Array(sizes[0] + 1), // a linear guess of the score to come: one weight per input, plus a bias
    acts: createActs(sizes), step: makeAdam(n, lr),
  };
}

// One decision: run the brain, turn its outputs into probabilities, pick an action by chance.
export function choose(L, input, rng) {
  const out = Float64Array.from(forward(L.genome, L.sizes, input, L.acts));
  const p = policy(out);
  return { a: sample(p, rng), p, out };
}

function guess(L, input) {
  let v = L.value[input.length];
  for (let i = 0; i < input.length; i++) v += L.value[i] * input[i];
  return v;
}

// Learn from a batch of tries. Each try is a list of steps { input, out, p, a, rew }. `beta` rewards keeping
// some uncertainty (entropy), so it keeps exploring instead of settling too early.
export function update(L, tries, beta = 0) {
  const steps = [];
  for (const t of tries) {
    const G = discount(t.map(s => s.rew), L.gamma);
    t.forEach((s, i) => steps.push({ ...s, G: G[i], v: guess(L, s.input) }));
  }
  // Advantage: how much better than its guess each moment turned out, scaled to a common size across the batch.
  let mean = 0, sd = 0;
  for (const s of steps) mean += s.G - s.v;
  mean /= steps.length;
  for (const s of steps) sd += (s.G - s.v - mean) ** 2;
  sd = Math.sqrt(sd / steps.length) || 1;

  // train.js's gradient pushes outputs towards targets, so the policy gradient is written as a target per output.
  const data = steps.map(s => {
    const A = (s.G - s.v - mean) / sd, K = s.p.length;
    let H = 0;
    for (let k = 0; k < K; k++) H -= s.p[k] * Math.log(s.p[k] + 1e-12);
    const target = new Float64Array(K);
    for (let k = 0; k < K; k++) {
      const dz = -A * ((k === s.a ? 1 : 0) - s.p[k]) + beta * s.p[k] * (Math.log(s.p[k] + 1e-12) + H);
      target[k] = s.out[k] - TEMP * dz;
    }
    return { input: s.input, target };
  });
  L.step(L.genome, gradient(L.genome, L.sizes, data).grad);

  // The value guess takes one averaged step towards the scores that actually came.
  const n = L.value.length - 1, vg = new Float64Array(n + 1);
  for (const s of steps) {
    const err = s.G - s.v;
    for (let i = 0; i < n; i++) vg[i] += err * s.input[i];
    vg[n] += err;
  }
  for (let i = 0; i <= n; i++) L.value[i] += (L.valueLr * vg[i]) / steps.length;
}
