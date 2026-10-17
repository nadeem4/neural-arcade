// Gradient descent for the tiny tanh network: learning from examples instead of by breeding.
// Loss is half the squared gap between the network's output and the target, averaged over the examples.
import { createActs, forward } from './tinynet.js';

function layerOffsets(sizes) {
  const offs = [];
  let p = 0;
  for (let l = 0; l < sizes.length - 1; l++) { offs.push(p); p += sizes[l] * sizes[l + 1] + sizes[l + 1]; }
  return offs;
}

export function datasetLoss(genome, sizes, data) {
  const acts = createActs(sizes);
  let sum = 0;
  for (const { input, target } of data) {
    const out = forward(genome, sizes, input, acts);
    for (let k = 0; k < out.length; k++) sum += 0.5 * (out[k] - target[k]) ** 2;
  }
  return sum / data.length;
}

// Backpropagation: how much the loss would change if each of the genome's numbers moved a little.
export function gradient(genome, sizes, data) {
  const acts = createActs(sizes), offs = layerOffsets(sizes), L = sizes.length - 1;
  const grad = new Float64Array(genome.length);
  const deltas = sizes.map(n => new Float64Array(n));
  let loss = 0;
  for (const { input, target } of data) {
    const out = forward(genome, sizes, input, acts);
    for (let k = 0; k < out.length; k++) {
      loss += 0.5 * (out[k] - target[k]) ** 2;
      deltas[L][k] = (out[k] - target[k]) * (1 - out[k] * out[k]); // through tanh
    }
    for (let l = L - 1; l >= 0; l--) {
      const x = acts[l], d = deltas[l + 1], nin = sizes[l], nout = sizes[l + 1], p = offs[l];
      for (let j = 0; j < nout; j++) {
        for (let i = 0; i < nin; i++) grad[p + j * nin + i] += d[j] * x[i];
        grad[p + nin * nout + j] += d[j];
      }
      if (l > 0) {
        for (let i = 0; i < nin; i++) {
          let s = 0;
          for (let j = 0; j < nout; j++) s += genome[p + j * nin + i] * d[j];
          deltas[l][i] = s * (1 - x[i] * x[i]);
        }
      }
    }
  }
  for (let i = 0; i < grad.length; i++) grad[i] /= data.length;
  return { loss: loss / data.length, grad };
}

// One pass over the data in shuffled mini-batches, stepping every number downhill. Returns the loss afterwards.
export function trainEpoch(genome, sizes, data, { lr = 0.05, batch = 32, rng = Math.random } = {}) {
  const order = data.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  for (let s = 0; s < order.length; s += batch) {
    const { grad } = gradient(genome, sizes, order.slice(s, s + batch).map(i => data[i]));
    for (let i = 0; i < genome.length; i++) genome[i] -= lr * grad[i];
  }
  return datasetLoss(genome, sizes, data);
}
