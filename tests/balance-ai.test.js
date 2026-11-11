import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { mulberry32 } from '../engine/rng.js';
import { genomeLength, createActs } from '../engine/tinynet.js';
import { randomGenome } from '../engine/evolve.js';
import { X_LIMIT, FAIL_ANGLE, LIMIT, PUSH_DV } from '../games/balance/sim.js';
import {
  SIZES, IN_LABELS, OUT_LABELS, sense, aiAct, TRAIN_PUSHES, makePushes, evaluate,
} from '../games/balance/ai.js';

describe('what the AI senses and does', () => {
  it('SIZES give 37 weights', () => {
    expect(genomeLength(SIZES)).toBe(37);
    expect(IN_LABELS).toHaveLength(4);
    expect(OUT_LABELS).toEqual(['Push']);
  });

  it('sense is clamped and scaled', () => {
    expect(sense({ x: X_LIMIT, v: 0, th: 0, w: 0 })[0]).toBeCloseTo(1);
    expect(sense({ x: 0, v: 0, th: 0.2, w: 0 })[2]).toBeCloseTo(0.5);
    expect(sense({ x: 0, v: 1e9, th: 0, w: -1e9 })[1]).toBe(1);
    expect(sense({ x: 0, v: 1e9, th: 0, w: -1e9 })[3]).toBe(-1);
    expect(FAIL_ANGLE).toBe(0.4);
  });

  it('aiAct is tanh-bounded', () => {
    const rng = mulberry32(3), acts = createActs(SIZES), input = new Float32Array(4);
    for (let k = 0; k < 200; k++) {
      const genome = randomGenome(37, rng);
      const g = { x: (rng() - 0.5) * 6, v: (rng() - 0.5) * 8, th: (rng() - 0.5), w: (rng() - 0.5) * 10 };
      const u = aiAct(genome, g, acts, input);
      expect(Math.abs(u)).toBeLessThanOrEqual(1);
      expect(Number.isFinite(u)).toBe(true);
    }
  });
});

describe('how the AI is tested', () => {
  it('makePushes honours its contract', () => {
    const a = makePushes(mulberry32(5)), b = makePushes(mulberry32(5));
    expect(a).toEqual(b);
    expect(a).toHaveLength(TRAIN_PUSHES);
    for (const p of a) {
      expect(Number.isInteger(p.t)).toBe(true);
      expect(p.t).toBeGreaterThanOrEqual(60);
      expect(p.t).toBeLessThanOrEqual(LIMIT - 60);
      expect([-1, 1]).toContain(p.dir);
      expect(p.dv).toBeGreaterThanOrEqual(0.5 * PUSH_DV);
      expect(p.dv).toBeLessThanOrEqual(PUSH_DV);
    }
    expect(makePushes(mulberry32(5), 7)).toHaveLength(7);
  });

  it('evaluate is deterministic for a seed and within 0..LIMIT', () => {
    const genome = randomGenome(37, mulberry32(9));
    const a = evaluate(genome, mulberry32(1)), b = evaluate(genome, mulberry32(1));
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(LIMIT);
  });

  it('a brain that does nothing falls fast', () => {
    expect(evaluate(new Float32Array(37), mulberry32(2))).toBeLessThan(120);
  });

  it('evaluate never applies wind', () => {
    expect(readFileSync(new URL('../games/balance/ai.js', import.meta.url), 'utf8')).not.toContain('WIND_FORCE');
  });
});
