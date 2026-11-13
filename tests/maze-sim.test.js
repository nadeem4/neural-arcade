import { describe, it, expect } from 'vitest';
import {
  ACTIONS, REWARD, STEP_CAP, DEFAULTS, MAPS, MAP_IDS, loadMap, stepEnv, tileKind,
  createAgent, startEpisode, stepEpisode, runEpisode,
} from '../games/maze/sim.js';

const [UP, , LEFT, RIGHT] = [0, 1, 2, 3];

describe('constants', () => {
  it('match the plan', () => {
    expect(REWARD).toEqual({ big: 10, small: 3, pit: -10, step: -0.1 });
    expect(STEP_CAP).toBe(100);
    expect(DEFAULTS).toEqual({ alpha: 0.5, gamma: 0.9, epsilon: 0.5 });
    expect(MAP_IDS).toEqual(['near-or-far', 'cliff-edge']);
    expect(ACTIONS.map(a => a.name)).toEqual(['up', 'down', 'left', 'right']);
  });
});

describe('maps', () => {
  it('are 6x6 with exactly one S', () => {
    for (const id of MAP_IDS) {
      expect(MAPS[id].rows.length).toBe(6);
      expect(MAPS[id].rows.every(r => r.length === 6)).toBe(true);
      expect(MAPS[id].rows.join('').split('S').length - 1).toBe(1);
    }
  });
  it('near-or-far: start 30, big at 0, small at 32', () => {
    const m = loadMap('near-or-far');
    expect(m.start).toBe(30);
    expect(m.nStates).toBe(36);
    expect(m.cells.indexOf('T')).toBe(0);
    expect(m.cells.filter(c => c === 'T').length).toBe(1);
    expect(m.cells.indexOf('N')).toBe(32);
    expect(m.cells[30]).toBe('.');
    expect(tileKind(m, 7)).toBe('wall');
    expect(tileKind(m, 0)).toBe('big');
    expect(tileKind(m, 32)).toBe('small');
    expect(tileKind(m, 14)).toBe('floor');
  });
  it('cliff-edge: start 30, pits 31..34, big at 35', () => {
    const m = loadMap('cliff-edge');
    expect(m.start).toBe(30);
    for (let s = 31; s <= 34; s++) expect(tileKind(m, s)).toBe('pit');
    expect(tileKind(m, 35)).toBe('big');
  });
  it('an unknown id throws', () => {
    expect(() => loadMap('nope')).toThrow();
  });
});

describe('stepEnv', () => {
  const m = loadMap('near-or-far');
  it('stays put at the edge and costs a step', () => {
    expect(stepEnv(m, 2, UP)).toEqual({ s2: 2, r: -0.1, done: false, outcome: null });
  });
  it('stays put against a wall', () => {
    expect(stepEnv(m, 6, RIGHT).s2).toBe(6); // 7 is a wall
  });
  it('treasure and pit end the episode', () => {
    const small = stepEnv(m, 31, RIGHT);
    expect(small.s2).toBe(32);
    expect(small.r).toBeCloseTo(2.9, 10);
    expect(small).toMatchObject({ done: true, outcome: 'small' });
    const big = stepEnv(m, 1, LEFT);
    expect(big.r).toBeCloseTo(9.9, 10);
    expect(big).toMatchObject({ done: true, outcome: 'big' });
    const pit = stepEnv(loadMap('cliff-edge'), 30, RIGHT);
    expect(pit.r).toBeCloseTo(-10.1, 10);
    expect(pit).toMatchObject({ done: true, outcome: 'pit' });
  });
});

describe('episodes', () => {
  const params = { alpha: 0.5, gamma: 0.9, epsilon: 0.5 };
  const run = seed => {
    const a = createAgent('near-or-far', seed);
    for (let i = 0; i < 50; i++) runEpisode(a, params);
    return a.history;
  };
  it('same seed, same history; different seed, different history', () => {
    expect(run(1)).toEqual(run(1));
    expect(run(1)).not.toEqual(run(2));
  });
  it('count episodes and end within the cap', () => {
    const a = createAgent('cliff-edge', 1);
    const ep = runEpisode(a, params);
    expect(a.episodes).toBe(1);
    expect(a.history.length).toBe(1);
    expect(['big', 'small', 'pit', 'cap']).toContain(ep.outcome);
    expect(ep.steps).toBeLessThanOrEqual(STEP_CAP);
  });
  it('ends at the step cap when the policy loops', () => {
    const a = createAgent('near-or-far', 1);
    a.q.v[30 * 4 + RIGHT] = 1; // start: go right
    a.q.v[31 * 4 + LEFT] = 1;  // next tile: go back
    const ep = runEpisode(a, { alpha: 0, gamma: 0.9, epsilon: 0 });
    expect(ep.outcome).toBe('cap');
    expect(ep.steps).toBe(STEP_CAP);
  }, 1000);
  it('a finished episode does not change', () => {
    const a = createAgent('near-or-far', 1);
    const ep = runEpisode(a, params);
    const before = { ...ep }, n = a.episodes, q = Array.from(a.q.v);
    stepEpisode(a, ep, params);
    expect(ep).toEqual(before);
    expect(a.episodes).toBe(n);
    expect(Array.from(a.q.v)).toEqual(q);
  });
  it('startEpisode begins at the start tile', () => {
    const a = createAgent('near-or-far', 1);
    expect(startEpisode(a)).toEqual({ s: 30, steps: 0, reward: 0, outcome: null });
  });
});
