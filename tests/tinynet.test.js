import { describe, it, expect } from 'vitest';
import { genomeLength, createActs, forward, weightIndex, biasIndex } from '../engine/tinynet.js';

describe('tinynet', () => {
  it('counts weights and biases for any layer sizes', () => {
    expect(genomeLength([6, 8, 2])).toBe(74);
    expect(genomeLength([2, 1])).toBe(3);
  });

  it('allocates one activation buffer per layer', () => {
    const acts = createActs([6, 8, 2]);
    expect(acts.map(a => a.length)).toEqual([6, 8, 2]);
  });

  it('computes tanh(w·x + b) for a single layer', () => {
    // [2,1]: weights w0=0.5, w1=-1, bias 0.25
    const g = Float32Array.from([0.5, -1, 0.25]);
    const acts = createActs([2, 1]);
    const out = forward(g, [2, 1], [1, 0.5], acts);
    expect(out[0]).toBeCloseTo(Math.tanh(0.5 - 0.5 + 0.25), 6);
  });

  it('chains layers and keeps every activation for drawing', () => {
    // [1,1,1]: hidden = tanh(2*x + 0), out = tanh(-1*hidden + 0)
    const g = Float32Array.from([2, 0, -1, 0]);
    const acts = createActs([1, 1, 1]);
    forward(g, [1, 1, 1], [0.3], acts);
    expect(acts[0][0]).toBeCloseTo(0.3, 6);
    expect(acts[1][0]).toBeCloseTo(Math.tanh(0.6), 6);
    expect(acts[2][0]).toBeCloseTo(Math.tanh(-Math.tanh(0.6)), 6);
  });

  it('locates a weight by layer, input and output', () => {
    const sizes = [6, 8, 2];
    expect(weightIndex(sizes, 0, 0, 0)).toBe(0);
    expect(weightIndex(sizes, 0, 5, 1)).toBe(6 + 5);
    expect(biasIndex(sizes, 0, 0)).toBe(48);
    expect(weightIndex(sizes, 1, 0, 0)).toBe(56);
    expect(biasIndex(sizes, 1, 1)).toBe(73);
  });
});
