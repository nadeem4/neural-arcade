import { describe, it, expect } from 'vitest';
import { drawBrain } from '../engine/brain-panel.js';
import { describeInput, describeOutput } from '../games/balance/words.js';
import { SIZES, IN_LABELS, OUT_LABELS } from '../games/balance/ai.js';

const theme = { ink: '#000', muted: '#555', amber: '#fa0', edge: '#888', body: 'sans-serif', dark: false };

// A canvas stand-in: text is 7 px per character; records where each string is drawn.
function fakeCtx() {
  const texts = [];
  const ctx = new Proxy({ textAlign: 'left' }, {
    get: (t, k) => {
      if (k === 'texts') return texts;
      if (k === 'measureText') return s => ({ width: s.length * 7 });
      if (k in t) return t[k];
      if (k === 'fillText') return (s, x, y, maxW = Infinity) => texts.push({ s, x, y, maxW, align: t.textAlign });
      return () => {};
    },
    set: (t, k, v) => ((t[k] = v), true),
  });
  return ctx;
}

describe('brain panel labels stay on the canvas', () => {
  for (const width of [360, 440, 560]) {
    it(`left labels fit at width ${width}`, () => {
      const ctx = fakeCtx();
      const n = SIZES.reduce((a, b, i) => (i ? a + (SIZES[i - 1] + 1) * b : a), 0);
      const genome = new Float32Array(n).fill(0.1);
      const acts = SIZES.map(k => new Float32Array(k));
      drawBrain(ctx, { sizes: SIZES, genome, acts, inLabels: IN_LABELS, outLabels: OUT_LABELS, heads: ['a', 'b', 'c'], inWords: describeInput, outWords: describeOutput, theme, width, height: 260 });
      const left = ctx.texts.filter(t => t.align === 'right' && t.s.includes(' · '));
      expect(left.length).toBe(IN_LABELS.length);
      for (const t of ctx.texts) if (t.x > 0 && t.align === "left" && t.s !== t.s.toUpperCase()) expect(t.x + Math.min(t.s.length * 7, t.maxW)).toBeLessThanOrEqual(width + 0.01);
      for (const t of left) expect(t.x - Math.min(t.s.length * 7, t.maxW)).toBeGreaterThanOrEqual(0);
    });
  }
});
