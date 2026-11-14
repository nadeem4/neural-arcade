import { describe, it, expect } from 'vitest';
import { drawLine } from '../engine/curve.js';

const theme = { body: 'sans-serif', muted: '#m', rule: '#r', ink: '#i' };
const rec = () => {
  const pts = [], texts = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...a) => { if (k === 'moveTo' || k === 'lineTo') pts.push(a); if (k === 'fillText') texts.push(a[0]); }),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  return { ctx, pts, texts };
};

describe('drawLine', () => {
  it('starts at zero by default', () => {
    const { ctx, pts } = rec();
    drawLine(ctx, [0, 10], { width: 100, height: 100, theme, empty: '' });
    const line = pts.slice(-2);
    expect(line[0][1]).toBe(78); // zero sits on the axis
    expect(line[1][1]).toBe(14);
  });
  it('puts a negative min on the axis and marks zero above it', () => {
    const { ctx, pts, texts } = rec();
    drawLine(ctx, [-10, 0, 10], { width: 100, height: 100, theme, empty: '', min: -10, max: 10 });
    const line = pts.slice(-3).map(p => p[1]);
    expect(line).toEqual([78, 46, 14]);
    expect(texts).toContain('0');
  });
});
