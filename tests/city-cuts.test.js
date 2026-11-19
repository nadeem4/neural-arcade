import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld } from '../games/city/sim.js';
import { tripEvents } from '../games/city/events.js';
import { routeFrames } from '../games/city/playback.js';
import { driveTrack, stateAt } from '../games/city/drive.js';
import { SWOOP_MS } from '../games/city/director.js';
import { buildOffences } from '../games/city/offences.js';
import { overheadCuts, cutAt } from '../games/city/cuts.js';

const read = (f) => JSON.parse(readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8'));
const city = read('chicago.json'), story = read('story.json');
const world = loadWorld(city);
const cuts = (id) => {
  const c = story.cards.find((x) => x.id === id);
  const events = tripEvents(world, c.rewards, c.route);
  const track = driveTrack(routeFrames(world, city.cellM, c.route), events);
  const offences = buildOffences(events, c.rewards, track);
  const posAt = (ms) => { const s = stateAt(track, ms - SWOOP_MS); return { x: s.x, z: s.z }; };
  return { track, offences, list: overheadCuts(offences, { introMs: SWOOP_MS, driveMs: track.total, posAt }) };
};
const fake = (ms, x = 0) => ({ ms, type: 'red', x, z: 0 });
const synth = (offs, driveMs = 30000) => overheadCuts(offs, { introMs: 1400, driveMs, posAt: (ms) => ({ x: ms / 100, z: 0 }) });

describe('overheadCuts', () => {
  it('no offences, no cuts', () => { expect(synth([])).toEqual([]); });
  it('a single offence gives a 2 s cut around it', () => {
    const [c, ...rest] = synth([fake(10000)]);
    expect(rest).toEqual([]);
    expect(c.from).toBe(9000); expect(c.to).toBe(11000);
  });
  it('offences under 3 s apart share one cut; 5 s apart get two', () => {
    expect(synth([fake(10000), fake(12900)])).toHaveLength(1);
    expect(synth([fake(10000), fake(15000)])).toHaveLength(2);
  });
  it('keeps at least 2 s of chase between cuts', () => {
    expect(synth([fake(10000), fake(13500)])).toHaveLength(1); // windows 1.5 s apart: merged
    const two = synth([fake(10000), fake(16000)]);
    expect(two).toHaveLength(2);
    expect(two[1].from - two[0].to).toBeGreaterThanOrEqual(2000);
  });
  it('stays inside the chase phase', () => {
    const [a] = synth([fake(1500)]), [b] = synth([fake(1400 + 30000 - 200)]);
    expect(a.from).toBeGreaterThanOrEqual(1400);
    expect(b.to).toBeLessThanOrEqual(1400 + 30000);
  });
  it('holds the offence spots and the taxi at both ends of the window', () => {
    const [c] = synth([fake(10000, 55)]);
    expect(c.points).toContainEqual([55, 0]);
    expect(c.points).toContainEqual([90, 0]);
    expect(c.points).toContainEqual([110, 0]);
  });
  it('cutAt finds the cut holding a time, else null', () => {
    const list = synth([fake(10000)]);
    expect(cutAt(list, 9000)).toBe(list[0]); expect(cutAt(list, 10999)).toBe(list[0]);
    expect(cutAt(list, 11000)).toBeNull(); expect(cutAt(list, 8999)).toBeNull();
    expect(cutAt([], 5)).toBeNull();
  });
  it('on the real cards: legal has none; the others cut for less than the whole drive and obey the rules', () => {
    expect(cuts('legal').list).toEqual([]);
    for (const id of ['speed', 'walk', 'lights', 'mile']) {
      const { list, track } = cuts(id);
      let total = 0;
      list.forEach((c, k) => {
        total += c.to - c.from;
        expect(c.from).toBeGreaterThanOrEqual(SWOOP_MS);
        expect(c.to).toBeLessThanOrEqual(SWOOP_MS + track.total);
        if (k) expect(c.from - list[k - 1].to, id).toBeGreaterThanOrEqual(2000);
      });
      expect(total, id).toBeLessThan(track.total);
    }
  });
});
