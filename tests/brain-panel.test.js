import { describe, it, expect } from 'vitest';
import { drawBrain } from '../engine/brain-panel.js';
import * as balance from '../games/balance/words.js';
import * as balanceAi from '../games/balance/ai.js';
import * as runner from '../games/runner/sim.js';
import * as racer from '../games/racer/sim.js';

const theme = { ink: '#000', muted: '#555', amber: '#fa0', edge: '#888', body: 'sans-serif', dark: false };
const CHAR = 6; // the stand-in canvas makes text 6 px per character (13px sans-serif averages about 6.3)

function fakeCtx() {
  const texts = [];
  return new Proxy({ textAlign: 'left' }, {
    get: (t, k) => {
      if (k === 'texts') return texts;
      if (k === 'measureText') return s => ({ width: s.length * CHAR });
      if (k in t) return t[k];
      if (k === 'fillText') return (s, x, y, maxW = Infinity) => texts.push({ s, x, y, maxW, align: t.textAlign });
      return () => {};
    },
    set: (t, k, v) => ((t[k] = v), true),
  });
}

const GAMES = {
  balance: { sizes: balanceAi.SIZES, inLabels: balanceAi.IN_LABELS, outLabels: balanceAi.OUT_LABELS, inWords: balance.describeInput, outWords: balance.describeOutput },
  runner: { sizes: runner.RUNNER_SIZES, inLabels: runner.IN_LABELS, outLabels: runner.ACTIONS, inWords: runner.describeInput, outWords: k => `${k * 10}% likely` },
  racer: { sizes: racer.SIZES, inLabels: racer.IN_LABELS, outLabels: racer.OUT_LABELS, inWords: racer.describeInput, outWords: racer.describeOutput },
};

// the same brain, drawn with the given value on every input
function draw(game, width, value) {
  const ctx = fakeCtx();
  const { sizes } = game;
  const n = sizes.reduce((a, b, i) => (i ? a + (sizes[i - 1] + 1) * b : a), 0);
  const acts = sizes.map((k, l) => new Float32Array(k).fill(l === 0 ? value : 0));
  drawBrain(ctx, { ...game, genome: new Float32Array(n).fill(0.1), acts, heads: ['a', 'b', 'c'], theme, width, height: 260 });
  const inputs = ctx.texts.filter(t => t.align === 'right' && t.s.includes(' · '));
  return { ctx, inputs };
}

for (const [name, game] of Object.entries(GAMES)) {
  describe(`brain panel, ${name}`, () => {
    for (const value of [-1, 0, 1]) {
      it(`input labels stay on the canvas at 360 (value ${value})`, () => {
        const { inputs } = draw(game, 360, value);
        expect(inputs.length).toBe(game.inLabels.length);
        for (const t of inputs) expect(t.x - Math.min(t.s.length * CHAR, t.maxW)).toBeGreaterThanOrEqual(0);
      });
    }
    for (const width of [440, 560]) {
      it(`input labels fit without squeezing at ${width}`, () => {
        for (const value of [-1, 0, 1]) {
          for (const t of draw(game, width, value).inputs) {
            expect(t.s.length * CHAR).toBeLessThanOrEqual(t.maxW);
            expect(t.x - t.s.length * CHAR).toBeGreaterThanOrEqual(0);
          }
        }
      });
    }
    it('the layout does not move when the words change', () => {
      for (const width of [360, 560]) {
        const xs = v => draw(game, width, v).ctx.texts.map(t => [t.align, t.x, t.y, t.maxW]);
        expect(xs(1)).toEqual(xs(0));
        expect(xs(-1)).toEqual(xs(0));
      }
    });
    it('output text stays on the canvas at 560', () => {
      for (const t of draw(game, 560, 1).ctx.texts.filter(t => t.align === 'left' && t.x > 0 && t.s !== t.s.toUpperCase())) {
        expect(t.x + Math.min(t.s.length * CHAR, t.maxW)).toBeLessThanOrEqual(560);
      }
    });
  });
}
