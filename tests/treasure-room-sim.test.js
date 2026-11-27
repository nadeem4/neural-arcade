import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../engine/rng.js';
import { ACTIONS, makeGrid, stateId } from '../assets/grid.js';
import {
  REWARD, ROOM, START, SLIP, step, transitions, adjacentToPit,
  valueIteration, qValue, greedyPolicy, runPolicy, pathActions,
  discounted, returnOf, treasureWorth, bestPathCells, sweepOnce,
} from '../games/treasure-room/sim.js';

const UP = 0, DOWN = 1, LEFT = 2, RIGHT = 3;
const count = ch => ROOM.cells.flat().filter(c => c === ch).length;
const find = ch => {
  for (let y = 0; y < ROOM.h; y++) for (let x = 0; x < ROOM.w; x++) if (ROOM.cells[y][x] === ch) return { x, y };
};
const boom = () => { throw new Error('rng must not be used'); };
const isFloor = (room, x, y) => !'TX#'.includes(room.cells[y][x]);

describe('treasure room: step', () => {
  it('is a 5x5 room with one start, treasure and pit', () => {
    expect([ROOM.w, ROOM.h]).toEqual([5, 5]);
    expect([count('S'), count('T'), count('X')]).toEqual([1, 1, 1]);
    expect(START).toEqual(find('S'));
    expect(REWARD).toEqual({ treasure: 10, pit: -10, step: -1, coin: 2 });
    expect(SLIP).toBe(0.1);
  });
  it('floor costs 1, treasure pays 10, pit costs 10, both end the episode', () => {
    const T = find('T'), X = find('X');
    const toT = step(ROOM, { x: T.x - 1, y: T.y }, RIGHT);
    expect(toT).toMatchObject({ reward: 10, done: true, pos: T, slipped: false });
    const toX = step(ROOM, { x: X.x, y: X.y - 1 }, DOWN);
    expect(toX).toMatchObject({ reward: -10, done: true, pos: X });
    expect(step(ROOM, START, UP)).toMatchObject({ reward: -1, done: false, pos: { x: START.x, y: START.y - 1 } });
  });
  it('a wall or the edge keeps you in place and still costs 1', () => {
    const edge = step(ROOM, { x: 0, y: 0 }, UP);
    expect(edge).toMatchObject({ pos: { x: 0, y: 0 }, reward: -1, done: false });
    const beside = { x: 3, y: 2 };
    expect(ROOM.cells[2][4]).toBe('#');
    expect(step(ROOM, beside, RIGHT)).toMatchObject({ pos: beside, reward: -1 });
  });
  it('slip 0 never touches the rng', () => {
    expect(() => step(ROOM, START, UP, { slip: 0, rng: boom })).not.toThrow();
  });
  it('slip 0.1 each side: about 80% go as chosen, and a seed repeats', () => {
    const run = seed => {
      const rng = mulberry32(seed);
      return Array.from({ length: 1000 }, () => step(ROOM, { x: 2, y: 1 }, UP, { slip: 0.1, rng }));
    };
    const a = run(1);
    const straight = a.filter(r => !r.slipped).length;
    expect(straight).toBeGreaterThan(750);
    expect(straight).toBeLessThan(850);
    expect(a.map(r => r.actual)).toEqual(run(1).map(r => r.actual));
    for (const r of a) expect(r.intended).toBe(UP);
  });
});

describe('treasure room: transitions', () => {
  it('slip 0 has one certain outcome', () => {
    const t = transitions(ROOM, START, UP);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ p: 1, actual: UP });
  });
  it('slip 0.1 splits 0.8 / 0.1 / 0.1 across the sides', () => {
    for (const [a, side] of [[UP, [LEFT, RIGHT]], [DOWN, [LEFT, RIGHT]], [LEFT, [UP, DOWN]], [RIGHT, [UP, DOWN]]]) {
      const t = transitions(ROOM, { x: 2, y: 1 }, a, 0.1);
      expect(t.map(o => o.p)).toEqual([0.8, 0.1, 0.1]);
      expect(t.map(o => o.actual)).toEqual([a, ...side]);
      expect(t.reduce((s, o) => s + o.p, 0)).toBeCloseTo(1, 10);
    }
  });
  it('a slip into a wall stays put and still costs 1', () => {
    // (3,2): choosing UP can slip right into the wall at (4,2)
    expect(ROOM.cells[2][4]).toBe('#');
    const t = transitions(ROOM, { x: 3, y: 2 }, UP, 0.1);
    const right = t.find(o => o.actual === RIGHT);
    expect(right).toMatchObject({ pos: { x: 3, y: 2 }, reward: -1, done: false });
  });
  it('adjacentToPit is true for the four neighbours only', () => {
    const X = find('X');
    expect(adjacentToPit(ROOM, { x: X.x, y: X.y - 1 })).toBe(true);
    expect(adjacentToPit(ROOM, { x: X.x + 1, y: X.y })).toBe(true);
    expect(adjacentToPit(ROOM, { x: X.x + 1, y: X.y - 1 })).toBe(false);
    expect(adjacentToPit(ROOM, START)).toBe(false);
  });
});

