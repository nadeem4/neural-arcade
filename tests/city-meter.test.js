import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld } from '../games/city/sim.js';
import { tripEvents } from '../games/city/events.js';
import { meterAt } from '../games/city/meter.js';

const read = (f) => JSON.parse(readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8'));
const world = loadWorld(read('chicago.json'));
const card = read('story.json').cards.find((c) => c.id === 'walk');
const ev = tripEvents(world, card.rewards, card.route);
const n = ev.steps.length;

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
