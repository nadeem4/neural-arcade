import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../engine/rng.js';
import { randomGenome } from '../engine/evolve.js';
import { genomeLength, createActs } from '../engine/tinynet.js';
import { gradient, datasetLoss, trainEpoch } from '../engine/train.js';

const SIZES = [3, 4, 1];
const sample = (x, y) => ({ input: Float32Array.from(x), target: Float32Array.from([y]) });

describe('gradient', () => {
  it('matches a finite-difference estimate for every weight', () => {
    const g = Float64Array.from(randomGenome(genomeLength(SIZES), mulberry32(3)));
    const data = [sample([0.2, -0.5, 0.9], 0.4), sample([1, 0.1, -0.3], -0.7)];
    const { grad } = gradient(g, SIZES, data);
    const h = 1e-3; // activations are 32-bit floats, so a tiny step drowns in rounding noise
    for (let i = 0; i < g.length; i++) {
      const up = g.slice(), down = g.slice();
      up[i] += h; down[i] -= h;
      const numeric = (datasetLoss(up, SIZES, data) - datasetLoss(down, SIZES, data)) / (2 * h);
      expect(grad[i]).toBeCloseTo(numeric, 3);
    }
  });
});

describe('training', () => {
  it('lowers the loss on data it can fit', () => {
    const rng = mulberry32(5);
    const data = Array.from({ length: 60 }, () => {
      const x = [rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1];
      return sample(x, Math.tanh(x[0] - x[1]));
    });
    const g = randomGenome(genomeLength(SIZES), mulberry32(1));
    const before = datasetLoss(g, SIZES, data);
    let after = before;
    for (let e = 0; e < 200; e++) after = trainEpoch(g, SIZES, data, { lr: 0.1, batch: 10, rng });
    expect(after).toBeLessThan(before / 10);
  });

  it('reports the loss as half the mean squared error', () => {
    const g = new Float32Array(genomeLength(SIZES)); // all zero: output is tanh(0) = 0
    expect(datasetLoss(g, SIZES, [sample([1, 1, 1], 0.5)])).toBeCloseTo(0.125);
    expect(createActs(SIZES)).toHaveLength(3);
  });
});
