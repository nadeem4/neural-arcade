import { randn } from './rng.js';

export function randomGenome(length, rng = Math.random) {
  const g = new Float32Array(length);
  for (let i = 0; i < length; i++) g[i] = randn(rng);
  return g;
}

// Breeds the next population from `ranked` (best first, each { id, genome }).
// kinds: 'kept' = elite copied unchanged, 'new' = random newcomer, 'child' = crossover of two parents plus mutation.
export function nextGeneration(ranked, o) {
  const rng = o.rng ?? Math.random;
  const next = [];
  for (let i = 0; i < o.elite; i++) {
    const p = ranked[i];
    next.push({ id: o.newId(), kind: 'kept', parents: [p.id], genome: p.genome.slice() });
  }
  for (let i = 0; i < o.fresh; i++) {
    next.push({ id: o.newId(), kind: 'new', parents: [], genome: randomGenome(o.genomeLength, rng) });
  }
  const pool = ranked.slice(0, o.poolSize);
  const pick = () => pool[Math.floor(rng() ** 2 * pool.length)]; // squared: biased toward the top
  while (next.length < o.popSize) {
    const a = pick(), b = pick(), g = new Float32Array(o.genomeLength);
    for (let i = 0; i < g.length; i++) {
      g[i] = rng() < 0.5 ? a.genome[i] : b.genome[i];
      if (rng() < o.mutRate) g[i] += randn(rng) * o.mutScale;
    }
    next.push({ id: o.newId(), kind: 'child', parents: [a.id, b.id], genome: g });
  }
  return next;
}
