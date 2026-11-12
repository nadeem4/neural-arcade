// Tuned PID: evolution sets the three PID dials. No DOM.
import { PID_RANGES } from './sim.js';

export const GENES = 3;

// Squash each gene into its dial's range, then round to the dial's step, so what is shown is exactly what ran.
export function dialsFromGenome(genome) {
  const dial = (gene, { min, max, step }) => {
    const v = min + (max - min) / (1 + Math.exp(-gene));
    return Math.min(max, Math.max(min, min + Math.round((v - min) / step) * step));
  };
  return { p: dial(genome[0], PID_RANGES.p), i: dial(genome[1], PID_RANGES.i), d: dial(genome[2], PID_RANGES.d) };
}
