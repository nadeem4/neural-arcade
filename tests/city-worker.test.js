import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rewardsOf } from '../games/city/sim.js';

const kind = ['rfffr', 'rrrrr'];
const CITY = {
  cols: 5, rows: 2, lightPeriod: 2, kind, oneway: kind.map((r) => '.'.repeat(r.length)),
  signals: [], pickup: [0, 0], dropoff: [4, 0],
};
const train = (id, episodes = 200) => ({ data: { type: 'train', id, seed: 1, rewards: rewardsOf({}), episodes } });

let posted, fetchCalls, fetchOk;
beforeEach(() => {
  posted = []; fetchCalls = 0; fetchOk = true;
  globalThis.self = { postMessage: (m, t) => posted.push({ m, t }) };
  globalThis.fetch = async () => {
    fetchCalls++;
    return fetchOk ? { ok: true, json: async () => CITY } : { ok: false, status: 404, json: async () => ({}) };
  };
});
afterEach(() => { delete globalThis.self; delete globalThis.fetch; });

const fresh = async () => { vi.resetModules(); await import('../games/city/worker.js'); return globalThis.self.onmessage; };
const msgs = (type, id) => posted.map((p) => p.m).filter((m) => m.type === type && (id === undefined || m.id === id));

describe('worker', () => {
  it('echoes the id, posts progress and done, transferring visits', async () => {
    const onmessage = await fresh();
    await onmessage(train(7));
    expect(msgs('progress', 7).length).toBeGreaterThan(0);
    const done = msgs('done', 7);
    expect(done.length).toBe(1);
    expect(done[0].route.cells.length).toBeGreaterThan(1);
    expect(done[0].analysis).toBeDefined();
    expect(posted.every((p) => p.t && p.t[0] === p.m.visits.buffer)).toBe(true);
  });

  it('a failed map load posts error, and the next train retries the fetch', async () => {
    const onmessage = await fresh();
    fetchOk = false;
    await onmessage(train(1));
    expect(msgs('error', 1).length).toBe(1);
    expect(msgs('done').length).toBe(0);
    fetchOk = true;
    await onmessage(train(2));
    expect(fetchCalls).toBe(2);
    expect(msgs('done', 2).length).toBe(1);
  });

  it('a second train makes the first stop without done or progress', async () => {
    const onmessage = await fresh();
    const a = onmessage(train(1));
    const b = onmessage(train(2));
    await Promise.all([a, b]);
    expect(msgs('done', 1).length).toBe(0);
    expect(msgs('progress', 1).length).toBe(0);
    expect(msgs('done', 2).length).toBe(1);
  });
});
