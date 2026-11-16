import { describe, it, expect } from 'vitest';
import { loadWorld, rewardsOf, analyzeRoute } from '../games/city/sim.js';
import { STEP_CAP, HYPER } from '../games/city/presets.js';
import { createAgent, runEpisode, trainEpisodes, greedyRoute } from '../games/city/train.js';

const H = { alpha: 0.5, gamma: 0.99, eps0: 1, eps1: 0.05, decayEpisodes: 200 };
const mk = (kind) => loadWorld({
  cols: kind[0].length, rows: kind.length, lightPeriod: 2,
  kind, oneway: kind.map((r) => '.'.repeat(r.length)), signals: [],
  pickup: [0, 0], dropoff: [kind[0].length - 1, 0],
});

// Row 0 is walled off by buildings, so the only way is down, across, and back up.
const WALLED = mk(['rbbbr', 'rrrrr']);
// A footpath shortcut along row 0 (4 moves) beside a road (6 moves).
const SHORTCUT = mk(['rfffr', 'rrrrr']);

describe('trainer', () => {
  it('exports provisional hyper-parameters', () => {
    expect(STEP_CAP).toBeGreaterThan(0);
    expect(Object.keys(HYPER).sort()).toEqual(['alpha', 'decayEpisodes', 'eps0', 'eps1', 'gamma']);
  });

  it('same seed gives identical routes', () => {
    const R = rewardsOf({});
    const a = trainEpisodes(createAgent(WALLED, 7), R, 100, H);
    const b = trainEpisodes(createAgent(WALLED, 7), R, 100, H);
    expect(greedyRoute(a, R)).toEqual(greedyRoute(b, R));
  });

  it('training finds the legal route when only the clock costs money and a shortcut is blocked', () => {
    const R = rewardsOf({});
    const agent = trainEpisodes(createAgent(WALLED, 1), R, 300, H);
    const route = greedyRoute(agent, R);
    const out = analyzeRoute(WALLED, route, R);
    expect(out.arrived).toBe(true);
    expect(out.tiles).toBe(6);
  });

  it('with offroad fined a lot it prefers the longer road route', () => {
    const fined = rewardsOf({ off: 50 });
    const a = trainEpisodes(createAgent(SHORTCUT, 2), fined, 400, H);
    const outFined = analyzeRoute(SHORTCUT, greedyRoute(a, fined), fined);
    expect(outFined.arrived).toBe(true);
    expect(outFined.offTiles).toBe(0);

    const free = rewardsOf({});
    const b = trainEpisodes(createAgent(SHORTCUT, 2), free, 400, H);
    const outFree = analyzeRoute(SHORTCUT, greedyRoute(b, free), free);
    expect(outFree.arrived).toBe(true);
    expect(outFree.offTiles).toBeGreaterThan(0);
  });

  it('visits counts cells the agent stood in', () => {
    const agent = createAgent(WALLED, 3);
    const res = runEpisode(agent, rewardsOf({}), H, 1);
    const total = agent.visits.reduce((s, v) => s + v, 0);
    expect(total).toBe(res.steps);
    expect(agent.visits[WALLED.start]).toBeGreaterThan(0);
    trainEpisodes(agent, rewardsOf({}), 5, H);
    expect(agent.episodes).toBe(5);
  });

  it('a never-arriving agent still returns a capped route', () => {
    const sealed = mk(['rbr', 'rbr']); // goal (2,0) unreachable from (0,0)
    const R = rewardsOf({});
    const agent = createAgent(sealed, 4);
    const res = runEpisode(agent, R, H, 1);
    expect(res.arrived).toBe(false);
    expect(res.steps).toBe(STEP_CAP);
    const route = greedyRoute(agent, R);
    expect(route.actions.length).toBeLessThanOrEqual(STEP_CAP);
    expect(route.cells.length).toBe(route.actions.length + 1);
    expect(route.cells[0]).toBe(sealed.start);
  });

  it('extreme rewards never produce NaN in q', () => {
    const R = rewardsOf({ fare: 0, time: 1000, off: 1000, red: 1000, wrong: 1000, perTile: 1000 });
    const agent = trainEpisodes(createAgent(SHORTCUT, 5), R, 50, H);
    expect(agent.q.v.every(Number.isFinite)).toBe(true);
  });
});
