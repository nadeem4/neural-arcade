import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rewardsOf } from '../games/city/sim.js';

const kind = ['rfffr', 'rrrrr'];
const CITY = {
  cols: 5, rows: 2, lightPeriod: 2, kind, oneway: kind.map((r) => '.'.repeat(r.length)),
  signals: [], pickup: [0, 0], dropoff: [4, 0],
};
const init = { data: { type: 'init', city: CITY } };
const train = (id, episodes = 200) => ({ data: { type: 'train', id, seed: 1, rewards: rewardsOf({}), episodes } });

let posted, fetchCalls;
beforeEach(() => {
  posted = []; fetchCalls = 0;
  globalThis.self = { postMessage: (m, t) => posted.push({ m, t }) };
  globalThis.fetch = async () => { fetchCalls++; throw new Error('the worker must not fetch'); };
});
afterEach(() => { delete globalThis.self; delete globalThis.fetch; });

const fresh = async () => { vi.resetModules(); await import('../games/city/worker.js'); return globalThis.self.onmessage; };
const msgs = (type, id) => posted.map((p) => p.m).filter((m) => m.type === type && (id === undefined || m.id === id));

describe('worker errors', () => {
  it('a map that fails to load makes a train post an error', async () => {
    const onmessage = await fresh();
    await onmessage({ data: { type: 'init', city: null } });
    await onmessage(train(3));
    expect(msgs('error', 3).length).toBe(1);
    expect(msgs('done').length).toBe(0);
  });

  it('training that throws posts an error', async () => {
    vi.resetModules();
    vi.doMock('../games/city/jobs.js', () => ({ trainInChunks: async () => { throw new Error('boom'); } }));
    await import('../games/city/worker.js');
    const onmessage = globalThis.self.onmessage;
    await onmessage(init);
    await onmessage(train(5));
    vi.doUnmock('../games/city/jobs.js');
    expect(msgs('error', 5)[0].message).toBe('boom');
  });
});

describe('worker', () => {
  it('trains on the map posted in init, never fetches, echoes the id and transfers visits', async () => {
    const onmessage = await fresh();
    await onmessage(init);
    await onmessage(train(7));
    expect(fetchCalls).toBe(0);
    expect(msgs('progress', 7).length).toBeGreaterThan(0);
    const done = msgs('done', 7);
    expect(done.length).toBe(1);
    expect(done[0].route.cells.length).toBeGreaterThan(1);
    expect(done[0].analysis).toBeDefined();
    expect(posted.every((p) => p.t && p.t[0] === p.m.visits.buffer)).toBe(true);
  });

  it('a train that arrives before init waits for the map instead of failing', async () => {
    const onmessage = await fresh();
    const run = onmessage(train(4, 100));
    await onmessage(init);
    await run;
    expect(msgs('done', 4).length).toBe(1);
    expect(msgs('error').length).toBe(0);
  });

  it('a second train makes the first stop without done or progress', async () => {
    const onmessage = await fresh();
    await onmessage(init);
    const a = onmessage(train(1));
    const b = onmessage(train(2));
    await Promise.all([a, b]);
    expect(msgs('done', 1).length).toBe(0);
    expect(msgs('progress', 1).length).toBe(0);
    expect(msgs('done', 2).length).toBe(1);
  });
});
