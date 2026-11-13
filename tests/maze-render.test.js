import { describe, it, expect } from 'vitest';
import { shade, arrowFor, tileRect, drawMaze, smooth, curvePoints } from '../games/maze/render.js';
import { loadMap, ACTIONS } from '../games/maze/sim.js';

const theme = { tray: '#111', ink: '#ink', red: '#f00', amber: '#fa0', 'amber-ink': '#320', rule: '#555', ground: '#ground', car: '#car', body: 'sans-serif' };
const recorder = () => {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...args) => calls.push([k, ...args, t.fillStyle, t.strokeStyle, t.globalAlpha])),
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

describe('drawMaze on the always-dark stage', () => {
  const map = loadMap('near-or-far');
  const values = Array(map.nStates).fill(0);
  values[map.start] = 8;
  const policy = Array(map.nStates).fill(null);
  policy[map.start] = 3; policy[map.start + 1] = 3; // one arrow on a bright tile, one on a dark tile
  values[map.start + 1] = 0;
  it('never draws walls, trail, robot outline or dim arrows in the page ink or ground colours', () => {
    const { ctx, calls } = recorder();
    drawMaze(ctx, theme, { map, values, policy, robot: map.start, trail: [map.start, map.start + 1], w: 600, h: 400 });
    for (const c of calls) {
      if (['fillRect', 'fillText', 'stroke', 'fill'].includes(c[0])) {
        const style = c[0] === 'stroke' ? c[c.length - 2] : c[c.length - 3];
        if (c[0] === 'fillText') {
          
        }
        expect([theme.ground, theme.ink], c.join()).not.toContain(style);
      }
    }
  });
  it('draws the arrow on a bright tile in the dark stage colour and on a dark tile in the stage ink', () => {
    const { ctx, calls } = recorder();
    drawMaze(ctx, theme, { map, values, policy, robot: null, trail: [], w: 600, h: 400 });
    const arrows = calls.filter(c => c[0] === 'fillText' && c[1] === '→');
    const styles = arrows.map(c => c[c.length - 3]);
    expect(styles).toContain(theme.tray);
    expect(styles).toContain(theme.car);
  });
});

describe('curvePoints', () => {
  it('keeps only a bounded tail but smooths with the earlier episodes', () => {
    const h = Array.from({ length: 5000 }, (_, i) => (i < 4990 ? 0 : 10));
    const { values, start } = curvePoints(h, 500, 20);
    expect(values).toHaveLength(500);
    expect(start).toBe(4500);
    expect(values[499]).toBeCloseTo(smooth(h, 20)[4999]);
  });
  it('returns the whole history when it is short, and keeps negatives', () => {
    const { values, start } = curvePoints([-10, -10], 500, 20);
    expect(start).toBe(0);
    expect(values).toEqual([-10, -10]);
    expect(curvePoints([], 500, 20)).toEqual({ values: [], start: 0 });
  });
});
