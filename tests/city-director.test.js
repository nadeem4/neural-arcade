import { describe, it, expect } from 'vitest';
import { shotAt, timeline, raceShot, overheadShot, SWOOP_MS, PULLBACK_MS } from '../games/city/director.js';

describe('raceShot', () => {
  const car = (x, z, heading = 0) => ({ x, z, heading });
  it('looks at the midpoint of the two cars from behind and above', () => {
    const s = raceShot(car(0, 0), car(20, 0));
    expect(s.target[0]).toBeCloseTo(10); expect(s.target[2]).toBeCloseTo(0);
    expect(s.pos[1]).toBeGreaterThan(0);
    expect(s.pos[2]).toBeLessThan(0); // heading 0 faces +z, so behind is -z
  });
  it('pulls back further as the gap grows, up to a limit', () => {
    const near = raceShot(car(0, 0), car(4, 0)), far = raceShot(car(0, 0), car(80, 0));
    expect(far.pos[1]).toBeGreaterThan(near.pos[1]);
    expect(Math.abs(far.pos[2])).toBeGreaterThan(Math.abs(near.pos[2]));
    const huge = raceShot(car(0, 0), car(5000, 0)), more = raceShot(car(0, 0), car(8000, 0));
    expect(huge.pos[1]).toBeCloseTo(more.pos[1]); // clamped: the same height at any larger gap
  });
});

const MAP = { pos: [100, 500, 100], target: [0, 0, 0], fov: 38 };
const CHASE = { pos: [10, 4, 20], target: [12, 1, 5], fov: 60 };
const dist = (a, b) => Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]);

describe('shotAt', () => {
  it('holds the map and chase shots in their own phases', () => {
    expect(shotAt('map', 0, MAP, CHASE)).toEqual(MAP);
    expect(shotAt('map', 9999, MAP, CHASE)).toEqual(MAP);
    expect(shotAt('chase', 123, MAP, CHASE)).toEqual(CHASE);
  });
  it('starts the swoop on the map and ends it on the chase shot', () => {
    expect(shotAt('swoop', 0, MAP, CHASE)).toEqual(MAP);
    expect(shotAt('swoop', SWOOP_MS, MAP, CHASE)).toEqual(CHASE);
    expect(shotAt('swoop', SWOOP_MS * 3, MAP, CHASE)).toEqual(CHASE);
  });
  it('moves steadily away from the map during the swoop', () => {
    let last = -1;
    for (let t = 0; t <= SWOOP_MS; t += 50) {
      const d = dist(shotAt('swoop', t, MAP, CHASE), MAP);
      expect(d).toBeGreaterThanOrEqual(last);
      last = d;
    }
  });
  it('pulls back along the same path in reverse', () => {
    expect(shotAt('pullback', 0, MAP, CHASE)).toEqual(CHASE);
    expect(shotAt('pullback', PULLBACK_MS, MAP, CHASE)).toEqual(MAP);
    const mid = shotAt('pullback', PULLBACK_MS / 2, MAP, CHASE), swoopMid = shotAt('swoop', SWOOP_MS / 2, MAP, CHASE);
    for (let k = 0; k < 3; k++) expect(mid.pos[k]).toBeCloseTo(swoopMid.pos[k]);
  });
  it('cranes: leaving the chase it rises over the taxi before it pulls away, and the swoop comes down last', () => {
    const t = PULLBACK_MS * 0.25, p = shotAt('pullback', t, MAP, CHASE).pos;
    const up = (p[1] - CHASE.pos[1]) / (MAP.pos[1] - CHASE.pos[1]);
    const away = Math.hypot(p[0] - CHASE.pos[0], p[2] - CHASE.pos[2]) / Math.hypot(MAP.pos[0] - CHASE.pos[0], MAP.pos[2] - CHASE.pos[2]);
    expect(away).toBeLessThan(up * 0.5);
    const s = shotAt('swoop', SWOOP_MS * 0.75, MAP, CHASE).pos;
    const down = (MAP.pos[1] - s[1]) / (MAP.pos[1] - CHASE.pos[1]);
    const over = Math.hypot(s[0] - MAP.pos[0], s[2] - MAP.pos[2]) / Math.hypot(MAP.pos[0] - CHASE.pos[0], MAP.pos[2] - CHASE.pos[2]);
    expect(over).toBeGreaterThan(down); // over the taxi before it is down at the chase height
  });
  it('with reduced motion goes straight to the shot the phase ends on', () => {
    expect(shotAt('swoop', 0, MAP, CHASE, { reduced: true })).toEqual(CHASE);
    expect(shotAt('pullback', 0, MAP, CHASE, { reduced: true })).toEqual(MAP);
  });
});

describe('timeline', () => {
  it('runs swoop, chase for the drive, pullback, then map', () => {
    expect(timeline(5000, 0)).toEqual({ phase: 'swoop', t: 0 });
    expect(timeline(5000, SWOOP_MS + 100)).toEqual({ phase: 'chase', t: 100 });
    expect(timeline(5000, SWOOP_MS + 5000 + 10)).toEqual({ phase: 'pullback', t: 10 });
    expect(timeline(3000, SWOOP_MS + 3000)).toEqual({ phase: 'pullback', t: 0 }); // a cut drive (maxms): the pullback starts at intro + driveMs
    expect(timeline(5000, SWOOP_MS + 5000 + PULLBACK_MS).phase).toBe('map');
  });
  it('can skip the swoop and the pullback', () => {
    expect(timeline(5000, 0, { swoop: false })).toEqual({ phase: 'chase', t: 0 });
    expect(timeline(5000, 6000, { swoop: false }).phase).toBe('map');
  });
});

describe('overheadShot', () => {
  it('looks down at the centre point, a little from the south (+z) so north is up', () => {
    const s = overheadShot([10, 20]);
    expect(s.target).toEqual([10, 0, 20]);
    expect(s.pos[1]).toBeGreaterThan(Math.abs(s.pos[2] - 20) * 3); // steep
    expect(s.pos[2]).toBeGreaterThan(20); // south of the target
    expect(s.pos[0]).toBeCloseTo(10);
  });
  it('the height comes from the spread alone: it rises with it, within limits', () => {
    const near = overheadShot([0, 0], { spread: 10 }), mid = overheadShot([0, 0], { spread: 100 }), far = overheadShot([0, 0], { spread: 50000 });
    expect(mid.pos[1]).toBeGreaterThan(near.pos[1]);
    expect(far.pos[1]).toBeLessThanOrEqual(800);
    expect(near.pos[1]).toBeGreaterThanOrEqual(346); // above the tallest tower on the map, so no building hides the road
  });
  it('a tall narrow screen needs more height for the same spread', () => {
    const wide = overheadShot([0, 0], { spread: 50, aspect: 1.78 }), tall = overheadShot([0, 0], { spread: 50, aspect: 0.46 });
    expect(tall.pos[1]).toBeGreaterThan(wide.pos[1]);
  });
});
