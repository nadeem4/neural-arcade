import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld, analyzeRoute, rewardsOf } from '../games/city/sim.js';
import { legalRoute, honestReward } from '../games/city/honest.js';

// 5x5 with a park cell, a light at (2,3) and a one-way cell.
const city = {
  cols: 5, rows: 5, lightPeriod: 4,
  kind: ['rrrrr', 'rbfrr', 'rrrpr', 'rrrrr', 'rrrrr'],
  oneway: ['.....', '.....', '..E..', '.....', 'S....'],
  signals: [[2, 3]],
  pickup: [0, 0],
  dropoff: [4, 4],
};
const W = loadWorld(city);
const R = rewardsOf({ fare: 100, time: 1 });
const line = (kinds, oneway = '...', signals = []) =>
  loadWorld({ cols: 3, rows: 1, lightPeriod: 4, kind: [kinds], oneway: [oneway], signals, pickup: [0, 0], dropoff: [2, 0] });

describe('legalRoute', () => {
  it('finds a route with no park, footpath, red light or wrong way, ending at the drop-off', () => {
    const route = legalRoute(W);
    const a = analyzeRoute(W, route, R);
    expect(a.arrived).toBe(true);
    expect([a.offTiles, a.redRuns, a.wrongWays]).toEqual([0, 0, 0]);
    expect(route.cells[0]).toBe(W.start);
    expect(route.cells.at(-1)).toBe(W.goal);
    expect(route.cells).toHaveLength(route.actions.length + 1);
  });
  it('is no shorter than the straight-line distance', () => {
    expect(legalRoute(W).actions.length).toBeGreaterThanOrEqual(8);
  });
  it('waits for a green light when that is the only legal way', () => {
    const w = line('rrr', '...', [[1, 0]]);
    const a = analyzeRoute(w, legalRoute(w), R);
    expect(a.redRuns).toBe(0);
    expect(a.arrived).toBe(true);
  });
  it('returns null when only an illegal route exists', () => {
    expect(legalRoute(line('rfr'))).toBeNull();
  });
  it('returns null when a one-way blocks the only road', () => {
    expect(legalRoute(line('rrr', '.W.'))).toBeNull();
  });
  it('is deterministic', () => {
    const again = loadWorld(city);
    expect(legalRoute(again)).toEqual(legalRoute(W));
  });
  it('works on the real map', () => {
    const real = loadWorld(JSON.parse(readFileSync(new URL('../games/city/chicago.json', import.meta.url), 'utf8')));
    const a = analyzeRoute(real, legalRoute(real), R);
    expect(a.arrived).toBe(true);
    expect([a.offTiles, a.redRuns, a.wrongWays]).toEqual([0, 0, 0]);
  });
});

describe('honestReward', () => {
  it('totals the legal route under the player rates, as analyzeRoute does', () => {
    const rates = rewardsOf({ fare: 120, time: 2, perTile: 1 });
    expect(honestReward(W, rates)).toEqual(analyzeRoute(W, legalRoute(W), rates));
  });
  it('is null when there is no legal route', () => {
    expect(honestReward(line('rfr'), R)).toBeNull();
  });
});
