import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../engine/rng.js';
import { createQTable, qValue, bestAction, stateValue, chooseAction, update } from '../engine/qlearn.js';

const row = (q, s, vals) => q.v.set(vals, s * q.nActions);
const share = (counts, n) => counts.map(c => c / n);

describe('createQTable', () => {
  it('starts every value at zero', () => {
    const q = createQTable(3, 4);
    expect(q.v.length).toBe(12);
    expect(Array.from(q.v).every(x => x === 0)).toBe(true);
  });
});

describe('update', () => {
  it('moves halfway toward the reward each time', () => {
    const q = createQTable(2, 4);
    update(q, 0, 1, 1, 1, true, { alpha: 0.5, gamma: 0.9 });
    expect(qValue(q, 0, 1)).toBe(0.5);
    update(q, 0, 1, 1, 1, true, { alpha: 0.5, gamma: 0.9 });
    expect(qValue(q, 0, 1)).toBe(0.75);
  });
  it('returns the change it made', () => {
    const q = createQTable(2, 4);
    expect(update(q, 0, 1, 1, 1, true, { alpha: 0.5, gamma: 0.9 })).toBe(0.5);
  });
  it('ignores the next state when done', () => {
    const a = createQTable(2, 4), b = createQTable(2, 4);
    row(b, 1, [100, 100, 100, 100]);
    update(a, 0, 0, 1, 1, true, { alpha: 0.5, gamma: 0.9 });
    update(b, 0, 0, 1, 1, true, { alpha: 0.5, gamma: 0.9 });
    expect(qValue(b, 0, 0)).toBe(qValue(a, 0, 0));
  });
  it('with gamma 0 only the reward counts', () => {
    const q = createQTable(2, 4);
    row(q, 1, [100, 100, 100, 100]);
    update(q, 0, 0, 2, 1, false, { alpha: 1, gamma: 0 });
    expect(qValue(q, 0, 0)).toBe(2);
  });
  it('adds gamma times the best next value', () => {
    const q = createQTable(2, 4);
    row(q, 1, [0, 5, 2, 0]);
    update(q, 0, 0, 1, 1, false, { alpha: 1, gamma: 0.9 });
    expect(qValue(q, 0, 0)).toBeCloseTo(5.5, 10);
  });
  it('never goes NaN or blows up over 10,000 random updates', () => {
    const q = createQTable(6, 4);
    const rng = mulberry32(3);
    for (let i = 0; i < 10000; i++) {
      update(q, Math.floor(rng() * 6), Math.floor(rng() * 4), rng() * 20 - 10,
        Math.floor(rng() * 6), rng() < 0.5, { alpha: 0.5, gamma: 0.95 });
    }
    for (const x of q.v) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Math.abs(x)).toBeLessThanOrEqual(200);
    }
  });
});

describe('bestAction and stateValue', () => {
  it('picks the largest Q and reports it as the state value', () => {
    const q = createQTable(1, 4);
    row(q, 0, [0, 3, 1, 0]);
    expect(bestAction(q, 0, mulberry32(1))).toBe(1);
    expect(stateValue(q, 0)).toBe(3);
  });
  it('breaks ties evenly: an untrained row explores', () => {
    const q = createQTable(1, 4);
    const rng = mulberry32(1);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) counts[bestAction(q, 0, rng)]++;
    for (const p of share(counts, 4000)) { expect(p).toBeGreaterThan(0.2); expect(p).toBeLessThan(0.3); }
  });
});

describe('chooseAction', () => {
  it('epsilon 0 always takes the best action and draws the rng once', () => {
    const q = createQTable(1, 4);
    row(q, 0, [0, 3, 1, 0]);
    const r = mulberry32(2);
    let calls = 0;
    const rng = () => { calls++; return r(); };
    for (let i = 0; i < 500; i++) expect(chooseAction(q, 0, 0, rng)).toBe(1);
    expect(calls).toBe(500);
  });
  it('epsilon 1 picks every action about equally', () => {
    const q = createQTable(1, 4);
    row(q, 0, [0, 3, 1, 0]);
    const rng = mulberry32(3);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) counts[chooseAction(q, 0, 1, rng)]++;
    for (const p of share(counts, 4000)) { expect(p).toBeGreaterThan(0.2); expect(p).toBeLessThan(0.3); }
  });
});
