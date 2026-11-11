import { describe, it, expect } from 'vitest';
import { layout, cartRect, poleLine, drawStage } from '../games/balance/render.js';
import { X_LIMIT, HALF_POLE, newGame } from '../games/balance/sim.js';

const theme = { edge: '#888', car: '#eee', red: '#e33', amber: '#fa0' };
const stub = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => ((t[k] = v), true) });

describe('layout fits the rail at phone and desktop widths', () => {
  for (const [w, h] of [[320, 200], [800, 500]]) {
    it(`${w} x ${h}`, () => {
      const lay = layout(w, h);
      expect(lay.scale).toBeCloseTo(w / (2 * X_LIMIT + 1.6));
      expect(lay.cx).toBe(w / 2);
      expect(lay.railY).toBeCloseTo(h * 0.78);
      for (const x of [-X_LIMIT, X_LIMIT]) {
        const r = cartRect({ ...newGame(), x }, lay);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(w);
        // end stops sit just outside the cart's travel, inside the canvas
        const sx = lay.cx + Math.sign(x) * (X_LIMIT * lay.scale + lay.cartW / 2 + lay.stopW / 2);
        expect(sx - lay.stopW / 2).toBeGreaterThanOrEqual(0);
        expect(sx + lay.stopW / 2).toBeLessThanOrEqual(w);
      }
      expect(lay.poleLen).toBeCloseTo(2 * HALF_POLE * lay.scale);
      expect(lay.poleLen).toBeLessThan(lay.railY);
      expect(poleLine({ ...newGame(), th: 0 }, lay).y1).toBeGreaterThanOrEqual(0);
    });
  }
  it('centres the cart at x = 0 and sits it on the rail', () => {
    const lay = layout(320, 200), r = cartRect({ ...newGame(), x: 0 }, lay);
    expect(r.x + r.w / 2).toBe(lay.cx);
    expect(r.y + r.h).toBeCloseTo(lay.railY);
  });
});

describe('the pole', () => {
  const lay = layout(320, 200);
  it('is vertical upright and leans with the angle', () => {
    const up = poleLine({ ...newGame(), th: 0 }, lay);
    expect(up.x0).toBe(up.x1);
    expect(up.y1).toBeLessThan(up.y0);
    expect(poleLine({ ...newGame(), th: 0.4 }, lay).x1).toBeGreaterThan(up.x0);
    expect(poleLine({ ...newGame(), th: -0.4 }, lay).x1).toBeLessThan(up.x0);
  });
});

describe('drawStage', () => {
  const lay = layout(320, 200);
  const cases = { rest: {}, fell: { fell: true }, wind: { wind: 1 }, windLeft: { wind: -1 }, forceR: { force: 1 }, forceL: { force: -1 } };
  for (const [name, extra] of Object.entries(cases)) {
    it(`runs without throwing: ${name}`, () => {
      expect(() => drawStage(stub(), newGame(), { lay, theme, wind: 0, force: 0, fell: false, ...extra })).not.toThrow();
    });
  }
});
