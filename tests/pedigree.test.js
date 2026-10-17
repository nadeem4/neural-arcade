import { describe, it, expect } from 'vitest';
import { layoutPedigree, scoreLabel } from '../engine/pedigree.js';

const n = (id, kind, extra = {}) => ({ id, kind, score: 50, ...extra });
const tree = {
  node: n(9, 'child', { live: true }),
  parents: [
    { node: n(7, 'kept'), parents: [{ node: n(3, 'child'), parents: [] }] },
    { node: n(8, 'child'), parents: [{ node: n(3, 'child'), parents: [] }, { node: n(4, 'new'), parents: [] }] },
  ],
};

describe('pedigree layout', () => {
  it('puts the leader on the bottom row and ancestors above it', () => {
    const { nodes } = layoutPedigree(tree, { width: 400, rows: 3 });
    const row = id => nodes.find(x => x.id === id && x.row !== undefined).row;
    expect(row(9)).toBe(2);
    expect(row(7)).toBe(1);
    expect(row(8)).toBe(1);
    expect(nodes.filter(x => x.row === 0).map(x => x.id)).toEqual([3, 3, 4]);
  });

  it('centres parents over their child and keeps rows inside the width', () => {
    const { nodes } = layoutPedigree(tree, { width: 400, rows: 3 });
    nodes.forEach(x => { expect(x.x).toBeGreaterThan(0); expect(x.x).toBeLessThan(400); });
    const leader = nodes.find(x => x.id === 9);
    const parents = nodes.filter(x => x.row === 1);
    expect(leader.x).toBeCloseTo((parents[0].x + parents[1].x) / 2, 6);
  });

  it('links every parent to its child', () => {
    const { links } = layoutPedigree(tree, { width: 400, rows: 3 });
    expect(links).toHaveLength(5);
  });

  it('handles a random newcomer with no ancestry', () => {
    const { nodes, links } = layoutPedigree({ node: n(1, 'new', { live: true }), parents: [] }, { width: 400, rows: 3 });
    expect(nodes).toHaveLength(1);
    expect(nodes[0].row).toBe(2);
    expect(links).toEqual([]);
  });

  it('labels every score in laps', () => {
    expect(scoreLabel(42.4)).toBe('0.42 laps');
    expect(scoreLabel(0)).toBe('0 laps');
    expect(scoreLabel(199.4)).toBe('1.99 laps');
    expect(scoreLabel(140)).toBe('1.4 laps');
    expect(scoreLabel(200)).toBe('2 laps');
    expect(scoreLabel(100)).toBe('1 lap');
  });
});
