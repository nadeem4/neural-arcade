import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../engine/rng.js';
import {
  N, POP, STALL, LAPS, makeTrack, onTrack, createRace, stepCar, tick, endGeneration,
  leaderOf, pedigree, newTrack, restart, progressPct, inheritance, makeGhost,
} from '../games/racer/sim.js';

const race = (seed = 1) => createRace({ rng: mulberry32(seed) });

function runGeneration(r) {
  let summary = null, guard = 0;
  while (!summary && guard++ < 10000) summary = tick(r);
  return summary;
}

describe('track', () => {
  it('starts on the road and leaves the corner off it', () => {
    const t = makeTrack(mulberry32(2));
    expect(t.pts).toHaveLength(N);
    expect(onTrack(t, t.pts[0].x, t.pts[0].y)).toBe(true);
    expect(onTrack(t, 2, 2)).toBe(false);
    expect(onTrack(t, -5, 10)).toBe(false);
  });

  it('is reproducible from a seed', () => {
    expect(makeTrack(mulberry32(9)).pts[17]).toEqual(makeTrack(mulberry32(9)).pts[17]);
  });
});

describe('race', () => {
  it('starts generation 1 with ten random newcomers', () => {
    const r = race();
    expect(r.gen).toBe(1);
    expect(r.cars).toHaveLength(POP);
    r.cars.forEach(c => expect(c.kind).toBe('new'));
  });

  it('senses walls as distances between 0 and 1', () => {
    const r = race();
    const c = r.cars[0];
    stepCar(c, r.track, 0);
    for (let s = 0; s < 5; s++) {
      expect(c.acts[0][s]).toBeGreaterThan(0);
      expect(c.acts[0][s]).toBeLessThanOrEqual(1);
    }
  });

  it('retires a car that never moves after the stall limit', () => {
    const r = race();
    const c = r.cars[0];
    c.genome.fill(0); // every output is tanh(0) = 0: no throttle
    for (let f = 0; f <= STALL + 1 && c.alive; f++) stepCar(c, r.track, f);
    expect(c.alive).toBe(false);
    expect(c.maxProg).toBe(0);
  });

  it('breeds the next generation and records the old one', () => {
    const r = race();
    const firstIds = r.cars.map(c => c.id);
    const summary = runGeneration(r);
    expect(summary.gen).toBe(1);
    expect(r.gen).toBe(2);
    expect(r.history).toHaveLength(1);
    expect(r.history[0]).toBe(summary.bestPct);
    expect(r.cars).toHaveLength(POP);
    firstIds.forEach(id => expect(r.lineage.get(id)).toMatchObject({ gen: 1 }));
    expect(r.cars.filter(c => c.kind === 'kept')).toHaveLength(1);
    expect(r.cars.filter(c => c.kind === 'new')).toHaveLength(1);
  });

  it('counts how many cars finished each generation', () => {
    const r = race();
    r.cars.slice(0, 4).forEach(c => { c.finished = true; c.maxProg = N * LAPS; c.finishFrame = 100; });
    r.cars.forEach(c => { c.alive = false; });
    const s = endGeneration(r);
    expect(s.finishers).toBe(4);
    expect(r.finishHistory).toEqual([4]);
  });

  it('draws the pedigree of a live car back through recorded parents', () => {
    const r = race();
    runGeneration(r);
    const child = r.cars.find(c => c.kind === 'child');
    const tree = pedigree(r, child, 3);
    expect(tree.node.id).toBe(child.id);
    expect(tree.parents.map(p => p.node.id)).toEqual(child.parents);
    tree.parents.forEach(p => expect(p.node.gen).toBe(1));
  });

  it('ranks a finished car above one that only went far', () => {
    const r = race();
    const [a, b] = r.cars;
    a.maxProg = N * LAPS; a.finished = true; a.finishFrame = 3000;
    b.maxProg = N * LAPS - 1;
    r.cars.forEach(c => { c.alive = false; });
    const { ranked } = endGeneration(r);
    expect(ranked.slice(0, 2).map(c => c.id)).toEqual([a.id, b.id]);
    expect(r.cars.find(c => c.kind === 'kept').parents).toEqual([a.id]);
  });

  it('applies the player\'s mutation rate', () => {
    const r = race();
    r.mutRate = 0;
    r.cars.forEach(c => { c.alive = false; });
    endGeneration(r);
    const child = r.cars.find(c => c.kind === 'child');
    const parents = child.parents.map(id => r.lineage.get(id));
    expect(parents.every(Boolean)).toBe(true);
  });

  it('reports the leader as the live car with most progress', () => {
    const r = race();
    r.cars[3].maxProg = 40;
    r.cars[7].maxProg = 90; r.cars[7].alive = false;
    expect(leaderOf(r).id).toBe(r.cars[3].id);
    expect(progressPct(r.cars[3])).toBeCloseTo((40 / N) * 100, 6);
  });

  it('new track keeps the brains and puts every car back on the starting grid', () => {
    const r = race();
    for (let i = 0; i < 30; i++) tick(r);
    const genomes = r.cars.map(c => c.genome);
    newTrack(r, mulberry32(5));
    r.cars.forEach((c, i) => {
      expect(c.genome).toBe(genomes[i]);
      expect(c.alive).toBe(true);
      expect(c.maxProg).toBe(0);
      expect(c.prog).toBeLessThanOrEqual(0);
      expect(onTrack(r.track, c.x, c.y)).toBe(true);
    });
    expect(r.cars[0].x).toBe(r.track.pts[0].x);
    expect(r.trackNo).toBe(2);
  });

  it('restart wipes training back to generation 1', () => {
    const r = race();
    runGeneration(r);
    restart(r);
    expect(r.gen).toBe(1);
    expect(r.history).toEqual([]);
    expect(r.allTime).toBe(0);
    r.cars.forEach(c => expect(c.kind).toBe('new'));
  });
});

