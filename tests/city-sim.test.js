import { describe, it, expect } from 'vitest';
import { ACTIONS, loadWorld, lightRed, stepWorld, rewardsOf, analyzeRoute } from '../games/city/sim.js';
import { DEFAULT_REWARDS } from '../games/city/presets.js';

// 5x5, row 0 north. Row 2 is a road with a signal at (2,2) and a park at (3,2).
// (1,1) building, (0,1) foot, (4,1) park... see kinds below.
const city = {
  cols: 5, rows: 5, lightPeriod: 4,
  kind: [
    'rrrrr',
    'rbfrr',
    'rrrpr',
    'rrrrr',
    'rrrrr',
  ],
  oneway: [
    '.....',
    '.....',
    '..E..',
    '.....',
    'S....',
  ],
  signals: [[2, 3]],
  pickup: [0, 0],
  dropoff: [4, 4],
};
const W = loadWorld(city);
const R = rewardsOf({ fare: 100, time: 1 });
const idx = (c, r) => r * 5 + c;
const N = 0, E = 1, S = 2, Wd = 3, WAIT = 4;

describe('world', () => {
  it('maps the city to typed arrays', () => {
    expect(W.kind[idx(1, 1)]).toBe(3);
    expect(W.kind[idx(2, 1)]).toBe(1);
    expect(W.kind[idx(3, 2)]).toBe(2);
    expect(W.oneway[idx(2, 2)]).toBe(1);
    expect(W.oneway[idx(0, 0)]).toBe(-1);
    expect(W.signal[idx(2, 3)]).toBe(1);
    expect(W.start).toBe(0);
    expect(W.goal).toBe(24);
    expect(W.period).toBe(4);
    expect(W.nStates).toBe(25 * 4);
    expect(ACTIONS).toHaveLength(5);
  });
  it('takes the period from the argument when the city has none', () => {
    const { lightPeriod, ...bare } = city;
    expect(loadWorld(bare, 6).period).toBe(6);
  });
});

describe('stepWorld', () => {
  it('a solid target blocks the move and still costs the clock', () => {
    const o = stepWorld(W, R, idx(0, 1), 0, E); // building at (1,1)
    expect(o.cell2).toBe(idx(0, 1));
    expect(o.moved).toBe(false);
    expect(o.r).toBe(-1);
  });
  it('off-grid is blocked too', () => {
    const o = stepWorld(W, R, idx(0, 0), 0, N);
    expect(o.moved).toBe(false);
    expect(o.r).toBe(-1);
  });
  it('waiting costs time and moves nothing', () => {
    const o = stepWorld(W, R, idx(0, 0), 0, WAIT);
    expect(o).toMatchObject({ cell2: idx(0, 0), moved: false, r: -1, done: false });
  });
  it('entering a foot or park cell pays the off fine', () => {
    const r = rewardsOf({ fare: 100, time: 1, off: 20 });
    const foot = stepWorld(W, r, idx(2, 0), 0, S); // (2,1) foot
    expect(foot.off).toBe(true);
    expect(foot.r).toBe(-21);
    const park = stepWorld(W, r, idx(3, 1), 0, S); // (3,2) park
    expect(park.off).toBe(true);
    expect(park.r).toBe(-21);
    expect(stepWorld(W, r, idx(0, 0), 0, S).off).toBe(false);
  });
  it('moving into a signal is red only in the right phase for that axis', () => {
    // period 4: ticks 0-1 horizontal red, ticks 2-3 vertical red
    expect(lightRed(W, 0, E)).toBe(true);
    expect(lightRed(W, 0, S)).toBe(false);
    expect(lightRed(W, 2, E)).toBe(false);
    expect(lightRed(W, 2, N)).toBe(true);
    expect(lightRed(W, 5, Wd)).toBe(true);
    expect(lightRed(W, 4, WAIT)).toBe(false);
    const r = rewardsOf({ time: 1, red: 30 });
    // into (2,3) from the north (vertical)
    expect(stepWorld(W, r, idx(2, 2), 2, S).red).toBe(true);
    expect(stepWorld(W, r, idx(2, 2), 0, S).red).toBe(false);
    // into (2,3) from the west (horizontal)
    expect(stepWorld(W, r, idx(1, 3), 0, E).red).toBe(true);
    expect(stepWorld(W, r, idx(1, 3), 2, E).red).toBe(false);
    // red into a non-signal cell is not a run
    expect(stepWorld(W, r, idx(0, 3), 0, E).red).toBe(false);
    expect(stepWorld(W, r, idx(1, 3), 0, E).r).toBe(-31);
  });
  it('moving against a one-way cell is wrong way; along or across is not', () => {
    const r = rewardsOf({ time: 1, wrong: 50 });
    // (2,2) is one-way East
    expect(stepWorld(W, r, idx(3, 2), 0, Wd).wrong).toBe(true);  // into it, going west
    expect(stepWorld(W, r, idx(2, 2), 0, Wd).wrong).toBe(true);  // out of it, going west
    expect(stepWorld(W, r, idx(2, 2), 0, Wd).r).toBe(-51);
    expect(stepWorld(W, r, idx(1, 2), 0, E).wrong).toBe(false);  // along
    expect(stepWorld(W, r, idx(2, 2), 0, E).wrong).toBe(false);  // along, out of it
    expect(stepWorld(W, r, idx(2, 1), 0, S).wrong).toBe(false);  // across, into it
    expect(stepWorld(W, r, idx(2, 2), 0, N).wrong).toBe(false);  // across, out of it
    expect(stepWorld(W, r, idx(0, 4), 0, N).wrong).toBe(true);   // (0,4) is one-way South
    expect(stepWorld(W, r, idx(2, 2), 0, WAIT).wrong).toBe(false);
  });
  it('perTile pays only for moves', () => {
    const r = rewardsOf({ time: 1, perTile: 5 });
    expect(stepWorld(W, r, idx(0, 0), 0, S).r).toBe(4);
    expect(stepWorld(W, r, idx(0, 0), 0, WAIT).r).toBe(-1);
    expect(stepWorld(W, r, idx(0, 1), 0, E).r).toBe(-1); // blocked
  });
  it('reaching the goal pays the fare and is done', () => {
    const o = stepWorld(W, R, idx(3, 4), 0, E);
    expect(o.cell2).toBe(W.goal);
    expect(o.done).toBe(true);
    expect(o.r).toBe(99);
    expect(stepWorld(W, R, idx(0, 0), 0, S).done).toBe(false);
  });
});

