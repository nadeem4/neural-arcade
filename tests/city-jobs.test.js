import { describe, it, expect } from 'vitest';
import { loadWorld, rewardsOf, analyzeRoute } from '../games/city/sim.js';
import { HYPER } from '../games/city/presets.js';
import { createAgent, trainEpisodes, greedyRoute } from '../games/city/train.js';
import { createJobs, trainInChunks } from '../games/city/jobs.js';

const kind = ['rfffr', 'rrrrr'];
const WORLD = loadWorld({
  cols: 5, rows: 2, lightPeriod: 2, kind, oneway: kind.map((r) => '.'.repeat(r.length)),
  signals: [], pickup: [0, 0], dropoff: [4, 0],
});

// A fake runTrain whose jobs finish when the test says so.
function fakeRunner() {
  const calls = [];
  const runTrain = (req, onProgress) => new Promise((resolve) => {
    calls.push({ req, onProgress, finish: (v) => resolve(v) });
  });
  return { calls, runTrain };
}

describe('createJobs', () => {
  it('a second start makes the first resolve to null', async () => {
    const { calls, runTrain } = fakeRunner();
    const jobs = createJobs(runTrain);
    const first = jobs.start({ n: 1 });
    const second = jobs.start({ n: 2 });
    calls[0].finish('old');
    calls[1].finish('new');
    expect(await first).toBeNull();
    expect(await second).toBe('new');
  });

  it('cancel resolves the pending job to null', async () => {
    const { calls, runTrain } = fakeRunner();
    const jobs = createJobs(runTrain);
    const p = jobs.start({});
    jobs.cancel();
    calls[0].finish('late');
    expect(await p).toBeNull();
  });

  it('progress from a stale job is not forwarded', async () => {
    const { calls, runTrain } = fakeRunner();
    const jobs = createJobs(runTrain);
    const seen = [];
    jobs.start({}, (p) => seen.push(['a', p]));
    const second = jobs.start({}, (p) => seen.push(['b', p]));
    calls[0].onProgress(1);
    calls[1].onProgress(2);
    calls[1].finish('x');
    await second;
    expect(seen).toEqual([['b', 2]]);
  });

  it('a failed newest job rejects, a failed stale one resolves null', async () => {
    const jobs = createJobs((req) => (req.bad ? Promise.reject(new Error('boom')) : Promise.resolve('ok')));
    const stale = jobs.start({ bad: true });
    const fresh = jobs.start({});
    expect(await stale).toBeNull();
    expect(await fresh).toBe('ok');
    await expect(jobs.start({ bad: true })).rejects.toThrow('boom');
  });
});

describe('trainInChunks', () => {
  const R = rewardsOf({});
  const req = { seed: 5, rewards: R, episodes: 120 };

  it('gives the same route as trainEpisodes for the same seed', async () => {
    const res = await trainInChunks(WORLD, req, () => {}, 25);
    const agent = trainEpisodes(createAgent(WORLD, 5), R, 120, HYPER);
    const route = greedyRoute(agent, R);
    expect(res.route).toEqual(route);
    expect(res.analysis).toEqual(analyzeRoute(WORLD, route, R));
    expect(Array.from(res.visits)).toEqual(Array.from(agent.visits));
  });

  it('calls onProgress at least twice, ending at the total, with visit copies', async () => {
    const seen = [];
    await trainInChunks(WORLD, req, (p) => seen.push(p), 25);
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen[seen.length - 1].done).toBe(120);
    expect(seen[0].total).toBe(120);
    expect(seen[0].visits).not.toBe(seen[1].visits);
  });
});
