// Tabular Q-learning: a table of values, epsilon-greedy choice, one-step update.

export function createQTable(nStates, nActions) {
  return { nStates, nActions, v: new Float64Array(nStates * nActions) };
}

export function qValue(q, s, a) {
  return q.v[s * q.nActions + a];
}

export function stateValue(q, s) {
  let best = -Infinity;
  for (let a = 0; a < q.nActions; a++) best = Math.max(best, qValue(q, s, a));
  return best;
}

// Largest Q in state s; ties are broken with rng (a unique best needs no draw).
export function bestAction(q, s, rng) {
  const best = stateValue(q, s);
  let count = 0, first = 0;
  for (let a = 0; a < q.nActions; a++) {
    if (qValue(q, s, a) === best) { if (count++ === 0) first = a; }
  }
  if (count === 1) return first;
  let k = Math.floor(rng() * count);
  for (let a = 0; a < q.nActions; a++) if (qValue(q, s, a) === best && k-- === 0) return a;
}

// With chance epsilon take a random action, otherwise the best one.
export function chooseAction(q, s, epsilon, rng) {
  if (rng() < epsilon) return Math.floor(rng() * q.nActions);
  return bestAction(q, s, rng);
}

// Q(s,a) moves toward r + gamma * best Q(s2); nothing follows a finished episode.
// Returns how much Q changed.
export function update(q, s, a, r, s2, done, { alpha, gamma }) {
  const target = done ? r : r + gamma * stateValue(q, s2);
  const i = s * q.nActions + a;
  const change = alpha * (target - q.v[i]);
  q.v[i] += change;
  return change;
}
