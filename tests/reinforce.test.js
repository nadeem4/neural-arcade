import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../engine/rng.js';
import { policy, sample, discount, createLearner, choose, update } from '../engine/reinforce.js';

describe('policy', () => {
  it('turns outputs into probabilities that sum to one, favouring the biggest output', () => {
    const p = policy(Float32Array.of(0.9, -0.2, 0.1, -0.9));
    expect(p.reduce((a, b) => a + b)).toBeCloseTo(1, 10);
    expect(Math.max(...p)).toBe(p[0]);
    expect(p.every(v => v > 0)).toBe(true);
  });
});

describe('sample', () => {
  it('picks each action about as often as its probability', () => {
    const rng = mulberry32(1), counts = [0, 0, 0];
    for (let i = 0; i < 6000; i++) counts[sample([0.5, 0.3, 0.2], rng)]++;
    expect(counts[0] / 6000).toBeCloseTo(0.5, 1);
    expect(counts[2] / 6000).toBeCloseTo(0.2, 1);
  });
});

describe('discount', () => {
  it('adds up each reward with the discounted rewards that follow it', () => {
    expect(discount([1, 0, 2], 0.5)).toEqual([1.5, 1, 2]);
  });
});

describe('update', () => {
  it('makes an action that scored better than usual more likely', () => {
    const rng = mulberry32(3), L = createLearner([2, 4, 2], rng);
    const input = Float32Array.of(0.3, -0.5);
    const before = choose(L, input, rng).p[0];
    const step = (a, rew) => { const c = choose(L, input, rng); return { input, out: c.out, p: c.p, a, rew }; };
    for (let i = 0; i < 20; i++) update(L, [[step(0, 1)], [step(1, 0)]], 0);
    expect(choose(L, input, rng).p[0]).toBeGreaterThan(Math.max(0.8, before));
  });

  it('learns a two-armed bandit from its own tries', () => {
    const rng = mulberry32(9), L = createLearner([1, 4, 2], rng), input = Float32Array.of(1);
    for (let u = 0; u < 60; u++) {
      const eps = [];
      for (let b = 0; b < 8; b++) {
        const c = choose(L, input, rng);
        eps.push([{ input, out: c.out, p: c.p, a: c.a, rew: c.a === 1 ? 1 : 0 }]);
      }
      update(L, eps, 0.01);
    }
    expect(choose(L, input, rng).p[1]).toBeGreaterThan(0.9);
  });

  it('never produces invalid numbers, even with huge rewards', () => {
    const rng = mulberry32(5), L = createLearner([3, 4, 3], rng), input = Float32Array.of(1, 0, -1);
    for (let u = 0; u < 50; u++) {
      const eps = [];
      for (let b = 0; b < 4; b++) {
        const steps = [];
        for (let t = 0; t < 30; t++) { const c = choose(L, input, rng); steps.push({ input, out: c.out, p: c.p, a: c.a, rew: c.a * 500 - 200 }); }
        eps.push(steps);
      }
      update(L, eps, 0.01);
    }
    expect(L.genome.some(Number.isNaN)).toBe(false);
    expect(L.value.some(Number.isNaN)).toBe(false);
  });
});
