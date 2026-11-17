import { describe, it, expect } from 'vitest';
import { stepRate, rateRows } from '../games/city/rates.js';
import { FIELDS, defaultRewards } from '../games/city/reward.js';
import { RANGES } from '../games/city/presets.js';

describe('stepRate', () => {
  it('moves one step each way for every field', () => {
    for (const f of FIELDS) {
      const { min, step } = RANGES[f.key];
      const mid = min + step * 2;
      expect(stepRate(f.key, mid, 1), f.key).toBe(mid + step);
      expect(stepRate(f.key, mid, -1), f.key).toBe(mid - step);
    }
  });
  it('clamps at both ends', () => {
    for (const f of FIELDS) {
      const { min, max } = RANGES[f.key];
      expect(stepRate(f.key, max, 1), f.key).toBe(max);
      expect(stepRate(f.key, min, -1), f.key).toBe(min);
    }
  });
  it('does not drift on half steps', () => {
    let v = 0;
    for (let i = 0; i < 7; i++) v = stepRate('perTile', v, 1);
    expect(v).toBe(3.5);
  });
});

describe('rateRows', () => {
  it('lists the six rows in FIELDS order with label', () => {
    const rows = rateRows(defaultRewards());
    expect(rows.map(r => r.key)).toEqual(FIELDS.map(f => f.key));
    expect(rows.map(r => r.label)).toEqual(FIELDS.map(f => f.label));
  });
  it('flags the ends so the buttons can disable', () => {
    const rows = rateRows({ ...defaultRewards(), fare: 200, off: 0 });
    const by = k => rows.find(r => r.key === k);
    expect(by('fare')).toMatchObject({ canInc: false, canDec: true });
    expect(by('off')).toMatchObject({ canInc: true, canDec: false });
  });
  it('shows a sign and a tone: grey at zero, orange for fines and the clock, green for pay', () => {
    const by = k => rateRows({ fare: 100, time: 1, off: 0, red: 5, wrong: 0, perTile: 2.5 }).find(r => r.key === k);
    expect(by('fare')).toMatchObject({ text: '+100', tone: 'pay' });
    expect(by('time')).toMatchObject({ text: '−1', tone: 'fine' });
    expect(by('off')).toMatchObject({ text: '0', tone: 'zero' });
    expect(by('perTile')).toMatchObject({ text: '+2.5', tone: 'pay' });
  });
});