describe('treasure room: value and policy', () => {
  it('value iteration: terminals and walls stay 0, floors are finite', () => {
    const v = valueIteration(ROOM, { gamma: 0.9 });
    for (let y = 0; y < ROOM.h; y++) for (let x = 0; x < ROOM.w; x++) {
      const val = v[stateId(ROOM, { x, y })];
      if (isFloor(ROOM, x, y)) expect(Number.isFinite(val)).toBe(true);
      else expect(val).toBe(0);
    }
    const T = find('T');
    expect(v[stateId(ROOM, { x: T.x - 1, y: T.y })]).toBeGreaterThan(v[stateId(ROOM, START)]);
  });
  it('start value equals the discounted return of the best path', () => {
    const v = valueIteration(ROOM, { gamma: 0.9 });
    const p = greedyPolicy(ROOM, v, { gamma: 0.9 });
    const run = runPolicy(ROOM, p);
    expect(run.outcome).toBe('treasure');
    // five steps of -1, then the treasure: -1 - 0.9 - 0.81 - 0.729 - 0.6561 + 10 * 0.9^5
    expect(run.trace.map(t => t.reward)).toEqual([-1, -1, -1, -1, -1, 10]);
    expect(v[stateId(ROOM, START)]).toBeCloseTo(1.8098, 4);
    expect(v[stateId(ROOM, START)]).toBeCloseTo(returnOf([-1, -1, -1, -1, -1, 10], 0.9), 6);
  });
  it('greedy policy is -1 on wall, treasure and pit and walks to the treasure', () => {
    const v = valueIteration(ROOM, { gamma: 0.9 });
    const p = greedyPolicy(ROOM, v, { gamma: 0.9 });
    for (let y = 0; y < ROOM.h; y++) for (let x = 0; x < ROOM.w; x++) {
      expect(p[stateId(ROOM, { x, y })] === -1).toBe(!isFloor(ROOM, x, y));
    }
    const run = runPolicy(ROOM, p);
    expect(run.total).toBe(5); // five steps of -1, then +10
  });
  it('ties go to the lowest action index', () => {
    const room = makeGrid(['...', '.S.', '...']);
    const v = new Array(9).fill(0);
    const p = greedyPolicy(room, v, { gamma: 0.9 });
    expect(p[4]).toBe(UP);
    expect(qValue(room, v, { x: 1, y: 1 }, DOWN, 0.9)).toBe(-1);
  });
  it('a low discount makes the treasure not worth the walk; a high one is worth more', () => {
    const s = g => valueIteration(ROOM, { gamma: g })[stateId(ROOM, START)];
    expect(s(0.3)).toBeLessThan(0);
    expect(s(0.99)).toBeGreaterThan(s(0.9));
  });
  it('level 6: the dry route hugs the pit by a real margin, the icy route avoids it', () => {
    const gamma = 0.9;
    const route = slip => {
      const v = valueIteration(ROOM, { gamma, slip });
      const p = greedyPolicy(ROOM, v, { gamma, slip });
      return { v: v[stateId(ROOM, START)], cells: bestPathCells(ROOM, p) };
    };
    const dry = route(0), icy = route(0.1);
    expect(dry.cells.some(c => adjacentToPit(ROOM, c))).toBe(true);
    expect(icy.cells.some(c => adjacentToPit(ROOM, c))).toBe(false);
    expect(icy.v).toBeLessThan(dry.v);
    expect(icy.v).toBeCloseTo(-2.259, 2);
    expect(dry.cells).toHaveLength(7);
    expect(icy.cells).toHaveLength(9);
    // dry: the pit-side first move beats the safe route's first move by a real margin, not a tie
    const vDry = valueIteration(ROOM, { gamma, slip: 0 });
    const vIcy = valueIteration(ROOM, { gamma, slip: 0.1 });
    const firstMove = (a, b) => ACTIONS.findIndex(m => m.dx === b.x - a.x && m.dy === b.y - a.y);
    const hug = firstMove(dry.cells[0], dry.cells[1]);
    const safe = firstMove(icy.cells[0], icy.cells[1]);
    expect(hug).not.toBe(safe);
    expect(qValue(ROOM, vDry, START, hug, gamma)).toBeGreaterThan(qValue(ROOM, vDry, START, safe, gamma) + 0.1);
    // and on ice the safe first move wins too, by a smaller but real margin
    expect(qValue(ROOM, vIcy, START, safe, gamma, 0.1)).toBeGreaterThan(qValue(ROOM, vIcy, START, hug, gamma, 0.1) + 0.05);
    const T = find('T');
    for (const r of [dry, icy]) {
      expect(r.cells[0]).toEqual(START);
      expect(r.cells.at(-1)).toEqual(T);
    }
  });
});

