import { describe, it, expect } from 'vitest';
import { MAP, DEFAULTS, stepToy, trainToy, shortestSteps } from '../concepts/reward-design/sim.js';

describe('reward toy courier', () => {
  it('the legal route is longer than the lawn route', () => {
    expect(shortestSteps(false)).toBe(10);
    expect(shortestSteps(true)).toBe(6);
    expect(MAP).toHaveLength(3);
  });
  it('stepToy pays the clock, fines the lawn and pays the fare on arrival', () => {
    const pay = { ...DEFAULTS, lawn: 20 };
    // start is bottom-left; right is action 3
    const s0 = { x: 0, y: 2 };
    const a = stepToy(s0, 3, pay);
    expect(a.onLawn).toBe(true);
    expect(a.r).toBe(-1 - 20);
    const wall = stepToy({ x: 1, y: 2 }, 0, pay);
    expect(wall.moved).toBe(false);
    const end = stepToy({ x: 5, y: 2 }, 3, { ...DEFAULTS });
    expect(end.done).toBe(true);
    expect(end.r).toBe(-1 + 20);
  });
  it('clock only: it crosses the lawn', () => {
    const t = trainToy(DEFAULTS, { seed: 1 });
    expect(t.arrived).toBe(true);
    expect(t.lawnTiles).toBeGreaterThan(0);
  });
  it('lawn fined 20: it takes the road', () => {
    const t = trainToy({ ...DEFAULTS, lawn: 20 }, { seed: 1 });
    expect(t.arrived).toBe(true);
    expect(t.lawnTiles).toBe(0);
    expect(t.steps).toBe(10);
  });
  it('perTile 2 with time 1: it never arrives and moves more than 10 tiles', () => {
    const t = trainToy({ ...DEFAULTS, perTile: 2 }, { seed: 1 });
    expect(t.arrived).toBe(false);
    expect(t.tiles).toBeGreaterThan(10);
  });
  it('the same seed gives the same route', () => {
    const p = { ...DEFAULTS, lawn: 5 };
    expect(trainToy(p, { seed: 3 }).route).toEqual(trainToy(p, { seed: 3 }).route);
  });
  it('extreme pay never gives NaN', () => {
    for (const pay of [{ time: 0, lawn: 0, perTile: 0, fare: 0 }, { time: 100, lawn: 100, perTile: 100, fare: 100 }, { time: 0, lawn: 1e6, perTile: 1e6, fare: 0 }]) {
      const t = trainToy(pay, { seed: 2, episodes: 60 });
      expect(Number.isFinite(t.reward)).toBe(true);
      expect(Number.isFinite(t.steps)).toBe(true);
      expect(t.route.length).toBeGreaterThan(0);
    }
  });
});
