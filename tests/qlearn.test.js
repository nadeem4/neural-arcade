import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../engine/rng.js';
import { createQTable, qValue, bestAction, stateValue, chooseAction, update } from '../engine/qlearn.js';

describe('createQTable', () => {
  it('starts every value at zero', () => {
    const q = createQTable(3, 4);
    for (let s = 0; s < 3; s++) for (let a = 0; a < 4; a++) expect(qValue(q, s, a)).toBe(0);
  });
});

describe('update', () => {
  it('moves Q toward reward + gamma * best next value', () => {
    const q = createQTable(2, 2);
    update(q, 1, 0, 0, 1, false, { alpha: 1, gamma: 1 }); // nothing yet
    q.v[1 * 2 + 1] = 4; // best next value is 4
    update(q, 0, 0, 1, 1, false, { alpha: 0.5, gamma: 0.9 });
    expect(qValue(q, 0, 0)).toBeCloseTo(0.5 * (1 + 0.9 * 4), 10);
  });
  it('ignores the next state when the episode is done', () => {
    const q = createQTable(2, 2);
    q.v[2] = 100;
    update(q, 0, 1, 5, 1, true, { alpha: 1, gamma: 0.9 });
    expect(qValue(q, 0, 1)).toBe(5);
  });
  it('with gamma 0 only the reward counts', () => {
    const q = createQTable(2, 2);
    q.v[2] = 100;
    update(q, 0, 0, 2, 1, false, { alpha: 1, gamma: 0 });
    expect(qValue(q, 0, 0)).toBe(2);
  });
  it('stays finite over 10,000 random updates', () => {
    const q = createQTable(6, 4);
    const rng = mulberry32(3);
    for (let i = 0; i < 10000; i++) {
      update(q, Math.floor(rng() * 6), Math.floor(rng() * 4), rng() * 20 - 10,
        Math.floor(rng() * 6), rng() < 0.1, { alpha: 0.5, gamma: 0.9 });
    }
    expect(Array.from(q.v).every(Number.isFinite)).toBe(true);
  });
});

describe('bestAction and stateValue', () => {
  it('picks the largest Q and reports it as the state value', () => {
    const q = createQTable(1, 4);
    q.v.set([0.1, 0.7, -1, 0.3]);
    expect(bestAction(q, 0, mulberry32(1))).toBe(1);
    expect(stateValue(q, 0)).toBe(0.7);
  });
  it('breaks ties at random, using every tied action', () => {
    const q = createQTable(1, 4);
    const rng = mulberry32(2);
    const seen = new Set();
    for (let i = 0; i < 200; i++) seen.add(bestAction(q, 0, rng));
    expect(seen.size).toBe(4);
  });
  it('never picks a non-tied action', () => {
    const q = createQTable(1, 4);
    q.v.set([1, 0, 1, 0]);
    const rng = mulberry32(5);
    for (let i = 0; i < 100; i++) expect([0, 2]).toContain(bestAction(q, 0, rng));
  });
});

describe('chooseAction', () => {
  const q = createQTable(1, 4);
  q.v.set([0, 0, 5, 0]);
  it('epsilon 0 always takes the best action', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 200; i++) expect(chooseAction(q, 0, 0, rng)).toBe(2);
  });
  it('epsilon 1 explores every action', () => {
    const rng = mulberry32(8);
    const seen = new Set();
    for (let i = 0; i < 200; i++) seen.add(chooseAction(q, 0, 1, rng));
    expect(seen.size).toBe(4);
  });
});
