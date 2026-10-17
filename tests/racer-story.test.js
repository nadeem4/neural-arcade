import { describe, it, expect } from 'vitest';
import { recordRun, childExample } from '../games/racer/story-data.js';
import { POP } from '../games/racer/sim.js';

const run = recordRun(7, { maxGens: 25 });

describe('recorded run for the write-up', () => {
  it('is the same every time for the same seed', () => {
    const again = recordRun(7, { maxGens: 25 });
    expect(again.firstFinish).toBe(run.firstFinish);
    expect(again.gens[0].cars[3].path).toEqual(run.gens[0].cars[3].path);
  });

  it('records every generation up to and including the first finish', () => {
    expect(run.firstFinish).toBeGreaterThan(0);
    expect(run.gens).toHaveLength(run.firstFinish);
    run.gens.forEach((g, i) => {
      expect(g.gen).toBe(i + 1);
      expect(g.finishers > 0).toBe(i === run.gens.length - 1);
    });
  });

  it('keeps every car path, how it ended and how far it got', () => {
    for (const g of run.gens) {
      expect(g.cars).toHaveLength(POP);
      for (const c of g.cars) {
        expect(c.path.length).toBeGreaterThanOrEqual(4);
        expect(c.path.length % 2).toBe(0);
        expect(['crashed', 'finished', 'stalled']).toContain(c.end);
        expect(c.pct).toBeGreaterThanOrEqual(0);
      }
      const best = g.cars[g.best];
      expect(Math.max(...g.cars.map(c => c.pct))).toBe(best.pct);
    }
  });

  it('finds a child of generation 2 with two different parents from generation 1', () => {
    const ex = childExample(run);
    expect(ex.a).not.toBe(ex.b);
    expect(run.gens[0].cars).toContain(ex.a);
    expect(run.gens[0].cars).toContain(ex.b);
    expect(ex.genes).toHaveLength(ex.child.genome.length);
    expect(ex.genes.every(k => k === 'a' || k === 'b' || k === 'm')).toBe(true);
  });
});

describe('the run the write-up tells (seed 307)', () => {
  const told = recordRun(307);
  it('has no lucky finish in round one, a steady climb, and a first finish in generation 5', () => {
    expect(told.firstFinish).toBe(5);
    expect(told.gens[0].cars.filter(c => c.end === 'crashed').length).toBeGreaterThanOrEqual(6);
    const best = told.gens.map(g => g.cars[g.best].pct);
    best.forEach((b, i) => { if (i) expect(b).toBeGreaterThanOrEqual(best[i - 1]); });
    expect(told.gens[1].cars.filter(c => c.kind === 'new')).toHaveLength(1);
  });
});
