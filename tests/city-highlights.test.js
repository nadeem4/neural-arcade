import { describe, it, expect } from 'vitest';
import { highlightsAt, HOLD_MS } from '../games/city/highlights.js';

const o = (ms, type = 'off', extra = {}) => ({ ms, type, x: 10, z: 20, heading: 1.5, fine: 0, ...extra });

describe('highlightsAt', () => {
  it('is active from the offence to HOLD_MS later, and not before or after', () => {
    const list = [o(5000, 'red')];
    expect(highlightsAt(list, 4999)).toEqual([]);
    expect(highlightsAt(list, 5000)).toHaveLength(1);
    expect(highlightsAt(list, 5000 + 1500)).toHaveLength(1);
    expect(highlightsAt(list, 5000 + HOLD_MS)).toEqual([]);
  });
  it('holds at least 1.5 s', () => { expect(HOLD_MS).toBeGreaterThanOrEqual(1500); });
  it('carries type, position and heading', () => {
    expect(highlightsAt([o(0, 'wrong')], 10)[0]).toMatchObject({ type: 'wrong', x: 10, z: 20, heading: 1.5 });
  });
  it('k pulses with time, and is exactly 1 when reduced', () => {
    const list = [o(0)];
    const ks = [0, 60, 125, 190, 250, 400].map((t) => highlightsAt(list, t)[0].k);
    expect(new Set(ks).size).toBeGreaterThan(2);
    for (const k of ks) { expect(k).toBeGreaterThanOrEqual(0); expect(k).toBeLessThanOrEqual(1); }
    for (const t of [0, 60, 125, 700, 1600]) expect(highlightsAt(list, t, { reduced: true })[0].k).toBe(1);
  });
  it('two offences inside the window give two highlights', () => {
    expect(highlightsAt([o(1000), o(1800, 'red')], 2000).map((h) => h.type)).toEqual(['off', 'red']);
  });
  it('the same inputs give the same output', () => {
    const list = [o(100), o(900, 'wrong')];
    expect(highlightsAt(list, 1234)).toEqual(highlightsAt(list, 1234));
  });
});
