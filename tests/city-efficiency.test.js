import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../engine/rng.js';
import { createQTable, bestAction } from '../engine/qlearn.js';
import { loadWorld, rewardsOf, stepWorld, tally } from '../games/city/sim.js';
import { createJobs } from '../games/city/jobs.js';
import { FIELDS, RATE_KEYS } from '../games/city/reward.js';
import { rateChips } from '../games/city/naming.js';

const kind = ['rfpfr', 'rrrrr'];
const CITY = {
  cols: 5, rows: 2, lightPeriod: 2, kind, oneway: kind.map((r) => '.'.repeat(r.length)),
  signals: [], pickup: [0, 0], dropoff: [4, 0],
};
const W = loadWorld(CITY);
const R = rewardsOf({});

describe('bestAction rng draws', () => {
  it('draws nothing for a unique best and exactly once for a tie, picking the k-th tied action', () => {
    const q = createQTable(2, 4);
    q.v.set([1, 5, 2, 5], 0); // state 0: actions 1 and 3 tie
    q.v.set([0, 0, 9, 0], 4); // state 1: unique best
    let draws = 0;
    const rng = () => { draws++; return 0.99; };
    expect(bestAction(q, 1, rng)).toBe(2);
    expect(draws).toBe(0);
    expect(bestAction(q, 0, rng)).toBe(3);
    expect(draws).toBe(1);
    expect(bestAction(q, 0, () => 0)).toBe(1);
    expect(bestAction(q, 0, mulberry32(1))).toBeGreaterThanOrEqual(1);
  });
});

describe('stepWorld out object and tally', () => {
  it('writes into a supplied out object and returns it, with the same values as a fresh call', () => {
    const out = {};
    const res = stepWorld(W, R, 0, 0, 1, out);
    expect(res).toBe(out);
    expect(out).toEqual(stepWorld(W, R, 0, 0, 1));
    stepWorld(W, R, 0, 0, 4, out);
    expect(out.moved).toBe(false);
  });

  it('tally adds one step to the totals', () => {
    const totals = { arrived: false, seconds: 0, tiles: 0, offTiles: 0, parkTiles: 0, redRuns: 0, wrongWays: 0, reward: 0 };
    tally(W, totals, { r: -1, moved: true, off: true, red: true, wrong: true, done: true, cell2: 2 });
    expect(totals).toEqual({ arrived: true, seconds: 1, tiles: 1, offTiles: 1, parkTiles: 1, redRuns: 1, wrongWays: 1, reward: -1 });
  });
});

function fakeRunner() {
  const calls = [];
  const runTrain = (req, onProgress) => new Promise((resolve) => { calls.push({ req, onProgress, finish: resolve }); });
  return { calls, runTrain };
}

describe('training cache', () => {
  it('an identical request is served from cache with its own copy of visits', async () => {
    const { calls, runTrain } = fakeRunner();
    const jobs = createJobs(runTrain);
    const req = { seed: 1, episodes: 10, rewards: { fare: 100 } };
    const p = jobs.start(req);
    calls[0].finish({ route: 'r', analysis: 'a', visits: new Uint32Array([1, 2]) });
    const first = await p;
    const second = await jobs.start({ ...req, rewards: { fare: 100 } });
    expect(calls.length).toBe(1);
    expect(second.route).toBe('r');
    expect(second.visits).not.toBe(first.visits);
    expect(Array.from(second.visits)).toEqual([1, 2]);
    const third = await jobs.start(req);
    expect(third.visits).not.toBe(second.visits);
  });

  it('a different request misses, and the cache keeps at most 12 entries', async () => {
    const { calls, runTrain } = fakeRunner();
    const jobs = createJobs(runTrain);
    for (let i = 0; i < 13; i++) {
      const p = jobs.start({ seed: i, episodes: 1, rewards: {} });
      calls[calls.length - 1].finish({ visits: new Uint32Array(1) });
      await p;
    }
    expect(calls.length).toBe(13);
    await jobs.start({ seed: 12, episodes: 1, rewards: {} });
    expect(calls.length).toBe(13);
    jobs.start({ seed: 0, episodes: 1, rewards: {} });
    expect(calls.length).toBe(14);
  });

  it('a cancelled run is not cached', async () => {
    const { calls, runTrain } = fakeRunner();
    const jobs = createJobs(runTrain);
    const req = { seed: 1, episodes: 1, rewards: {} };
    const p = jobs.start(req);
    jobs.cancel();
    calls[0].finish({ visits: new Uint32Array(1) });
    await p;
    jobs.start(req);
    expect(calls.length).toBe(2);
  });
});

describe('RATE_KEYS and chips', () => {
  it('RATE_KEYS is the six keys in field order and every field has a chip label', () => {
    expect(RATE_KEYS).toEqual(['fare', 'time', 'off', 'red', 'wrong', 'perTile']);
    expect(FIELDS.map((f) => f.key)).toEqual(RATE_KEYS);
    expect(FIELDS.map((f) => f.chip)).toEqual(['Fare', 'Second', 'Park', 'Red', 'Wrong way', 'Per tile']);
    expect(rateChips({ fare: 100, time: 1, off: 0, red: 0, wrong: 0, perTile: 0 })).toEqual(['Fare +100', 'Second −1']);
  });
});
