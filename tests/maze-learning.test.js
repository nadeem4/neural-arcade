import { describe, it, expect } from 'vitest';
import {
  MAP_IDS, STEP_CAP, loadMap, createAgent, trainEpisodes, greedyWalk, valueGrid, policyGrid,
} from '../games/maze/sim.js';

const P = (gamma, epsilon = 0.5) => ({ alpha: 0.5, gamma, epsilon });
const trained = (id, seed, n, params) => trainEpisodes(createAgent(id, seed), n, params);

describe('lesson 1: the discount picks the treasure', () => {
  it('low discount heads to the near treasure, high discount to the far one', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const low = greedyWalk(trained('near-or-far', seed, 3000, P(0.5)));
      expect(low.outcome).toBe('small');
      expect(low.path.length - 1).toBe(2);
      const high = greedyWalk(trained('near-or-far', seed, 3000, P(0.95)));
      expect(high.outcome).toBe('big');
      expect(high.path.length - 1).toBe(5);
    }
  });
});

describe('lesson 2: the cliff punishes exploring', () => {
  const pits = eps => trained('cliff-edge', 1, 500, P(0.9, eps)).history.filter(r => r < -9).length;
  it('falls in far more often with high exploration', () => {
    expect(pits(0.3)).toBeGreaterThan(pits(0.02) * 3);
  });
  it('a lightly exploring agent still finds the treasure in at most 8 moves', () => {
    const walk = greedyWalk(trained('cliff-edge', 1, 500, P(0.9, 0.02)));
    expect(walk.outcome).toBe('big');
    expect(walk.path.length - 1).toBeLessThanOrEqual(8);
  });
});

describe('value spreads backward', () => {
  it('falls with distance from the big treasure, and is 0 on walls and terminals', () => {
    const a = trained('near-or-far', 1, 3000, P(0.9));
    const v = valueGrid(a);
    // up the left column: 6 is beside the treasure, 30 is the start
    for (const s of [6, 12, 18, 24]) expect(v[s]).toBeGreaterThan(v[s + 6]);
    a.map.cells.forEach((c, s) => { if (c === '#' || 'TNP'.includes(c)) expect(v[s]).toBe(0); });
  });
});

describe('stability', () => {
  it('every Q stays finite and within -11..10 at gamma 0.99, 1.0 and 0', () => {
    for (const id of MAP_IDS) {
      for (const gamma of [0.99, 1.0, 0.0]) {
        const a = trained(id, 1, 3000, P(gamma));
        for (const x of a.q.v) {
          expect(Number.isFinite(x)).toBe(true);
          expect(x).toBeGreaterThanOrEqual(-11);
          expect(x).toBeLessThanOrEqual(10);
        }
      }
    }
  });
});

describe('policyGrid', () => {
  it('is all null before training, then has arrows on floor only', () => {
    const a = createAgent('near-or-far', 1);
    expect(policyGrid(a).every(x => x === null)).toBe(true);
    trainEpisodes(a, 500, P(0.9));
    const p = policyGrid(a);
    expect(p.filter(x => x !== null).length).toBeGreaterThanOrEqual(10);
    const m = loadMap('near-or-far');
    m.cells.forEach((c, s) => { if (c !== '.') expect(p[s]).toBeNull(); });
  });
});

describe('epsilon edges', () => {
  it('epsilon 0 and 1 both complete and stay within the step cap', () => {
    for (const epsilon of [0, 1]) {
      const a = trainEpisodes(createAgent('near-or-far', 1), 20, P(0.9, epsilon));
      expect(a.episodes).toBe(20);
      expect(a.history.length).toBe(20);
      expect(greedyWalk(a).path.length).toBeLessThanOrEqual(STEP_CAP + 1);
    }
  });
});
