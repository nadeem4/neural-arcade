import { describe, it, expect } from 'vitest';
import { mulberry32, randn } from '../engine/rng.js';
import { randomGenome, nextGeneration } from '../engine/evolve.js';

const counter = () => { let n = 100; return () => ++n; };

function ranked(count, len) {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1, genome: new Float32Array(len).fill(i) }));
}

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(7), b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('randn has roughly zero mean and unit spread', () => {
    const r = mulberry32(1);
    const xs = Array.from({ length: 5000 }, () => randn(r));
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length);
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.abs(sd - 1)).toBeLessThan(0.05);
  });
});

describe('evolve', () => {
  const opts = (over = {}) => ({ popSize: 20, elite: 3, fresh: 2, poolSize: 6, mutRate: 0, mutScale: 0.4, genomeLength: 4, rng: mulberry32(3), newId: counter(), ...over });

  it('makes a random genome of the right length', () => {
    expect(randomGenome(74, mulberry32(1))).toHaveLength(74);
  });

  it('keeps the population size', () => {
    expect(nextGeneration(ranked(20, 4), opts())).toHaveLength(20);
  });

  it('copies the elite unchanged and records each as its own parent', () => {
    const next = nextGeneration(ranked(20, 4), opts());
    const kept = next.filter(c => c.kind === 'kept');
    expect(kept).toHaveLength(3);
    kept.forEach((c, i) => {
      expect(Array.from(c.genome)).toEqual([i, i, i, i]);
      expect(c.parents).toEqual([i + 1]);
    });
  });

  it('adds random newcomers with no parents', () => {
    const fresh = nextGeneration(ranked(20, 4), opts()).filter(c => c.kind === 'new');
    expect(fresh).toHaveLength(2);
    fresh.forEach(c => expect(c.parents).toEqual([]));
  });

  it('breeds offspring only from the top of the pool', () => {
    const kids = nextGeneration(ranked(20, 4), opts()).filter(c => c.kind === 'child');
    expect(kids).toHaveLength(15);
    kids.forEach(c => {
      expect(c.parents).toHaveLength(2);
      c.parents.forEach(p => expect(p).toBeLessThanOrEqual(6));
      // With no mutation every gene comes from one of the two parents.
      c.genome.forEach(g => expect(c.parents.map(p => p - 1)).toContain(g));
    });
  });

  it('mutation changes genes when the rate is 1', () => {
    const kids = nextGeneration(ranked(20, 4), opts({ mutRate: 1 })).filter(c => c.kind === 'child');
    const untouched = kids.flatMap(c => Array.from(c.genome)).filter(g => Number.isInteger(g));
    expect(untouched).toHaveLength(0);
  });

  it('gives every individual a fresh unique id', () => {
    const ids = nextGeneration(ranked(20, 4), opts()).map(c => c.id);
    expect(new Set(ids).size).toBe(20);
    ids.forEach(id => expect(id).toBeGreaterThan(100));
  });
});
