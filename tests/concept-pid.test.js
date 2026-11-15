import { describe, it, expect } from 'vitest';
import { G, DT, SPAN, createSim, stepSim, gust, setTarget } from '../concepts/pid/sim.js';
import { presets } from '../concepts/pid/play.js';

function run(k, seconds, s = createSim()) {
  const errs = [];
  for (let n = 0; n < Math.round(seconds / DT); n++) { stepSim(s, k); errs.push(s.tgt - s.y); }
  return { s, errs };
}
const last = (errs, sec) => errs.slice(-Math.round(sec / DT));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

describe('pid sim', () => {
  it('createSim starts at y=1, target 5', () => {
    const s = createSim();
    expect(s.y).toBe(1); expect(s.tgt).toBe(5); expect(G).toBe(9.8);
  });
  it('gust lowers v by 6', () => {
    const s = createSim(); gust(s); expect(s.v).toBe(-6);
  });
  it('setTarget clamps to 1..9', () => {
    const s = createSim(); setTarget(s, 99); expect(s.tgt).toBe(9); setTarget(s, -3); expect(s.tgt).toBe(1);
  });
  it('y stays within 0..10 and thrust within +-40 for extreme dials', () => {
    const s = createSim();
    for (let n = 0; n < 1200; n++) {
      stepSim(s, { p: 20, i: 8, d: 8 });
      expect(s.y).toBeGreaterThanOrEqual(0); expect(s.y).toBeLessThanOrEqual(10);
      expect(Math.abs(s.thrust)).toBeLessThanOrEqual(40);
    }
  });
  it('history never exceeds 480 samples', () => {
    const { s } = run({ p: 6, i: 0, d: 0 }, 20);
    expect(s.hist.length).toBe(SPAN / DT);
    expect(s.hist.length).toBe(480);
  });
});

describe('preset claims', () => {
  const [pOnly, addD, addI] = presets.map(p => p.state);
  it('P only sags below the line', () => {
    const { errs } = run(pOnly, 20);
    const m = mean(last(errs, 5));
    expect(m).toBeGreaterThan(0.3); expect(m).toBeLessThan(1.5);
    expect(last(errs, 5).every(e => e !== 0)).toBe(true);
  });
  it('P only still bobs', () => {
    const { errs } = run(pOnly, 10);
    let flips = 0;
    for (let n = 1; n < errs.length; n++) if (Math.sign(errs[n]) !== Math.sign(errs[n - 1])) flips++;
    expect(flips).toBeGreaterThanOrEqual(2);
  });
  it('adding D stops the bobbing', () => {
    const l = last(run(addD, 20).errs, 5);
    expect(Math.max(...l) - Math.min(...l)).toBeLessThan(0.05);
  });
  it('adding D but still sags', () => {
    expect(mean(last(run(addD, 20).errs, 5))).toBeGreaterThan(0.3);
  });
  it('adding I closes the gap', () => {
    const { errs } = run(addI, 20);
    expect(Math.abs(errs[errs.length - 1])).toBeLessThan(0.05);
  });
});

describe('presets', () => {
  it('has the three presets', () => {
    expect(presets.map(p => p.label)).toEqual(['Set P only', 'Add D', 'Add I']);
    expect(presets.map(p => p.state)).toEqual([{ p: 6, i: 0, d: 0 }, { p: 6, i: 0, d: 3 }, { p: 6, i: 2, d: 3 }]);
  });
  it('every preset applies cleanly', () => {
    for (const p of presets) {
      const { s } = run(p.state, 5);
      for (const v of [s.y, s.v, s.integ, ...s.terms]) expect(Number.isFinite(v)).toBe(true);
    }
  });
  it('presets text mentions the dial it changes', () => {
    expect(presets[0].text).toMatch(/\bP\b/);
    expect(presets[1].text).toMatch(/\bD\b/);
    expect(presets[2].text).toMatch(/\bI\b/);
  });
});