describe('treasure room: runs and returns', () => {
  const policy = () => greedyPolicy(ROOM, valueIteration(ROOM, { gamma: 0.9 }), { gamma: 0.9 });
  it('runPolicy times out, falls in the pit, and repeats on a seed', () => {
    const p = policy();
    expect(runPolicy(ROOM, p, { maxSteps: 1 }).outcome).toBe('timeout');
    const X = find('X');
    const toPit = new Array(25).fill(DOWN);
    const pit = runPolicy(ROOM, toPit, { from: { x: X.x, y: X.y - 1 } });
    expect(pit.outcome).toBe('pit');
    expect(pit.total).toBe(-10);
    const slippy = seed => runPolicy(ROOM, p, { slip: 0.1, rng: mulberry32(seed) });
    expect(slippy(3)).toEqual(slippy(3));
    expect(() => runPolicy(ROOM, p, { slip: 0, rng: boom })).not.toThrow();
  });
  it('pathActions follows fixed actions and stops at the first done', () => {
    const acts = runPolicy(ROOM, policy()).trace.map(t => t.action);
    const r = pathActions(ROOM, START, [...acts, UP, UP]);
    expect(r.outcome).toBe('treasure');
    expect(r.trace).toHaveLength(acts.length);
  });
  it('discount maths', () => {
    expect(discounted([1, 1, 10], 0.5)).toEqual([1, 0.5, 2.5]);
    expect(returnOf([1, 1, 10], 0.5)).toBe(4);
    expect(treasureWorth(4, 0.9)).toBeCloseTo(6.561, 3);
  });
});

describe('sweepOnce', () => {
  const zeros = () => new Array(ROOM.w * ROOM.h).fill(0);
  it('from zeros: a tile next to the treasure is worth 10, a plain floor tile is worth -1 (a step, nothing known yet)', () => {
    const v = sweepOnce(ROOM, zeros(), { gamma: 0.9 });
    const T = find('T');
    expect(v[stateId(ROOM, { x: T.x - 1, y: T.y })]).toBe(10);
    expect(v[stateId(ROOM, { x: 0, y: 0 })]).toBe(-1);
  });
  it('leaves its input unchanged', () => {
    const v = zeros();
    sweepOnce(ROOM, v, { gamma: 0.9 });
    expect(v).toEqual(zeros());
  });
  it('n sweeps equal valueIteration with n sweeps, with and without slip', () => {
    for (const slip of [0, 0.1]) {
      let v = zeros();
      for (let i = 0; i < 200; i++) v = sweepOnce(ROOM, v, { gamma: 0.9, slip });
      const ref = valueIteration(ROOM, { gamma: 0.9, slip, sweeps: 200 });
      v.forEach((x, i) => expect(x).toBeCloseTo(ref[i], 6));
    }
  });
  it('spreads outward: the count of tiles worth more than a plain step never shrinks over sweeps 1..8', () => {
    let v = zeros();
    const spread = [];
    for (let i = 0; i < 8; i++) { v = sweepOnce(ROOM, v, { gamma: 0.9 }); spread.push(v.filter(x => x > -1).length); }
    for (let i = 1; i < spread.length; i++) expect(spread[i]).toBeGreaterThanOrEqual(spread[i - 1]);
    expect(spread.at(-1)).toBeGreaterThan(spread[0]);
  });
});
