import { describe, it, expect } from 'vitest';
import { FIELDS, cardMatching, createSession, recordTry } from '../games/city/payslip.js';
import { PRESETS, DEFAULT_REWARDS, RANGES } from '../games/city/presets.js';

const trip = (over = {}) => ({ arrived: true, seconds: 80, offTiles: 0, redRuns: 0, wrongWays: 0, ...over });

describe('pay slip fields', () => {
  it('has one field per reward line, each with a slider range', () => {
    expect(FIELDS.map(f => f.key)).toEqual(['fare', 'time', 'off', 'red', 'wrong', 'perTile']);
    expect(FIELDS.map(f => f.sign)).toEqual(['+', '-', '-', '-', '-', '+']);
    for (const f of FIELDS) {
      expect(RANGES, f.key).toHaveProperty(f.key);
      expect(DEFAULT_REWARDS, f.key).toHaveProperty(f.key);
    }
  });
});

describe('cardMatching', () => {
  it('finds each preset and null after any edit', () => {
    for (const p of PRESETS) {
      expect(cardMatching({ ...p.rewards })).toBe(p.id);
      for (const f of FIELDS) {
        const edited = { ...p.rewards, [f.key]: p.rewards[f.key] + RANGES[f.key].step };
        const other = PRESETS.find(q => FIELDS.every(g => q.rewards[g.key] === edited[g.key]));
        expect(cardMatching(edited), `${p.id} edited ${f.key}`).toBe(other ? other.id : null);
      }
    }
    expect(cardMatching({ ...DEFAULT_REWARDS, fare: 90 })).toBeNull();
    expect(cardMatching({ ...DEFAULT_REWARDS, time: 2 })).toBeNull();
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
