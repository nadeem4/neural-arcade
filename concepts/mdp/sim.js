// A tiny weather MDP: from each state, where the next day goes and the reward for landing there. Pure logic, no DOM.
// The next state depends only on the current one, never on how the agent got there.
export const MDP = {
  states: ['Sunny', 'Cloudy', 'Rainy'],
  moves: {
    Sunny: [{ to: 'Sunny', p: 0.6, reward: 1 }, { to: 'Cloudy', p: 0.3, reward: 0 }, { to: 'Rainy', p: 0.1, reward: -1 }],
    Cloudy: [{ to: 'Sunny', p: 0.3, reward: 1 }, { to: 'Cloudy', p: 0.4, reward: 0 }, { to: 'Rainy', p: 0.3, reward: -1 }],
    Rainy: [{ to: 'Sunny', p: 0.2, reward: 1 }, { to: 'Cloudy', p: 0.4, reward: 0 }, { to: 'Rainy', p: 0.4, reward: -1 }],
  },
};

// The odds out of a state. Takes the state alone, so the past cannot matter.
export const oddsFrom = (mdp, state) => mdp.moves[state];

// Draw the next state by its odds. No history argument: that is the Markov property.
export function stepMdp(mdp, state, rng) {
  const rows = oddsFrom(mdp, state);
  let u = rng();
  for (const r of rows) {
    if (u < r.p) return { to: r.to, reward: r.reward };
    u -= r.p;
  }
  const last = rows.at(-1);
  return { to: last.to, reward: last.reward };
}

// A walk of `steps` days: steps + 1 states, starting at `start`.
export function walk(mdp, start, steps, rng) {
  const out = [start];
  for (let i = 0; i < steps; i++) out.push(stepMdp(mdp, out.at(-1), rng).to);
  return out;
}

// How many of `steps` days were spent in each state, starting from the first state.
export function stationary(mdp, steps, rng) {
  const counts = Object.fromEntries(mdp.states.map(s => [s, 0]));
  for (const s of walk(mdp, mdp.states[0], steps - 1, rng)) counts[s]++;
  return counts;
}
