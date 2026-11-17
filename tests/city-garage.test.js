import { describe, it, expect } from 'vitest';
import { createGarage, keep, remove, serialize, parse, validTaxi } from '../games/city/garage.js';

const entry = (n, over = {}) => ({
  id: 't' + n, name: 'Taxi ' + n, tries: n,
  rewards: { fare: 100, time: n, off: 0, red: 0, wrong: 0, perTile: 0 },
  route: { cells: [1, 2, 3], actions: [0, 1] },
  analysis: { seconds: 60 + n, arrived: true },
  bestSeconds: 60 + n, note: '', keptAt: n, ...over,
});

describe('garage', () => {
  it('keeps taxis newest first', () => {
    let g = createGarage();
    g = keep(g, entry(1)); g = keep(g, entry(2));
    expect(g.taxis.map(t => t.id)).toEqual(['t2', 't1']);
  });
  it('drops the oldest by keptAt when a fifth is kept', () => {
    let g = createGarage();
    for (const n of [3, 1, 4, 2, 5]) g = keep(g, entry(n));
    expect(g.taxis).toHaveLength(4);
    expect(g.taxis.map(t => t.keptAt).sort()).toEqual([2, 3, 4, 5]);
  });
  it('replaces the same rates and route instead of duplicating, keeping the best time, name and note', () => {
    let g = keep(createGarage(), entry(1, { note: 'mine', bestSeconds: 70 }));
    g = keep(g, entry(1, { id: 'other', name: 'Other', bestSeconds: 65, keptAt: 9 }));
    expect(g.taxis).toHaveLength(1);
    expect(g.taxis[0]).toMatchObject({ id: 't1', name: 'Taxi 1', note: 'mine', bestSeconds: 65, keptAt: 9 });
    g = keep(g, entry(1, { bestSeconds: 90, keptAt: 10 }));
    expect(g.taxis[0].bestSeconds).toBe(65);
  });
  it('removes by id and does not mutate', () => {
    const g = keep(keep(createGarage(), entry(1)), entry(2));
    const h = remove(g, 't1');
    expect(h.taxis.map(t => t.id)).toEqual(['t2']);
    expect(g.taxis).toHaveLength(2);
  });
  it('round-trips through serialize and parse', () => {
    const g = keep(keep(createGarage(), entry(1)), entry(2));
    expect(parse(serialize(g))).toEqual(g);
    expect(JSON.parse(serialize(g)).v).toBe(1);
  });
  it('parses garbage, a wrong version or a wrong shape to an empty garage', () => {
    const empty = createGarage();
    for (const bad of ['garbage', '', null, undefined, '{"v":2,"taxis":[]}', '{"v":1}', '{"v":1,"taxis":5}',
      '{"v":1,"taxis":[{"id":"x"}]}', '{"v":1,"taxis":[null]}', '{"v":1,"taxis":[{"id":"t1"', '[]', '7'])
      expect(parse(bad), String(bad)).toEqual(empty);
  });
  it('caps a stored garage at max', () => {
    const taxis = [1, 2, 3, 4, 5, 6].map(n => entry(n));
    expect(parse(JSON.stringify({ v: 1, taxis })).taxis).toHaveLength(4);
  });
});

describe('validating stored taxis', () => {
  const ok = n => entry(n, { route: { cells: [0, 1, 2], actions: [0, 1] } });
  const bad = {
    'cell out of range': { route: { cells: [0, 1, 99], actions: [0, 1] } },
    'negative cell': { route: { cells: [0, -1, 2], actions: [0, 1] } },
    'fractional cell': { route: { cells: [0, 1.5, 2], actions: [0, 1] } },
    'length mismatch': { route: { cells: [0, 1, 2], actions: [0] } },
    'action out of range': { route: { cells: [0, 1, 2], actions: [0, 99] } },
    'fractional action': { route: { cells: [0, 1, 2], actions: [0, 0.5] } },
    'missing reward key': { rewards: { fare: 100, time: 1, off: 0, red: 0, wrong: 0 } },
    'non-number reward': { rewards: { fare: 100, time: 'x', off: 0, red: 0, wrong: 0, perTile: 0 } },
    'non-integer tries': { tries: 1.5 },
    'route too long': { route: { cells: Array(5002).fill(0), actions: Array(5001).fill(0) } },
  };
  for (const [name, over] of Object.entries(bad)) {
    it(`rejects ${name}`, () => {
      expect(validTaxi(entry(1, over), 10)).toBe(false);
    });
  }
  it('accepts a good taxi', () => expect(validTaxi(ok(1), 10)).toBe(true));
  it('drops only the bad entries on parse', () => {
    const text = JSON.stringify({ v: 1, taxis: [ok(1), entry(2, bad['action out of range']), ok(3)] });
    expect(parse(text, { cellCount: 10 }).taxis.map(t => t.id)).toEqual(['t1', 't3']);
  });
});

