// The AI for Balance: a tiny network that senses the cart and pole and pushes. No DOM.
// It trains with small random pushes, never with wind, so switching wind on never retrains it.
import { forward, createActs, genomeLength } from '../../engine/tinynet.js';
import { mulberry32 } from '../../engine/rng.js';
import { randomGenome, nextGeneration } from '../../engine/evolve.js';
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

export const POP = 20, ELITE = 3, FRESH = 3, POOL = 10, MUT_RATE = 0.15, MUT_SCALE = 0.3, TRIES = 2;
const GENOME = genomeLength(SIZES);
// The seed whose run starts by falling in under 3 s and first holds a full 20 s around generation 12-22.
// Chosen by scanning seeds 1-60. The How it works story (B4) reuses it as STORY_SEED.
export const AI_STORY_SEED = 6;

// Evolution that runs unseen: each generation tests every brain, then breeds the next from the best.
export function createTrainer(seed) {
  const rng = mulberry32(seed);
  let nextId = 0;
  const newId = () => nextId++;
  const t = {
    rng, gen: 0, history: [],
    pop: Array.from({ length: POP }, () => ({ id: newId(), genome: randomGenome(GENOME, rng), kind: 'new', parents: [] })),
  };
  t.bestGenome = t.pop[0].genome.slice();
  t.runGeneration = () => {
    const scored = t.pop.map(ind => {
      let sum = 0;
      for (let k = 0; k < TRIES; k++) sum += evaluate(ind.genome, rng);
      return { ...ind, steps: sum / TRIES };
    });
    const ranked = scored.sort((a, b) => b.steps - a.steps);
    const seconds = ranked[0].steps / 60;
    t.gen++;
    t.history.push(seconds);
    t.bestGenome = ranked[0].genome.slice();
    t.pop = nextGeneration(ranked, {
      popSize: POP, elite: ELITE, fresh: FRESH, poolSize: POOL, mutRate: MUT_RATE, mutScale: MUT_SCALE,
      genomeLength: GENOME, rng, newId,
    });
    return { gen: t.gen, seconds, genome: t.bestGenome };
  };
  return t;
}
