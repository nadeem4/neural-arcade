import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../engine/rng.js';
import { PID_RANGES, LIMIT } from '../games/balance/sim.js';
import { GENES, dialsFromGenome, evaluate, CENTRE_BAND } from '../games/balance/tune.js';

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
