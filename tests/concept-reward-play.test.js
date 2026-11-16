import { describe, it, expect } from 'vitest';
import { DEFAULTS, trainToy } from '../concepts/reward-design/sim.js';
import { presets, RANGES, playgroundHtml, shouldAnimate, verdictOf, receiptLines } from '../concepts/reward-design/play.js';

const pay = s => ({ ...DEFAULTS, ...s });
const run = s => trainToy(pay(s), { seed: 1 });

describe('presets', () => {
  it('has the three presets with their states', () => {
    expect(presets.map(p => p.label)).toEqual(['Pay for speed', 'Fine the lawn', 'Pay by the tile']);
    expect(presets.map(p => p.state)).toEqual([
      { time: 1, lawn: 0, perTile: 0 }, { time: 1, lawn: 20, perTile: 0 }, { time: 1, lawn: 20, perTile: 2 },
    ]);
  });
  it('each preset produces the behaviour its text promises', () => {
    const [speed, fine, tile] = presets.map(p => run(p.state));
    expect(presets[0].text).toMatch(/lawn/i);
    expect(speed.arrived).toBe(true); expect(speed.lawnTiles).toBeGreaterThan(0);
    expect(presets[1].text).toMatch(/road/i);
    expect(fine.arrived).toBe(true); expect(fine.lawnTiles).toBe(0);
    expect(presets[2].text).toMatch(/never|loop/i);
    expect(tile.arrived).toBe(false); expect(tile.tiles).toBeGreaterThan(10);
  });
});

describe('slider ranges', () => {
  it('contain every preset value on their step', () => {
    for (const p of presets) for (const [k, v] of Object.entries(p.state)) {
      const r = RANGES[k];
      expect(v, k).toBeGreaterThanOrEqual(r.min); expect(v, k).toBeLessThanOrEqual(r.max);
      expect((v - r.min) % r.step, k).toBe(0);
    }
  });
});

describe('markup', () => {
  const html = playgroundHtml();
  it('has three labelled range sliders', () => {
    const inputs = [...html.matchAll(/<input[^>]*type="range"[^>]*>/g)].map(m => m[0]);
    expect(inputs).toHaveLength(3);
    for (const i of inputs) {
      const id = i.match(/id="([^"]+)"/)[1];
      expect(html).toContain(`for="${id}"`);
    }
    for (const k of ['time', 'lawn', 'perTile']) expect(html).toContain(`data-r="${k}"`);
  });
  it('has a grid canvas, a receipt and a verdict', () => {
    expect(html).toContain('<canvas');
    expect(html).toContain('data-r="receipt"');
    expect(html).toContain('data-r="verdict"');
  });
});

describe('reduced motion', () => {
  it('animates unless the user asks for reduced motion', () => {
    expect(shouldAnimate({ matches: true })).toBe(false);
    expect(shouldAnimate({ matches: false })).toBe(true);
    expect(shouldAnimate(null)).toBe(true);
  });
});

describe('verdict and receipt', () => {
  it('names the loophole', () => {
    expect(verdictOf(pay(presets[0].state), run(presets[0].state))).toMatch(/cut across the lawn/i);
    expect(verdictOf(pay(presets[1].state), run(presets[1].state))).toMatch(/legal/i);
    expect(verdictOf(pay(presets[2].state), run(presets[2].state))).toMatch(/never drops|never arrived/i);
  });
  it('receipt lines add up to the trip reward', () => {
    for (const p of presets) {
      const r = run(p.state);
      const total = receiptLines(pay(p.state), r).reduce((n, l) => n + l.amount, 0);
      expect(total).toBeCloseTo(r.reward, 6);
    }
  });
});

describe('verdict for a slow driver', () => {
  it('does not claim it prefers driving when it mostly stands still', () => {
    const r = { arrived: false, steps: 40, tiles: 5, lawnTiles: 0 };
    expect(verdictOf(pay({ perTile: 2 }), r)).not.toMatch(/earns more by driving/);
    expect(verdictOf(pay({ perTile: 2 }), { ...r, tiles: 30 })).toMatch(/earns more by driving/);
  });
});
