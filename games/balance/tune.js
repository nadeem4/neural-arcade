// Tuned PID: evolution sets the three PID dials. No DOM.
import { PID_RANGES, createPid, pidAct, newGame, step, WIND_FORCE, LIMIT, START_TILT } from './sim.js';
import { makePushes } from './ai.js';

export const GENES = 3;

// Squash each gene into its dial's range, then round to the dial's step, so what is shown is exactly what ran.
export function dialsFromGenome(genome) {
  const dial = (gene, { min, max, step }) => {
    const v = min + (max - min) / (1 + Math.exp(-gene));
    return Math.min(max, Math.max(min, min + Math.round((v - min) / step) * step));
  };
  return { p: dial(genome[0], PID_RANGES.p), i: dial(genome[1], PID_RANGES.i), d: dial(genome[2], PID_RANGES.d) };
}

// In the wind test only steps with the cart this close to the middle (metres) score, so a cart that drifts
// off earns nothing. That is what makes the I dial pay off.
export const CENTRE_BAND = 0.5;

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
