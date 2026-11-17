import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld, analyzeRoute } from '../games/city/sim.js';
import { buildReceipt } from '../games/city/receipt.js';
import { tripEvents, tagsFor } from '../games/city/events.js';

const read = (f) => JSON.parse(readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8'));
const world = loadWorld(read('chicago.json'));
const cards = read('story.json').cards; // real seeded routes: speed, walk, lights, legal, mile
const card = (id) => cards.find((c) => c.id === id);

describe('tripEvents', () => {
  for (const id of ['speed', 'walk', 'legal']) {
    it(`totals equal analyzeRoute and the receipt on the ${id} card`, () => {
      const { rewards, route } = card(id);
      const ev = tripEvents(world, rewards, route);
      const a = analyzeRoute(world, route, rewards);
      expect(ev.totals).toEqual(a);
      expect(ev.steps.reduce((s, st) => s + st.delta, 0)).toBeCloseTo(a.reward, 6);
      expect(Math.round(ev.totals.reward * 10) / 10).toBe(buildReceipt(rewards, a).total);
    });
  }

  it('flags a red-light run on the walk card', () => {
    const { rewards, route } = card('walk');
    const ev = tripEvents(world, rewards, route);
    const reds = ev.steps.filter((s) => s.red);
    expect(reds.length).toBe(ev.totals.redRuns);
    expect(reds.length).toBeGreaterThan(0);
    expect(reds[0].red).toBe(true);
  });

  it('marks the last step done and names the fare line', () => {
    const { rewards, route } = card('legal');
    const ev = tripEvents(world, rewards, route);
    const last = ev.steps[ev.steps.length - 1];
    expect(last.done).toBe(true);
    expect(last.lines).toContain('fare');
    expect(ev.steps.slice(0, -1).some((s) => s.done)).toBe(false);
  });

  it('a wait step has moved:false and keeps its cell', () => {
    const { rewards } = card('legal');
    const route = { cells: [world.start, world.start], actions: [4] };
    const ev = tripEvents(world, rewards, route);
    expect(ev.steps[0].moved).toBe(false);
    expect(ev.steps[0].cell).toBe(world.start);
    expect(ev.steps[0].lines).toEqual(['time']);
  });
});

describe('tagsFor', () => {
  const R = { fare: 100, time: 1, off: 20, red: 30, wrong: 30, perTile: 0 };
  const step = (o) => ({ i: 0, tick: 0, cell: 0, moved: true, off: false, park: false, red: false, wrong: false, done: false, delta: 0, lines: [], ...o });
  it('has no tags for a plain step', () => {
    expect(tagsFor(step({}), R)).toEqual([]);
  });
  it('names each fine with its amount and kind', () => {
    expect(tagsFor(step({ off: true, park: true }), R)).toEqual([{ text: '-20 park tile', kind: 'fine' }]);
    expect(tagsFor(step({ off: true }), R)).toEqual([{ text: '-20 footpath tile', kind: 'fine' }]);
    expect(tagsFor(step({ red: true }), R)).toEqual([{ text: '-30 red light run', kind: 'fine' }]);
    expect(tagsFor(step({ wrong: true }), R)).toEqual([{ text: '-30 wrong way', kind: 'fine' }]);
  });
  it('shows a fare tag on arrival, and a zero-rate fine without an amount', () => {
    expect(tagsFor(step({ done: true }), R)).toEqual([{ text: '+100 fare', kind: 'pay' }]);
    expect(tagsFor(step({ red: true }), { ...R, red: 0 })).toEqual([{ text: 'red light run', kind: 'fine' }]);
  });
});
