import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld } from '../games/city/sim.js';
import { tripEvents } from '../games/city/events.js';
import { routeFrames } from '../games/city/playback.js';
import { driveTrack, stateAt } from '../games/city/drive.js';

const read = (f) => JSON.parse(readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8'));
const city = read('chicago.json');
const world = loadWorld(city);
const card = read('story.json').cards.find((c) => c.id === 'legal');
const events = tripEvents(world, card.rewards, card.route);
const frames = routeFrames(world, city.cellM, card.route);
const track = driveTrack(frames, events);
const angle = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const turns = track.segs.map((g, i) => [g, i]).filter(([g]) => !g.wait && g.prevMoved && angle(g.h0, g.h1) > 0.2 && angle(g.h0, g.h1) < 2.9);
const sample = (dt) => { const out = []; for (let ms = 0; ms <= track.total; ms += dt) out.push(stateAt(track, ms)); return out; };

describe('corner arcs', () => {
  it('the card has corners to test', () => {
    expect(turns.length).toBeGreaterThan(2);
  });
  it('a corner is a curve: just after it the car is off the straight centre-to-centre line', () => {
    const [, i] = turns[0];
    const a = frames[i], b = frames[i + 1];
    const early = stateAt(track, (i + 0.05) * track.tickMs);
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    expect(Math.abs((early.x - a.x) * dz - (early.z - a.z) * dx) / len).toBeGreaterThan(0.3);
  });
  it('heading changes smoothly across every corner', () => {
    const s = sample(10);
    let worst = 0;
    for (let k = 1; k < s.length; k++) if (s[k].speed > 1) worst = Math.max(worst, angle(s[k].heading, s[k - 1].heading)); // a car stopped for a U-turn spins on the spot
    expect(worst).toBeLessThan(0.12);
  });
  it('never slides sideways: while moving, the direction of travel matches the heading', () => {
    const s = sample(10);
    for (let k = 1; k < s.length; k++) {
      const dx = s[k].x - s[k - 1].x, dz = s[k].z - s[k - 1].z;
      if (Math.hypot(dx, dz) < 0.05) continue; // stopped or nearly
      expect(angle(Math.atan2(dx, dz), s[k].heading)).toBeLessThan(0.35);
    }
  });
  it('the total path stays within 8% of the old centre-to-centre track', () => {
    const s = sample(5);
    let len = 0, old = 0;
    for (let k = 1; k < s.length; k++) len += Math.hypot(s[k].x - s[k - 1].x, s[k].z - s[k - 1].z);
    for (let k = 1; k < frames.length; k++) old += Math.hypot(frames[k].x - frames[k - 1].x, frames[k].z - frames[k - 1].z);
    expect(Math.abs(len - old) / old).toBeLessThan(0.08);
  });
  it('the speed is the same either side of a tick boundary between two moves, on a straight or an arc', () => {
    let checked = 0;
    track.segs.forEach((g, i) => {
      const n = track.segs[i + 1];
      if (g.wait || !n || n.wait || !g.m1 || !n.m0) return;
      const before = stateAt(track, (i + 1) * track.tickMs - 1e-6).speed, after = stateAt(track, (i + 1) * track.tickMs).speed;
      expect(Math.abs(before - after)).toBeLessThan(0.01);
      checked++;
    });
    expect(checked).toBeGreaterThan(5);
  });
  it('dist grows with the drive and holds at a wait; curvature is non-zero only on an arc', () => {
    const s = sample(10);
    for (let k = 1; k < s.length; k++) expect(s[k].dist).toBeGreaterThanOrEqual(s[k - 1].dist - 1e-9);
    const i = events.steps.findIndex((st) => !st.moved);
    expect(stateAt(track, (i + 0.2) * track.tickMs).dist).toBeCloseTo(stateAt(track, (i + 0.8) * track.tickMs).dist, 9);
    expect(stateAt(track, (i + 0.5) * track.tickMs).curvature).toBe(0);
    expect(s.some((x) => x.curvature !== 0)).toBe(true);
    expect(stateAt(track, 0).dist).toBe(0);
  });
  it('is a pure function of ms', () => {
    expect(stateAt(track, 3333)).toEqual(stateAt(track, 3333));
  });
});
