import { describe, it, expect } from 'vitest';
import { ACTIONS, REWARD, GRID, makeGrid, stateId, move, valueIteration, greedyPolicy, drawGrid } from '../assets/grid.js';

const find = (grid, ch) => {
  for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) if (grid.cells[y][x] === ch) return { x, y };
};
const RIGHT = 3, LEFT = 2, UP = 0;

describe('makeGrid', () => {
  it('parses rows', () => {
    const g = makeGrid(['S.T', '.#X']);
    expect(g.w).toBe(3);
    expect(g.h).toBe(2);
    expect(g.cells[1][1]).toBe('#');
  });
  it('throws on ragged rows and on no start', () => {
    expect(() => makeGrid(['S..', '..'])).toThrow();
    expect(() => makeGrid(['...', '.T.'])).toThrow();
  });
  it('GRID is 5x4 with a start, treasure and pit', () => {
    expect(GRID.w).toBe(5);
    expect(GRID.h).toBe(4);
    expect(find(GRID, 'S') && find(GRID, 'T') && find(GRID, 'X')).toBeTruthy();
  });
});

describe('move', () => {
  it('constants', () => {
    expect(ACTIONS.map(a => a.name)).toEqual(['up', 'down', 'left', 'right']);
    expect(REWARD).toEqual({ treasure: 10, pit: -10, step: -0.1 });
  });
  it('edge and wall keep the agent in place and pay step', () => {
    const g = makeGrid(['S#T']);
    expect(move(g, { x: 0, y: 0 }, UP)).toEqual({ pos: { x: 0, y: 0 }, reward: REWARD.step, done: false });
    expect(move(g, { x: 0, y: 0 }, RIGHT)).toEqual({ pos: { x: 0, y: 0 }, reward: REWARD.step, done: false });
  });
  it('treasure and pit end the episode', () => {
    const g = makeGrid(['ST', 'X.']);
    expect(move(g, { x: 0, y: 0 }, RIGHT)).toEqual({ pos: { x: 1, y: 0 }, reward: 10, done: true });
    expect(move(g, { x: 0, y: 0 }, 1)).toEqual({ pos: { x: 0, y: 1 }, reward: -10, done: true });
  });
  it('stateId is unique per cell', () => {
    expect(stateId(GRID, { x: 0, y: 0 })).toBe(0);
    expect(stateId(GRID, { x: 1, y: 1 })).toBe(GRID.w + 1);
  });
});

describe('valueIteration', () => {
  const g = makeGrid(['S..T']);
  it('values fall by about gamma per step from the treasure', () => {
    const v = valueIteration(g, 0.9);
    expect(v[2]).toBeCloseTo(10, 5);
    expect(v[1]).toBeCloseTo(-0.1 + 0.9 * 10, 5);
    expect(v[0]).toBeCloseTo(-0.1 + 0.9 * v[1], 5);
    expect(v[0]).toBeLessThan(v[1]);
  });
  it('gamma 0 gives the best immediate reward', () => {
    const v = valueIteration(g, 0);
    expect(v[2]).toBeCloseTo(10, 5);
    expect(v[0]).toBeCloseTo(REWARD.step, 5);
  });
  it('a cell beside the pit is below the cell beside the treasure', () => {
    const v = valueIteration(GRID, 0.9);
    expect(v[stateId(GRID, { x: 1, y: 0 })]).toBeLessThan(v[stateId(GRID, { x: 4, y: 1 })]);
  });
});

describe('greedyPolicy', () => {
  it('leads from start to treasure in 20 moves and never enters the pit', () => {
    const v = valueIteration(GRID, 0.9);
    const pol = greedyPolicy(GRID, v, 0.9);
    let pos = find(GRID, 'S');
    let r = { done: false };
    for (let i = 0; i < 20 && !r.done; i++) {
      r = move(GRID, pos, pol[stateId(GRID, pos)]);
      pos = r.pos;
    }
    expect(r.done).toBe(true);
    expect(r.reward).toBe(REWARD.treasure);
  });
  it('the risky route passes the pit and the safe route is the longer one', () => {
    // row 0 runs straight through the pit; the policy goes around instead
    expect(GRID.cells[0].indexOf('X')).toBeGreaterThan(0);
    const pol = greedyPolicy(GRID, valueIteration(GRID, 0.9), 0.9);
    expect(pol[stateId(GRID, { x: 1, y: 0 })]).not.toBe(RIGHT);
    expect(pol[stateId(GRID, { x: 0, y: 0 })]).toBe(1);
  });
});

describe('drawGrid', () => {
  it('runs against a stub ctx without throwing', () => {
    const calls = [];
    const ctx = new Proxy({}, {
      get: (_, k) => (k === 'canvas' ? { width: 300, height: 240 } : (...a) => calls.push([k, a])),
      set: () => true,
    });
    const values = valueIteration(GRID, 0.9);
    const policy = greedyPolicy(GRID, values, 0.9);
    expect(() => drawGrid(ctx, GRID, { cell: 50, agent: { x: 0, y: 0 }, values, policy, hover: { x: 1, y: 1 } })).not.toThrow();
    expect(() => drawGrid(ctx, GRID, { cell: 50 })).not.toThrow();
    expect(calls.length).toBeGreaterThan(0);
  });
});
