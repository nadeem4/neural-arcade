// Tabular Q-learning: a table of values, epsilon-greedy choice, one-step update.

export function createQTable(nStates, nActions) {
  return { nStates, nActions, v: new Float64Array(nStates * nActions) };
}

export function qValue(q, s, a) {
  return q.v[s * q.nActions + a];
}

// Largest Q in state s, ties broken at random.
export function bestAction(q, s, rng) {
  const best = stateValue(q, s);
  const tied = [];
  for (let a = 0; a < q.nActions; a++) if (qValue(q, s, a) === best) tied.push(a);
  return tied[Math.floor(rng() * tied.length)];
}

export function stateValue(q, s) {
  let best = -Infinity;
  for (let a = 0; a < q.nActions; a++) best = Math.max(best, qValue(q, s, a));
  return best;
}

// With chance epsilon try a random action, otherwise take the best one.
export function chooseAction(q, s, epsilon, rng) {
  if (rng() < epsilon) return Math.floor(rng() * q.nActions);
  return bestAction(q, s, rng);
}

// Q(s,a) moves toward r + gamma * best Q(s2); nothing follows a finished episode.
export function update(q, s, a, r, s2, done, { alpha, gamma }) {
  const target = r + (done ? 0 : gamma * stateValue(q, s2));
  const i = s * q.nActions + a;
  q.v[i] += alpha * (target - q.v[i]);
}
