import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld } from '../games/city/sim.js';
import { tripEvents, tagsFor } from '../games/city/events.js';
import { routeFrames } from '../games/city/playback.js';
import { driveTrack, stateAt } from '../games/city/drive.js';
import { SWOOP_MS } from '../games/city/director.js';
import { buildOffences, offenceLabel } from '../games/city/offences.js';

const read = (f) => JSON.parse(readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8'));
const city = read('chicago.json'), story = read('story.json');
const world = loadWorld(city);
const trip = (id) => {
  const c = story.cards.find((x) => x.id === id);
  const events = tripEvents(world, c.rewards, c.route);
  const track = driveTrack(routeFrames(world, city.cellM, c.route), events);
  return { c, events, track, list: buildOffences(events, c.rewards, track, { world }) };
};
const count = (list, type) => list.filter((o) => o.type === type).length;

describe('buildOffences', () => {
  it('counts match the analysis for each card', () => {
    for (const id of ['speed', 'walk', 'lights', 'mile']) {
      const { c, list } = trip(id);
      expect(count(list, 'off'), id).toBe(c.analysis.offTiles);
      expect(count(list, 'red'), id).toBe(c.analysis.redRuns);
      expect(count(list, 'wrong'), id).toBe(c.analysis.wrongWays);
    }
    expect(trip('legal').list).toEqual([]);
  });
  it('sits on the seek clock, sorted, inside the drive', () => {
    for (const id of ['speed', 'walk', 'lights']) {
      const { events, track, list } = trip(id);
      expect(list.length).toBeGreaterThan(0);
      for (const o of list) {
        const step = events.steps[o.i];
        expect(o.ms).toBe(SWOOP_MS + (o.i + 1) * track.tickMs);
        expect(o.ms).toBeGreaterThanOrEqual(SWOOP_MS);
        expect(o.ms).toBeLessThanOrEqual(SWOOP_MS + track.total);
        // The moment the tag pops: the step is behind the taxi at ms, and not 1 ms earlier.
        expect(stateAt(track, o.ms - SWOOP_MS).stepIndex).toBeGreaterThan(o.i);
        expect(stateAt(track, o.ms - SWOOP_MS - 1).stepIndex).toBeLessThanOrEqual(o.i);
        expect(o.cell).toBe(step.cell);
        expect(o.x).toBe(track.frames[o.i + 1].x);
        expect(o.z).toBe(track.frames[o.i + 1].z);
        expect(o.heading).toBeCloseTo(track.frames[o.i + 1].heading + Math.PI);
      }
      expect(list.map((o) => o.ms)).toEqual([...list.map((o) => o.ms)].sort((a, b) => a - b));
    }
  });
  it('label equals the tag text for the same step, and fine is the rate', () => {
    for (const id of ['speed', 'walk', 'lights']) {
      const { c, events, list } = trip(id);
      for (const o of list) {
        const want = tagsFor(events.steps[o.i], c.rewards).filter((t) => t.kind === 'fine').map((t) => t.text);
        expect(want).toContain(o.label);
        expect(o.fine).toBe(c.rewards[o.type]);
      }
    }
  });
  it('a wrong-way arrow is drawn one tile on only onto a road cell with the same one-way, else at the offence spot', () => {
    let n = 0, m = 0;
    for (const id of ['speed', 'walk', 'lights', 'mile']) {
      const { events, track, list } = trip(id);
      for (const o of list.filter((x) => x.type === 'wrong')) {
        n++;
        expect(Number.isFinite(o.ax) && Number.isFinite(o.az), id).toBe(true);
        const next = track.frames[o.i + 2];
        const ahead = o.acell !== o.cell;
        if (ahead) { m++; expect(world.kind[o.acell], id).toBe(0); expect(world.oneway[o.acell], id).toBe(world.oneway[o.cell]); expect([o.ax, o.az]).toEqual([next.x, next.z]); expect(next.heading).toBe(track.frames[o.i + 1].heading); expect(o.acell).toBe(events.steps[o.i + 1].cell); }
        else { expect([o.ax, o.az]).toEqual([o.x, o.z]); expect(o.acell).toBe(o.cell); }
      }
    }
    expect(n).toBeGreaterThan(0);
    expect(m).toBeGreaterThan(0); // some arrows do move one tile on
  });
  it('offenceLabel keeps the fined wording and says free when the fine is 0', () => {
    expect(offenceLabel('off', 20, false)).toBe('−20 footpath');
    expect(offenceLabel('off', 20, true)).toBe('−20 footpath');
    expect(offenceLabel('red', 5)).toBe('−5 red light');
    expect(offenceLabel('wrong', 0)).toBe('wrong way: free');
    expect(offenceLabel('off', 0, true)).toBe('footpath: free');
    expect(offenceLabel('off', 0, false)).toBe('footpath: free');
    expect(offenceLabel('red', 0)).toBe('red light: free');
  });
});
