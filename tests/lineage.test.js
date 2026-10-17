import { describe, it, expect } from 'vitest';
import { Lineage } from '../engine/lineage.js';

describe('lineage', () => {
  function sample() {
    const l = new Lineage(3);
    l.record(1, [{ id: 1, kind: 'new', parents: [], score: 10 }, { id: 2, kind: 'new', parents: [], score: 30 }]);
    l.record(2, [{ id: 3, kind: 'kept', parents: [2], score: 35 }, { id: 4, kind: 'child', parents: [2, 1], score: 50 }]);
    l.record(3, [{ id: 5, kind: 'child', parents: [4, 3], score: 80 }]);
    return l;
  }

  it('looks up a recorded individual with its generation', () => {
    expect(sample().get(4)).toMatchObject({ id: 4, gen: 2, score: 50 });
  });

  it('builds an ancestry tree to a fixed depth', () => {
    const t = sample().ancestry(5, 3);
    expect(t.node.id).toBe(5);
    expect(t.parents.map(p => p.node.id)).toEqual([4, 3]);
    expect(t.parents[0].parents.map(p => p.node.id)).toEqual([2, 1]);
    expect(t.parents[1].parents.map(p => p.node.id)).toEqual([2]);
    expect(t.parents[0].parents[0].parents).toEqual([]);
  });

  it('stops at depth and at unknown ids', () => {
    const l = sample();
    expect(l.ancestry(5, 1).parents).toEqual([]);
    expect(l.ancestry(999, 3)).toBeNull();
  });

  it('forgets generations older than the window', () => {
    const l = sample();
    l.record(4, [{ id: 6, kind: 'kept', parents: [5], score: 90 }]);
    expect(l.get(1)).toBeUndefined();
    expect(l.get(3)).toBeDefined();
  });
});