describe('breeding moment', () => {
  it('hands back every car of the round, ranked furthest first', () => {
    const r = race(3);
    const summary = runGeneration(r);
    expect(POP).toBe(10);
    expect(summary.ranked).toHaveLength(POP);
    for (let i = 1; i < POP; i++) expect(summary.ranked[i - 1].pct).toBeGreaterThanOrEqual(summary.ranked[i].pct);
    expect(summary.ranked[0].id).toBe(summary.bestId);
    expect(summary.ranked[0].genome).toHaveLength(74);
  });

  it('marks each gene of a child as from parent A, parent B, or mutated', () => {
    const a = Float32Array.from([1, 2, 3, 4]), b = Float32Array.from([5, 6, 7, 8]);
    expect(inheritance(Float32Array.from([1, 6, 3.4, 8]), a, b)).toEqual(['a', 'b', 'm', 'b']);
  });
});

describe('ghost race', () => {
  it('drives a saved brain from the start line, outside the race', () => {
    const r = race(4);
    const best = runGeneration(r).ranked[0];
    const g = makeGhost(best.genome, r.track);
    expect(r.cars).not.toContain(g);
    expect(g.x).toBe(r.track.pts[0].x);
    for (let f = 0; f < 60 && g.alive; f++) stepCar(g, r.track, f);
    expect(g.maxProg).toBeGreaterThan(0);
  });
});

describe('population size', () => {
  it('runs any population, scaling kept cars, newcomers and parents with it', () => {
    const r = createRace({ rng: mulberry32(5), pop: 20 });
    expect(r.cars).toHaveLength(20);
    runGeneration(r);
    expect(r.cars).toHaveLength(20);
    expect(r.cars.filter(c => c.kind === 'kept')).toHaveLength(2);
    expect(r.cars.filter(c => c.kind === 'new')).toHaveLength(2);
    expect(r.pool).toBe(6);
  });

  it('keeps at least one kept car, one newcomer and two parents for tiny populations', () => {
    const r = createRace({ rng: mulberry32(5), pop: 5 });
    expect([r.elite, r.fresh, r.pool]).toEqual([1, 1, 2]);
  });

  it('restarts with a new population size', () => {
    const r = race();
    restart(r, 50);
    expect(r.cars).toHaveLength(50);
    expect(r.gen).toBe(1);
  });
});

describe('starting grid', () => {
  it('lines the cars up in rows on the road, so no two start on the same spot', () => {
    for (const pop of [10, 50]) {
      const r = createRace({ rng: mulberry32(2), pop });
      const spots = new Set(r.cars.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`));
      expect(spots.size).toBe(pop);
      r.cars.forEach(c => expect(onTrack(r.track, c.x, c.y)).toBe(true));
    }
  });

  it('measures every car from the start line, so a back-row car is not credited for the gap', () => {
    const r = race();
    const back = r.cars[r.cars.length - 1];
    expect(back.prog).toBeLessThan(0);
    expect(back.maxProg).toBe(0);
    expect(r.cars[0].prog).toBe(0);
  });

  it('starts the two ghost-race cars side by side', () => {
    const r = race();
    const a = makeGhost(r.cars[0].genome, r.track, 0), b = makeGhost(r.cars[1].genome, r.track, 1);
    expect(`${a.x},${a.y}`).not.toBe(`${b.x},${b.y}`);
  });
});
