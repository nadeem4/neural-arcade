import { describe, it, expect } from 'vitest';
import { FIELDS, defaultRewards, createSession, recordTry } from '../games/city/reward.js';
import { DEFAULT_REWARDS, RANGES } from '../games/city/presets.js';

const trip = (over = {}) => ({ arrived: true, seconds: 80, offTiles: 0, redRuns: 0, wrongWays: 0, ...over });

describe('reward fields', () => {
  it('has one field per reward line, each with a slider range', () => {
    expect(FIELDS.map(f => f.key)).toEqual(['fare', 'time', 'off', 'red', 'wrong', 'perTile']);
    expect(FIELDS.map(f => f.sign)).toEqual(['+', '-', '-', '-', '-', '+']);
    for (const f of FIELDS) {
      expect(RANGES, f.key).toHaveProperty(f.key);
      expect(DEFAULT_REWARDS, f.key).toHaveProperty(f.key);
    }
  });
});

describe('defaultRewards (what Reset restores)', () => {
  it('is fare 100, cost per second 1, every fine 0 and pay per tile 0', () => {
    expect(defaultRewards()).toEqual({ fare: 100, time: 1, off: 0, red: 0, wrong: 0, perTile: 0 });
    expect(defaultRewards()).toEqual(DEFAULT_REWARDS);
  });
  it('hands out a fresh copy each time', () => {
    const a = defaultRewards();
    a.fare = 5;
    expect(defaultRewards().fare).toBe(100);
    expect(DEFAULT_REWARDS.fare).toBe(100);
  });
});

describe('session', () => {
  it('starts empty', () => {
    expect(createSession()).toEqual({ tries: 0, best: null });
  });
  it('recordTry counts and keeps the fastest legal trip', () => {
    let s = createSession();
    s = recordTry(s, trip({ seconds: 60, offTiles: 3 }));
    expect(s).toEqual({ tries: 1, best: null });
    s = recordTry(s, trip({ seconds: 90 }));
    expect(s.tries).toBe(2);
    expect(s.best.seconds).toBe(90);
    s = recordTry(s, trip({ seconds: 74 }));
    s = recordTry(s, trip({ seconds: 80 }));
    s = recordTry(s, trip({ seconds: 50, arrived: false }));
    s = recordTry(s, trip({ seconds: 40, redRuns: 1 }));
    s = recordTry(s, trip({ seconds: 40, wrongWays: 1 }));
    expect(s.tries).toBe(7);
    expect(s.best.seconds).toBe(74);
  });
  it('does not change the session it was given', () => {
    const s = createSession();
    recordTry(s, trip());
    expect(s).toEqual({ tries: 0, best: null });
  });
});
