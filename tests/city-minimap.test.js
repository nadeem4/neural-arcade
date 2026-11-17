import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld } from '../games/city/sim.js';
import { tripEvents } from '../games/city/events.js';
import { minimapModel, drawMinimap } from '../games/city/minimap.js';

const read = (f) => JSON.parse(readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8'));
const world = loadWorld(read('chicago.json'));
const card = read('story.json').cards.find((c) => c.id === 'walk');
const route = card.route;
const ev = tripEvents(world, card.rewards, route);
const n = ev.steps.length;
const inUnit = (p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;

describe('minimapModel for a race', () => {
  const other = read('story.json').cards.find((c) => c.id === 'legal');
  const evB = tripEvents(world, other.rewards, other.route);
  const fit = [route, other.route];
  const both = () => [minimapModel(world, route, ev.steps.length, ev, fit), minimapModel(world, other.route, evB.steps.length, evB, fit)];
  it('fits both routes in one view, so the shared flag lines up and every point is inside', () => {
    const [a, b] = both();
    expect(a.flag).toEqual(b.flag);
    expect(a.points.every(inUnit) && b.points.every(inUnit)).toBe(true);
    expect(a.points[0]).toEqual(b.points[0]); // the same pickup
  });
  it('keeps each route its own length and its own fine dots', () => {
    const [a, b] = both();
    expect(a.points.length).toBe(ev.steps.length + 1);
    expect(b.points.length).toBe(evB.steps.length + 1);
    const fines = (e) => e.steps.filter((s) => ['red', 'wrong', 'off'].some((l) => s.lines.includes(l))).length;
    expect(a.dots.length).toBe(fines(ev));
    expect(b.dots.length).toBe(fines(evB));
  });
  it('draws a second model over the first without clearing it', () => {
    const calls = [];
    const ctx = new Proxy({}, { get: (_, k) => () => { calls.push(k); }, set: () => true });
    drawMinimap(ctx, minimapModel(world, route, 3, ev), 100, undefined, { clear: false });
    expect(calls).not.toContain('clearRect');
  });
});

describe('minimapModel', () => {
  it('has one point per step so far plus the start, all inside the unit square', () => {
    for (const i of [0, 1, 5, n]) {
      const m = minimapModel(world, route, i, ev);
      expect(m.points.length).toBe(i + 1);
      expect(m.points.every(inUnit)).toBe(true);
    }
  });
  it('puts the taxi on the newest point, and between points mid-step', () => {
    const m = minimapModel(world, route, 3, ev);
    expect(m.taxi).toEqual(m.points[3]);
    const half = minimapModel(world, route, 3.5, ev);
    expect(half.points.length).toBe(4);
    expect(inUnit(half.taxi)).toBe(true);
    expect(half.taxi).not.toEqual(m.points[3]);
  });
  it('shows event dots only for fines that fired so far', () => {
    expect(minimapModel(world, route, 0, ev).dots).toEqual([]);
    const all = minimapModel(world, route, n, ev).dots;
    const fined = ev.steps.filter((s) => s.lines.some((l) => ['off', 'red', 'wrong'].includes(l)));
    expect(all.length).toBe(fined.length);
    expect(all.every((d) => ['off', 'red', 'wrong'].includes(d.kind) && inUnit(d))).toBe(true);
  });
  it('plants the flag at the goal and keeps it fixed as the drive goes on', () => {
    const a = minimapModel(world, route, 0, ev).flag, b = minimapModel(world, route, n, ev).flag;
    expect(a).toEqual(b);
    expect(inUnit(a)).toBe(true);
  });
});

describe('drawMinimap', () => {
  it('only calls canvas methods: a route line, a dot per event, the flag and the taxi', () => {
    const calls = {};
    const ctx = new Proxy({}, { get: (_, k) => (k in calls || true) && ((...a) => { calls[k] = (calls[k] || 0) + 1; }), set: () => true });
    const m = minimapModel(world, route, n, ev);
    drawMinimap(ctx, m, 120);
    expect(calls.clearRect).toBe(1);
    expect(calls.lineTo).toBe(m.points.length - 1);
    expect(calls.arc).toBe(m.dots.length + 1); // event dots plus the taxi
    expect(calls.fill).toBe(m.dots.length + 1);
    expect(calls.fillRect).toBe(1); // the flag
  });
});