describe('rewardsOf', () => {
  it('fills defaults and keeps overrides', () => {
    expect(rewardsOf()).toEqual(DEFAULT_REWARDS);
    expect(rewardsOf({ off: 7 })).toEqual({ ...DEFAULT_REWARDS, off: 7 });
  });
  it('starts with only fare and clock on', () => {
    expect(DEFAULT_REWARDS.fare).toBeGreaterThan(0);
    expect(DEFAULT_REWARDS.time).toBeGreaterThan(0);
    expect({ ...DEFAULT_REWARDS, fare: 0, time: 0 }).toEqual({ fare: 0, time: 0, off: 0, red: 0, wrong: 0, perTile: 0 });
  });
});

describe('analyzeRoute', () => {
  const all = rewardsOf({ fare: 100, time: 1, off: 10, red: 20, wrong: 30, perTile: 0 });
  it('counts off tiles, reds and wrong ways from a literal route', () => {
    // (0,0) S (0,1) S (0,2) E (1,2) E (2,2) W(wrong) (1,2) ...
    const route = {
      cells: [idx(2, 0), idx(2, 1), idx(2, 2), idx(2, 3), idx(2, 3)],
      actions: [S, S, S, WAIT],
    };
    // tick 0: S into (2,1) foot: off. tick 1: S into (2,2) road. tick 2: S into signal (2,3), vertical red at tick 2: red. tick 3: wait.
    const a = analyzeRoute(W, route, all);
    expect(a).toMatchObject({ arrived: false, seconds: 4, tiles: 3, offTiles: 1, redRuns: 1, wrongWays: 0 });
    expect(a.reward).toBe(-4 - 10 - 20);
  });
  it('counts wrong-way moves and arrival', () => {
    const route = {
      cells: [idx(3, 2), idx(2, 2), idx(3, 2)],
      actions: [Wd, E],
    };
    const a = analyzeRoute(W, route, all);
    expect(a.wrongWays).toBe(1);
    expect(a.offTiles).toBe(1); // back onto the park cell
    const win = analyzeRoute(W, { cells: [idx(3, 4), W.goal], actions: [E] }, all);
    expect(win).toMatchObject({ arrived: true, seconds: 1, tiles: 1 });
    expect(win.reward).toBe(99);
  });
  it('caps at the route length and reports arrived:false for a loop', () => {
    const cells = [0, 1, 0, 1, 0], actions = [E, Wd, E, Wd];
    const a = analyzeRoute(W, { cells, actions }, all);
    expect(a.arrived).toBe(false);
    expect(a.seconds).toBe(4);
    expect(a.tiles).toBe(4);
    expect(a.reward).toBe(-4);
  });
});
