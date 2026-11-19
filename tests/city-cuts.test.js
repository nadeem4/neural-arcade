import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld } from '../games/city/sim.js';
import { tripEvents } from '../games/city/events.js';
import { routeFrames } from '../games/city/playback.js';
import { driveTrack } from '../games/city/drive.js';
import { SWOOP_MS } from '../games/city/director.js';
import { buildOffences } from '../games/city/offences.js';
import { overheadCuts, cutAt, CUT_SPREAD_MAX } from '../games/city/cuts.js';
import { offencesWithin } from '../games/city/record.js';

const read = (f) => JSON.parse(readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8'));
const city = read('chicago.json'), story = read('story.json');
const world = loadWorld(city);
const cuts = (id) => {
  const c = story.cards.find((x) => x.id === id);
  const events = tripEvents(world, c.rewards, c.route);
  const track = driveTrack(routeFrames(world, city.cellM, c.route), events);
  const offences = buildOffences(events, c.rewards, track);
  return { track, offences, list: overheadCuts(offences, { introMs: SWOOP_MS, driveMs: track.total }) };
};
const fake = (ms, x = 0) => ({ ms, type: 'red', x, z: 0 });
const synth = (offs, driveMs = 30000) => overheadCuts(offs, { introMs: 1400, driveMs });

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
  it('each cut carries one spread for its whole length: how far its offences lie from their middle, capped so the taxi stays readable', () => {
    expect(synth([fake(10000, 500)])[0].spread).toBe(0);
    expect(synth([fake(10000, 0), fake(11000, 60)])[0].spread).toBeCloseTo(30);
    expect(synth([fake(10000, 0), fake(11000, 4000)])[0].spread).toBe(CUT_SPREAD_MAX);
  });
  it('a cut clipped by a shortened drive (maxms) keeps its spread and ends where the drive ends', () => {
    const offs = [fake(5000, 0), fake(6000, 60), fake(9000, 0)];
    const [c, ...rest] = synth(offencesWithin(offs, 5000), 5000); // the drive ends at 6400; the offence at 9000 is cut off
    expect(rest).toEqual([]);
    expect(c.to).toBe(6400);
    expect(c.spread).toBeCloseTo(30);
  });
  it('cutAt finds the cut holding a time, else null', () => {
    const list = synth([fake(10000)]);
    expect(cutAt(list, 9000)).toBe(list[0]); expect(cutAt(list, 10999)).toBe(list[0]);
    expect(cutAt(list, 11000)).toBeNull(); expect(cutAt(list, 8999)).toBeNull();
    expect(cutAt([], 5)).toBeNull();
  });
  it('on the real cards: legal has none; the others cut for less than the whole drive and obey the rules', () => {
    expect(cuts('legal').list).toEqual([]);
    expect(cuts('mile').list).toEqual([]); // the mile card breaks no rule, so cam=auto never leaves the chase there
    for (const id of ['speed', 'walk', 'lights']) {
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

describe('cam wiring', () => {
  const src = (f) => readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8');
  it('the scene takes the cuts, uses the overhead shot inside one and skips the building clip there', () => {
    const s = src('scene.js');
    expect(s).toContain("from './cuts.js'");
    expect(s).toContain('setCuts(');
    expect(s).toContain('cutAt(');
    expect(s).toContain('overheadShot(');
    expect(s).toContain('highlightsAt(play.offences, play.clock'); // framed on the taxi and the offences still highlighted
    expect(s).toMatch(/!cut/); // clipCamera and clipEased only outside a cut
  });
  it('the fallback stage has setCuts', () => {
    expect(src('stage.js')).toContain('setCuts() {}');
  });
  it('main applies cam after training: map is one cut over the whole drive (no map view), auto is the offence cuts, and keeps tags on screen', () => {
    const m = src('main.js');
    expect(m).toMatch(/cfg\.cam === 'map'[^\n]*stage\.setCuts\(\[\{ from: SWOOP_MS, to: SWOOP_MS \+ driveMs, spread: CUT_SPREAD_MAX \}\]\)/);
    expect(m).not.toMatch(/cfg\.cam === 'map'[^\n]*setMapView/);
    expect(m).toMatch(/cfg\.cam === 'auto'[^\n]*stage\.setCuts\(overheadCuts\(/);
    expect(m.indexOf('await train(')).toBeLessThan(m.indexOf("cfg.cam === 'map'"));
    expect(m).toMatch(/tagPlace\([^\n]*height: overhead \|\| phone \? lab\.height : null, clear: overhead \? overhead\.clear : 0/); // the overhead shot and a phone use the vertical rule; a desktop chase is as before
    expect(m).toContain('function placeTag(span, at, slot, overhead, box = tagBox())');
    expect(m).toContain('{ from: SWOOP_MS, to: SWOOP_MS + driveMs, spread: CUT_SPREAD_MAX }');
  });
  it('in an overhead cut the L, its trains and the trees are hidden, and restored after', () => {
    const f = src('scene-furniture.js'), s = src('scene.js');
    expect(f).toContain('setOverhead(');
    expect(f).toMatch(/\.visible = !on/);
    expect(s).toContain('furniture.setOverhead(!!cut)');
  });
  it('live tags follow the taxi each frame in a cut (the stage tells onFrame it is overhead; chase keeps the pop spot)', () => {
    expect(src('scene.js')).toMatch(/onFrame\?\.\(st, play\.race \? null : taxiScreen\(\), play\.overhead\)/);
    const m = src('main.js');
    expect(m).toMatch(/function hudFrame\(state, at, overhead\)/);
    expect(m).toContain('(overhead || hud.wasOverhead) && at');
    expect(m).toContain('placeTag(span, at, span._slot, overhead, box)');
    expect(m).toMatch(/hudFrame\(st, at, overhead\)/);
    expect(m).toMatch(/popTag\(t, at, hud\.done, overhead\)/);
    expect(m).toContain('hud.wasOverhead = !!overhead'); // the first frame after a cut puts the live tags back too
    expect(m).toMatch(/const box = tagBox\(\);[^\n]*\n[^\n]*for \(const span of/); // layout read once, before the loop
    expect(src('scene.js')).toContain('{ aspect: camera.aspect, spread: cut.spread }');
  });
});
