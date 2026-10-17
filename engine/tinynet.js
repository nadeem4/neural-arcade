// A dense tanh network small enough to draw every weight.
// Genome layout, per layer: weights grouped by output neuron (out j, then in i), then that layer's biases.

export function genomeLength(sizes) {
  let n = 0;
  for (let l = 0; l < sizes.length - 1; l++) n += sizes[l] * sizes[l + 1] + sizes[l + 1];
  return n;
}

export function createActs(sizes) {
  return sizes.map(n => new Float32Array(n));
}

function layerOffset(sizes, layer) {
  let p = 0;
  for (let l = 0; l < layer; l++) p += sizes[l] * sizes[l + 1] + sizes[l + 1];
  return p;
}

export function weightIndex(sizes, layer, input, output) {
  return layerOffset(sizes, layer) + output * sizes[layer] + input;
}

export function biasIndex(sizes, layer, output) {
  return layerOffset(sizes, layer) + sizes[layer] * sizes[layer + 1] + output;
}

// Runs the net, filling acts[0..] with every layer's activation. Returns the output layer.
export function forward(genome, sizes, input, acts) {
  const first = acts[0];
  for (let i = 0; i < first.length; i++) first[i] = input[i];
  let p = 0;
  for (let l = 0; l < sizes.length - 1; l++) {
    const x = acts[l], y = acts[l + 1], nin = sizes[l], nout = sizes[l + 1];
    for (let j = 0; j < nout; j++) {
      let s = 0;
      for (let i = 0; i < nin; i++) s += genome[p++] * x[i];
      y[j] = s;
    }
    for (let j = 0; j < nout; j++) y[j] = Math.tanh(y[j] + genome[p++]);
  }
  return acts[acts.length - 1];
}
