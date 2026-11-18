import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld } from '../games/city/sim.js';
import { tripEvents } from '../games/city/events.js';
import { meterAt, barFraction, METER_SCALE, payRange, payFraction } from '../games/city/meter.js';

const read = (f) => JSON.parse(readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8'));
const world = loadWorld(read('chicago.json'));
const card = read('story.json').cards.find((c) => c.id === 'walk');
const ev = tripEvents(world, card.rewards, card.route);
const n = ev.steps.length;

describe('barFraction: both meters share one scale', () => {
  it('maps 0 to 0 and the full scale to 1, clamped', () => {
    expect(METER_SCALE).toBe(100);
    expect(barFraction(0)).toBe(0);
    expect(barFraction(METER_SCALE)).toBe(1);
    expect(barFraction(-30)).toBe(0);
    expect(barFraction(800)).toBe(1);
    expect(barFraction(50)).toBe(0.5);
  });
  it('a bigger number is a longer bar on either meter', () => {
    expect(barFraction(60)).toBeGreaterThan(barFraction(20));
  });
});

describe('Pay bar scales to its own range', () => {
  const mile = (() => { const c = read('story.json').cards.find((x) => x.id === 'mile'); return tripEvents(world, c.rewards, c.route); })();
  it('the range always spans at least 0 to 100', () => {
    expect(payRange({ steps: [{ delta: 5 }] })).toEqual({ lo: 0, hi: 100 });
  });
  it('a climbing trip ends at a full bar, and the bar never shrinks', () => {
    const r = payRange(mile);
    expect(r.hi).toBeGreaterThan(100);
    let prev = 0;
    for (let f = 0; f <= mile.steps.length; f++) {
      const x = payFraction(meterAt(mile, f).total, r);
      expect(x).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = x;
    }
    expect(prev).toBeCloseTo(1, 6);
  });
  it('negative pay never gives a negative fraction', () => {
    const r = payRange({ steps: [{ delta: -40 }, { delta: -11 }, { delta: 60 }] });
    expect(r).toEqual({ lo: -51, hi: 100 });
    expect(payFraction(-51, r)).toBe(0);
    expect(payFraction(-200, r)).toBe(0);
    expect(payFraction(100, r)).toBe(1);
    expect(payFraction(0, r)).toBeCloseTo(51 / 151, 9);
  });
});

describe('meterAt', () => {
  it('starts at zero', () => {
    expect(meterAt(ev, 0)).toEqual({ total: 0, counts: { off: 0, red: 0, wrong: 0, tiles: 0 }, seconds: 0 });
  });
  it('ends on the analysis totals', () => {
    const m = meterAt(ev, n);
    expect(m.total).toBeCloseTo(ev.totals.reward, 6);
    expect(m.counts).toEqual({ off: ev.totals.offTiles, red: ev.totals.redRuns, wrong: ev.totals.wrongWays, tiles: ev.totals.tiles });
    expect(m.seconds).toBe(ev.totals.seconds);
    expect(meterAt(ev, n + 50).total).toBeCloseTo(ev.totals.reward, 6);
  });
  it('counts never go down as the drive goes on', () => {
    let prev = meterAt(ev, 0);
    for (let f = 0.25; f <= n; f += 0.25) {
      const m = meterAt(ev, f);
      for (const k of Object.keys(m.counts)) expect(m.counts[k]).toBeGreaterThanOrEqual(prev.counts[k]);
      expect(m.seconds).toBeGreaterThanOrEqual(prev.seconds);
      prev = m;
    }
  });
  it('moves smoothly inside a step: the value sits between the two whole-step values', () => {
    for (const i of [0, 3, n - 1]) {
      const a = meterAt(ev, i).total, b = meterAt(ev, i + 1).total, mid = meterAt(ev, i + 0.5).total;
      expect(mid).toBeGreaterThanOrEqual(Math.min(a, b) - 1e-9);
      expect(mid).toBeLessThanOrEqual(Math.max(a, b) + 1e-9);
    }
  });
});
