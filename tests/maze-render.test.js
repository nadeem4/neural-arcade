import { describe, it, expect } from 'vitest';
import { shade, arrowFor, tileRect, drawMaze, smooth } from '../games/maze/render.js';
import { loadMap, ACTIONS } from '../games/maze/sim.js';

const theme = { tray: '#111', ink: '#000', red: '#f00', amber: '#fa0', 'amber-ink': '#320', rule: '#555', ground: '#fff', body: 'sans-serif' };
const recorder = () => {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...args) => calls.push([k, ...args])),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  return { ctx, calls };
};

describe('shade', () => {
  it('is 0 at or below zero, clamped, and 1 at vmax', () => {
    expect(shade(0)).toBe(0);
    expect(shade(-3)).toBe(0);
    expect(shade(5)).toBe(0.5);
    expect(shade(10)).toBe(1);
    expect(shade(99)).toBe(1);
    expect(shade(2, 4)).toBe(0.5);
  });
});

describe('arrowFor', () => {
  it('returns the four arrows in ACTIONS order', () => {
    expect([0, 1, 2, 3].map(arrowFor)).toEqual(['↑', '↓', '←', '→']);
    expect(ACTIONS.map(a => a.name)).toEqual(['up', 'down', 'left', 'right']);
  });
});

describe('tileRect', () => {
  const map = loadMap('near-or-far');
  it('gives square tiles that stay inside a 600x400 canvas', () => {
    for (let s = 0; s < map.nStates; s++) {
      const r = tileRect(map, s, 600, 400);
      expect(r.size).toBeGreaterThan(0);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.size).toBeLessThanOrEqual(600 + 1e-9);
      expect(r.y + r.size).toBeLessThanOrEqual(400 + 1e-9);
    }
  });
  it('centres the grid', () => {
    const a = tileRect(map, 0, 600, 400), b = tileRect(map, map.nStates - 1, 600, 400);
    expect(a.x - 0).toBeCloseTo(600 - (b.x + b.size));
    expect(a.y).toBeCloseTo(400 - (b.y + b.size));
  });
});

describe('smooth', () => {
  it('is a trailing mean of the same length', () => {
    expect(smooth([1, 1, 1, 1], 2)).toEqual([1, 1, 1, 1]);
    expect(smooth([0, 2, 4], 2)).toEqual([0, 1, 3]);
    expect(smooth([], 5)).toEqual([]);
    expect(smooth([3, 5, 7, 9, 11], 20)).toHaveLength(5);
  });
});

describe('drawMaze', () => {
  const map = loadMap('near-or-far');
  const values = Array(map.nStates).fill(2);
  const policy = Array.from({ length: map.nStates }, (_, s) => (s % 3 === 0 ? null : s % 4));
  it('draws every tile and one arrow per non-null policy entry', () => {
    const { ctx, calls } = recorder();
    drawMaze(ctx, theme, { map, values, policy, robot: map.start, trail: [map.start], w: 600, h: 400 });
    expect(calls.filter(c => c[0] === 'fillRect').length).toBeGreaterThanOrEqual(36);
    const arrows = calls.filter(c => c[0] === 'fillText' && '↑↓←→'.includes(c[1]));
    expect(arrows).toHaveLength(policy.filter(p => p !== null).length);
  });
  it('accepts showFour and q without drawing extra arrows', () => {
    const { ctx, calls } = recorder();
    drawMaze(ctx, theme, { map, values, policy: null, robot: null, trail: [], showFour: false, q: null, w: 600, h: 400 });
    expect(calls.filter(c => c[0] === 'fillText' && '↑↓←→'.includes(c[1]))).toHaveLength(0);
  });
});
