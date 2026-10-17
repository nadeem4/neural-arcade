// Data for the "How it works" write-up: one seeded training run, recorded car by car, so every figure
// is drawn from a real run of the same simulation and tells the same story on every visit.
import { mulberry32 } from '../../engine/rng.js';
import { createRace, tick, progressPct, inheritance } from './sim.js';

// Runs generations until a car finishes (or maxGens), keeping each car's path as flat [x, y, x, y, ...].
export function recordRun(seed, { maxGens = 30, every = 3 } = {}) {
  const r = createRace({ rng: mulberry32(seed) });
  const gens = [];
  let firstFinish = 0;
  while (!firstFinish && r.gen <= maxGens) {
    const cars = r.cars, paths = cars.map(c => [c.x, c.y]);
    let summary = null;
    while (!summary) {
      const wasAlive = cars.map(c => c.alive);
      summary = tick(r);
      cars.forEach((c, i) => {
        if (wasAlive[i] && (!c.alive || r.frame % every === 0 || summary)) paths[i].push(c.x, c.y);
      });
    }
    const rec = cars.map((c, i) => ({
      id: c.id, kind: c.kind, parents: c.parents, genome: c.genome, path: paths[i],
      end: c.finished ? 'finished' : c.crashed ? 'crashed' : 'stalled', pct: progressPct(c),
    }));
    gens.push({ gen: summary.gen, finishers: summary.finishers, cars: rec, best: rec.findIndex(c => c.id === summary.bestId) });
    if (summary.finishers) firstFinish = summary.gen;
  }
  return { seed, track: r.track, gens, firstFinish };
}

// A child of generation 2 bred from two different generation-1 parents, with where each gene came from.
export function childExample(run) {
  const [g1, g2] = run.gens, byId = id => g1.cars.find(c => c.id === id);
  const child = g2.cars.find(c => c.kind === 'child' && c.parents[0] !== c.parents[1]);
  const a = byId(child.parents[0]), b = byId(child.parents[1]);
  return { a, b, child, genes: inheritance(child.genome, a.genome, b.genome) };
}
