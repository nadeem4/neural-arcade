import { describe, it, expect } from 'vitest';
import { qValue } from '../engine/qlearn.js';
import {
  ACTIONS, REWARD, STEP_CAP, DEFAULTS, MAPS, MAP_IDS, loadMap, stepEnv, createAgent,
  startEpisode, stepEpisode, runEpisode, tileKind,
} from '../games/maze/sim.js';

const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;

describe('constants', () => {
  it('match the plan', () => {
    expect(REWARD).toEqual({ big: 10, small: 3, pit: -10, step: -0.1 });
    expect(STEP_CAP).toBe(100);
    expect(DEFAULTS).toEqual({ alpha: 0.5, gamma: 0.9, epsilon: 0.5 });
    expect(MAP_IDS).toEqual(['near-or-far', 'cliff-edge']);
    expect(ACTIONS.length).toBe(4);
    expect(ACTIONS.map(a => a.name)).toEqual(['up', 'right', 'down', 'left']);
  });
});

describe('maps', () => {
  it('are 6x6 with one start', () => {
    for (const id of MAP_IDS) {
      expect(MAPS[id].rows.length).toBe(6);
      expect(MAPS[id].rows.every(r => r.length === 6)).toBe(true);
      const m = loadMap(id);
      expect(m.w).toBe(6);
      expect(m.h).toBe(6);
      expect(m.nStates).toBe(36);
      expect(m.rows.join('').split('S').length - 1).toBe(1);
    }
  });
  it('near-or-far has a far +10, a near +3 and the start bottom left', () => {
    const m = loadMap('near-or-far');
    expect(m.start).toBe(5 * 6 + 0);
    expect(tileKind(m, 0)).toBe('big');
    expect(tileKind(m, 5 * 6 + 2)).toBe('small');
    expect(tileKind(m, 1 * 6 + 1)).toBe('wall');
    expect(tileKind(m, m.start)).toBe('start');
    expect(tileKind(m, 2 * 6 + 2)).toBe('floor');
  });
  it('cliff-edge has a pit row between start and goal', () => {
    const m = loadMap('cliff-edge');
    expect(tileKind(m, 5 * 6 + 1)).toBe('pit');
    expect(tileKind(m, 5 * 6 + 4)).toBe('pit');
    expect(tileKind(m, 5 * 6 + 5)).toBe('big');
  });
});

describe('stepEnv', () => {
  const m = loadMap('near-or-far');
  it('a plain move costs the step penalty', () => {
    const r = stepEnv(m, m.start, UP);
    expect(r).toEqual({ s2: 4 * 6, r: REWARD.step, done: false, outcome: null });
  });
  it('bumping a wall or the edge stays put and still costs a step', () => {
    expect(stepEnv(m, m.start, LEFT).s2).toBe(m.start);
    expect(stepEnv(m, m.start, DOWN).s2).toBe(m.start);
    // (0,1) is floor and (1,1) is a wall
    expect(stepEnv(m, 1 * 6 + 0, RIGHT)).toMatchObject({ s2: 1 * 6 + 0, r: REWARD.step, done: false });
  });
  it('terminals pay their reward and end the episode', () => {
    expect(stepEnv(m, 5 * 6 + 1, RIGHT)).toEqual({ s2: 5 * 6 + 2, r: REWARD.small, done: true, outcome: 'small' });
    expect(stepEnv(m, 1, LEFT)).toEqual({ s2: 0, r: REWARD.big, done: true, outcome: 'big' });
    const c = loadMap('cliff-edge');
    expect(stepEnv(c, 5 * 6, RIGHT)).toEqual({ s2: 5 * 6 + 1, r: REWARD.pit, done: true, outcome: 'pit' });
  });
});

describe('episodes', () => {
  it('are deterministic by seed', () => {
    const a = createAgent({ mapId: 'near-or-far', seed: 4 });
    const b = createAgent({ mapId: 'near-or-far', seed: 4 });
    const ra = [], rb = [];
    for (let i = 0; i < 20; i++) { ra.push(runEpisode(a)); rb.push(runEpisode(b)); }
    expect(ra).toEqual(rb);
    expect(Array.from(a.q.v)).toEqual(Array.from(b.q.v));
  });
  it('learning writes into the table; learn:false does not', () => {
    const a = createAgent({ mapId: 'cliff-edge', seed: 1 });
    const ep = startEpisode(a);
    stepEpisode(a, ep, { learn: false });
    expect(Array.from(a.q.v).every(v => v === 0)).toBe(true);
    stepEpisode(a, ep);
    expect(Array.from(a.q.v).some(v => v !== 0)).toBe(true);
  });
  it('ends at the step cap with outcome cap when the policy loops', () => {
    const a = createAgent({ mapId: 'near-or-far', seed: 1, epsilon: 0 });
    // loop up/down between start and the tile above it
    a.q.v[a.map.start * 4 + UP] = 1;
    a.q.v[(a.map.start - 6) * 4 + DOWN] = 1;
    a.params.alpha = 0; // keep the loop intact
    const res = runEpisode(a);
    expect(res.outcome).toBe('cap');
    expect(res.steps).toBe(STEP_CAP);
    expect(qValue(a.q, a.map.start, UP)).toBe(1);
  });
  it('reports outcome, steps and return', () => {
    const a = createAgent({ mapId: 'cliff-edge', seed: 2 });
    const res = runEpisode(a);
    expect(['big', 'small', 'pit', 'cap']).toContain(res.outcome);
    expect(res.steps).toBeGreaterThan(0);
    expect(Number.isFinite(res.ret)).toBe(true);
    expect(a.episodes).toBe(1);
  });
});
