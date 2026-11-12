// Tuned PID: evolution sets the three PID dials. No DOM.
import { PID_RANGES, createPid, pidAct, newGame, step, WIND_FORCE, LIMIT, START_TILT } from './sim.js';
import { makePushes } from './ai.js';
import { mulberry32 } from '../../engine/rng.js';
import { randomGenome, nextGeneration } from '../../engine/evolve.js';

export const GENES = 3;

// Squash each gene into its dial's range, then round to the dial's step, so what is shown is exactly what ran.
export function dialsFromGenome(genome) {
  const dial = (gene, { min, max, step }) => {
    const v = min + (max - min) / (1 + Math.exp(-gene));
    return Math.min(max, Math.max(min, min + Math.round((v - min) / step) * step));
  };
  return { p: dial(genome[0], PID_RANGES.p), i: dial(genome[1], PID_RANGES.i), d: dial(genome[2], PID_RANGES.d) };
}

// Chosen by trying 0.5, 0.25 and 0.12: at 0.5 almost any random dials already hold 20 s, leaving evolution nothing to find.
// In the wind test only steps with the cart this close to the middle (metres) score, so a cart that drifts
// off earns nothing. That is what makes the I dial pay off.
export const CENTRE_BAND = 0.25;

// Steps survived (0..LIMIT) in one test; `inBand` limits scoring to steps near the middle.
function runTest(dials, tilt, wind, pushes, inBand) {
  const g = newGame(tilt), pid = createPid();
  let score = 0;
  while (g.t < LIMIT) {
    for (const p of pushes) if (p.t === g.t) g.v += p.dir * p.dv;
    if (step(g, pidAct(pid, g, dials), wind)) break;
    if (!inBand || Math.abs(g.x) <= CENTRE_BAND) score++;
  }
  return score;
}

// Average of two tests, in steps: random shoves, then steady wind with the cart kept near the middle.
export function evaluate(dials, rng) {
  const shove = runTest(dials, (rng() * 2 - 1) * START_TILT, 0, makePushes(rng), false);
  const wind = runTest(dials, (rng() * 2 - 1) * START_TILT, WIND_FORCE, [], true);
  return Math.round((shove + wind) / 2);
}

export const TUNE_POP = 20, TUNE_ELITE = 3, TUNE_FRESH = 0, TUNE_POOL = 10, TUNE_MUT_RATE = 0.4, TUNE_MUT_SCALE = 0.5, TUNE_TRIES = 2;
// The first population starts at this gene offset (sigmoid about 0.05), so the dials begin near zero, untuned.
export const INIT_OFFSET = -3;
export const TUNER_STORY_SEED = 59; // scanned seeds 1-60: starts at 2.5 s with P7 I1 D0.5, first holds 18 s at generation 15 and 20 s at 23, ends P59 I29 D2

// Evolution that runs unseen: each generation scores every set of dials, then breeds the next from the best.
export function createTuner(seed) {
  const rng = mulberry32(seed);
  let nextId = 0;
  const newId = () => nextId++;
  const t = {
    gen: 0, history: [], dialsHistory: [],
    pop: Array.from({ length: TUNE_POP }, () => ({ id: newId(), genome: randomGenome(GENES, rng).map(g => g + INIT_OFFSET), kind: 'new', parents: [] })),
  };
  t.bestGenome = t.pop[0].genome.slice();
  t.bestDials = dialsFromGenome(t.bestGenome);
  t.runGeneration = () => {
    const ranked = t.pop.map(ind => {
      const dials = dialsFromGenome(ind.genome);
      let sum = 0;
      for (let k = 0; k < TUNE_TRIES; k++) sum += evaluate(dials, rng);
      return { ...ind, steps: sum / TUNE_TRIES };
    }).sort((a, b) => b.steps - a.steps);
    const seconds = ranked[0].steps / 60;
    t.gen++;
    t.bestGenome = ranked[0].genome.slice();
    t.bestDials = dialsFromGenome(t.bestGenome);
    t.history.push(seconds);
    t.dialsHistory.push(t.bestDials);
    t.pop = nextGeneration(ranked, {
      popSize: TUNE_POP, elite: TUNE_ELITE, fresh: TUNE_FRESH, poolSize: TUNE_POOL, mutRate: TUNE_MUT_RATE,
      mutScale: TUNE_MUT_SCALE, genomeLength: GENES, rng, newId,
    });
    return { gen: t.gen, seconds, dials: t.bestDials };
  };
  return t;
}
