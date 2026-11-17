import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld } from '../games/city/sim.js';
import { tripEvents } from '../games/city/events.js';
import { routeFrames, tickMsFor } from '../games/city/playback.js';
import { driveTrack, stateAt } from '../games/city/drive.js';

const read = (f) => JSON.parse(readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8'));
const city = read('chicago.json');
const world = loadWorld(city);
const card = read('story.json').cards.find((c) => c.id === 'legal');
const events = tripEvents(world, card.rewards, card.route);
const frames = routeFrames(world, city.cellM, card.route);
const track = driveTrack(frames, events);
const angle = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

describe('driveTrack', () => {
  it('lasts one tick per step and respects the cap', () => {
    expect(track.total).toBe(track.tickMs * (frames.length - 1));
    expect(track.tickMs).toBe(tickMsFor(frames.length));
    expect(track.total).toBeLessThanOrEqual(20000);
  });
  it('the legal card has at least one wait to test braking with', () => {
    expect(events.steps.some((s) => !s.moved)).toBe(true);
  });
});

describe('stateAt', () => {
  it('starts at the pickup facing the first move, not done', () => {
    const s = stateAt(track, 0);
    expect(s.x).toBeCloseTo(frames[0].x); expect(s.z).toBeCloseTo(frames[0].z);
    expect(s.done).toBe(false);
    expect(s.stepIndex).toBe(0);
  });
  it('moves continuously: never jumps more than a fraction of a tile per sample', () => {
    const dt = 10;
    let prev = stateAt(track, 0);
    for (let ms = dt; ms <= track.total; ms += dt) {
      const s = stateAt(track, ms);
      expect(Math.hypot(s.x - prev.x, s.z - prev.z)).toBeLessThan(city.cellM * 1.5 * dt / track.tickMs + 1e-6);
      prev = s;
    }
  });
  it('turns smoothly: heading never changes fast between samples, and ends on the last heading', () => {
    const dt = 10;
    let prev = stateAt(track, 0);
    let worst = 0;
    for (let ms = dt; ms <= track.total; ms += dt) {
      const s = stateAt(track, ms);
      worst = Math.max(worst, angle(s.heading, prev.heading));
      prev = s;
    }
    expect(worst).toBeLessThan(1.5 * (Math.PI / 2) * dt / (0.3 * track.tickMs) + 1e-6); // half a turn is spread over 30% of a tile
    expect(angle(prev.heading, frames[frames.length - 1].heading)).toBeLessThan(1e-6);
  });
  it('stops at a wait, with brake on, and at the end', () => {
    const i = events.steps.findIndex((s) => !s.moved);
    const mid = stateAt(track, (i + 0.5) * track.tickMs);
    expect(mid.speed).toBe(0);
    expect(mid.braking).toBe(true);
    expect(mid.stepIndex).toBe(i);
    const end = stateAt(track, track.total);
    expect(end.speed).toBe(0);
  });
  it('slows before a wait and speeds up from rest after it', () => {
    const i = events.steps.findIndex((s, k) => !s.moved && k > 0 && events.steps[k - 1].moved);
    const cruise = stateAt(track, (i - 1 + 0.5) * track.tickMs).speed;
    const nearStop = stateAt(track, (i - 1 + 0.95) * track.tickMs).speed;
    expect(nearStop).toBeLessThan(cruise);
    expect(stateAt(track, (i - 1 + 0.6) * track.tickMs).braking).toBe(true);
  });
  it('is done only from the last ms on, and reports the light tick of the step being taken', () => {
    expect(stateAt(track, track.total - 1).done).toBe(false);
    const end = stateAt(track, track.total);
    expect(end.done).toBe(true);
    expect(stateAt(track, track.total + 5000).done).toBe(true);
    expect(end.stepIndex).toBe(frames.length - 1);
    expect(stateAt(track, 1.5 * track.tickMs).tick).toBe(1);
  });
  it('a one-frame route is done at once', () => {
    const t = driveTrack([frames[0]], { steps: [], totals: {} });
    expect(stateAt(t, 0).done).toBe(true);
  });
});
