import { describe, it, expect } from 'vitest';
import {
  SEED, EPISODES, STEP_CAP, HYPER, DEFAULT_REWARDS, RANGES, GOAL_SECONDS, PRESETS, checkPromise,
} from '../games/city/presets.js';

describe('presets', () => {
  it('has the five try cards in order', () => {
    expect(PRESETS.map((p) => p.id)).toEqual(['speed', 'walk', 'lights', 'legal', 'mile']);
    for (const p of PRESETS) {
      expect(typeof p.name).toBe('string');
      expect(typeof p.text).toBe('string');
    }
  });

  it('keeps every card reward within its slider range', () => {
    for (const p of PRESETS) {
      for (const [k, v] of Object.entries(p.rewards)) {
        expect(RANGES).toHaveProperty(k);
        expect(v).toBeGreaterThanOrEqual(RANGES[k].min);
        expect(v).toBeLessThanOrEqual(RANGES[k].max);
      }
    }
  });

  it('starts a new game with only the fare and the clock on', () => {
    expect(DEFAULT_REWARDS.fare).toBeGreaterThan(0);
    expect(DEFAULT_REWARDS.time).toBeGreaterThan(0);
    for (const k of ['off', 'red', 'wrong', 'perTile']) expect(DEFAULT_REWARDS[k]).toBe(0);
  });

  it('records the training values', () => {
    expect(Number.isInteger(SEED)).toBe(true);
    expect(EPISODES).toBeGreaterThan(0);
    expect(STEP_CAP).toBeGreaterThan(0);
    expect(Object.keys(HYPER).sort()).toEqual(['alpha', 'decayEpisodes', 'eps0', 'eps1', 'gamma']);
    expect(GOAL_SECONDS % 5).toBe(0);
  });
});

describe('checkPromise', () => {
  const run = (o) => ({ arrived: true, seconds: 50, tiles: 50, offTiles: 0, parkTiles: 0, redRuns: 0, wrongWays: 0, ...o });

  it('speed: arrives by cutting across park or footpath', () => {
    expect(checkPromise('speed', run({ offTiles: 3, parkTiles: 3 }), 60)).toBe(true);
    expect(checkPromise('speed', run({}), 60)).toBe(false);
    expect(checkPromise('speed', run({ offTiles: 3, parkTiles: 0 }), 60)).toBe(true); // footpath only
    expect(checkPromise('speed', run({ offTiles: 3, parkTiles: 3, arrived: false }), 60)).toBe(false);
  });

  it('walk: stays on the road and runs a red', () => {
    expect(checkPromise('walk', run({ redRuns: 1 }), 60)).toBe(true);
    expect(checkPromise('walk', run({ redRuns: 1, offTiles: 1 }), 60)).toBe(false);
    expect(checkPromise('walk', run({ redRuns: 1, arrived: false }), 60)).toBe(false);
  });

  it('lights: no park, no red, goes the wrong way', () => {
    expect(checkPromise('lights', run({ wrongWays: 2 }), 60)).toBe(true);
    expect(checkPromise('lights', run({ wrongWays: 2, redRuns: 1 }), 60)).toBe(false);
    expect(checkPromise('lights', run({ wrongWays: 2, arrived: false }), 60)).toBe(false);
  });

  it('legal: arrives with no fines', () => {
    expect(checkPromise('legal', run({}), 60)).toBe(true);
    expect(checkPromise('legal', run({ wrongWays: 1 }), 60)).toBe(false);
    expect(checkPromise('legal', run({ arrived: false }), 60)).toBe(false);
  });

  it('mile: never arrives and drives more tiles than the legal trip', () => {
    expect(checkPromise('mile', run({ arrived: false, tiles: 200 }), 60)).toBe(true);
    expect(checkPromise('mile', run({ arrived: false, tiles: 40 }), 60)).toBe(false);
    expect(checkPromise('mile', run({ tiles: 200 }), 60)).toBe(false);
  });
});
