import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../engine/rng.js';
import { PID_RANGES, LIMIT } from '../games/balance/sim.js';
import { GENES, dialsFromGenome, evaluate, CENTRE_BAND, createTuner, TUNER_STORY_SEED } from '../games/balance/tune.js';

const KEYS = ['p', 'i', 'd'];
const onStep = (v, { min, step }) => Math.abs((v - min) / step - Math.round((v - min) / step)) < 1e-9;

describe('genome to dials', () => {
  it('has three genes', () => expect(GENES).toBe(3));

  it('zeros map to the middle of each range', () => {
    expect(dialsFromGenome([0, 0, 0])).toEqual({ p: 30, i: 15, d: 5 });
  });

  it('huge genes land exactly on max and min', () => {
    expect(dialsFromGenome([1e9, 1e9, 1e9])).toEqual({ p: 60, i: 30, d: 10 });
    expect(dialsFromGenome([-1e9, -1e9, -1e9])).toEqual({ p: 0, i: 0, d: 0 });
  });

  it('every dial is on its step and in range', () => {
    const rng = mulberry32(1);
    for (let n = 0; n < 200; n++) {
      const genome = [0, 0, 0].map(() => (rng() * 2 - 1) * 6);
      const dials = dialsFromGenome(genome);
      for (const k of KEYS) {
        const r = PID_RANGES[k];
        expect(dials[k]).toBeGreaterThanOrEqual(r.min);
        expect(dials[k]).toBeLessThanOrEqual(r.max);
        expect(onStep(dials[k], r)).toBe(true);
      }
    }
  });

  it('a larger gene never gives a smaller dial', () => {
    KEYS.forEach((k, idx) => {
      let prev = -Infinity;
      for (let x = -8; x <= 8; x += 0.1) {
        const genome = [0, 0, 0];
        genome[idx] = x;
        const v = dialsFromGenome(genome)[k];
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    });
  });
});

const mean = (dials, seeds) => seeds.reduce((s, k) => s + evaluate(dials, mulberry32(k)), 0) / seeds.length;

describe('two-test scoring', () => {
  it('is deterministic and an integer in 0..LIMIT', () => {
    const a = evaluate({ p: 25, i: 12, d: 4 }, mulberry32(1)), b = evaluate({ p: 25, i: 12, d: 4 }, mulberry32(1));
    expect(a).toBe(b);
    expect(Number.isInteger(a)).toBe(true);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(LIMIT);
  });

  it('no push at all scores under 3 s', () => {
    expect(evaluate({ p: 0, i: 0, d: 0 }, mulberry32(1))).toBeLessThan(180);
  });

  it('good dials score at least 18 s', () => {
    expect(evaluate({ p: 25, i: 12, d: 4 }, mulberry32(1))).toBeGreaterThanOrEqual(1080);
  });

  it('I earns its keep: it adds at least 1 s over seeds 1-5', () => {
    const seeds = [1, 2, 3, 4, 5];
    expect(mean({ p: 25, i: 12, d: 4 }, seeds) - mean({ p: 25, i: 0, d: 4 }, seeds)).toBeGreaterThanOrEqual(60);
    expect(CENTRE_BAND).toBeGreaterThan(0);
  });
});

const inRange = d => KEYS.every(k => d[k] >= PID_RANGES[k].min && d[k] <= PID_RANGES[k].max);
const run = (seed, n) => { const t = createTuner(seed); for (let k = 0; k < n; k++) t.runGeneration(); return t; };
const avg = a => a.reduce((s, v) => s + v, 0) / a.length;

describe('the tuner', () => {
  it('same seed repeats, different seeds differ', () => {
    const a = run(1, 5), b = run(1, 5), c = run(2, 5);
    expect(a.history).toEqual(b.history);
    expect(a.dialsHistory).toEqual(b.dialsHistory);
    expect(c.dialsHistory).not.toEqual(a.dialsHistory);
  });

  it('advances one generation at a time and returns the latest', () => {
    const t = createTuner(3);
    for (let n = 1; n <= 3; n++) {
      const r = t.runGeneration();
      expect([t.gen, t.history.length, t.dialsHistory.length]).toEqual([n, n, n]);
      expect(r).toEqual({ gen: n, seconds: t.history.at(-1), dials: t.dialsHistory.at(-1) });
    }
  });

  it('has sane dials before any generation', () => {
    const t = createTuner(1);
    expect(t.gen).toBe(0);
    expect(t.history).toEqual([]);
    expect(Object.values(t.bestDials).every(Number.isFinite)).toBe(true);
    expect(inRange(t.bestDials)).toBe(true);
  });

  it('learns and finds I, for seeds 1-5', () => {
    const early = [], late = [];
    for (let seed = 1; seed <= 5; seed++) {
      const t = run(seed, 30);
      expect(Math.max(...t.history)).toBeGreaterThanOrEqual(15);
      early.push(avg(t.dialsHistory.slice(0, 3).map(d => d.i)));
      late.push(avg(t.dialsHistory.slice(24, 30).map(d => d.i)));
      expect(t.dialsHistory.every(inRange)).toBe(true);
    }
    expect(avg(late)).toBeGreaterThan(avg(early));
  });

  it('the story seed starts untuned, finds I, and first holds 18 s mid-run', () => {
    const t = run(TUNER_STORY_SEED, 30);
    expect(t.history[0]).toBeLessThan(10);
    expect(t.dialsHistory[0].i).toBeLessThanOrEqual(6);
    expect(t.dialsHistory.at(-1).i).toBeGreaterThanOrEqual(8);
    const first = t.history.findIndex(s => s >= 18) + 1;
    expect(first).toBeGreaterThanOrEqual(8);
    expect(first).toBeLessThanOrEqual(25);
  });

  it('starts from near-zero dials, like a person who has tuned nothing', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const d = createTuner(seed).bestDials;
      expect(d.p).toBeLessThanOrEqual(15);
      expect(d.i).toBeLessThanOrEqual(8);
    }
  });

  it('dials copied to a plain object score the same', () => {
    const t = run(1, 5), copy = { ...t.bestDials };
    expect(evaluate(copy, mulberry32(7))).toBe(evaluate(t.bestDials, mulberry32(7)));
  });
});
