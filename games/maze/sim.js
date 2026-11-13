// Treasure Maze: a tabular Q-learning gridworld. No DOM, so tests, the page
// and the story recorder all share it.
import { mulberry32 } from '../../engine/rng.js';
import { createQTable, stateValue, chooseAction, update } from '../../engine/qlearn.js';

export const ACTIONS = [
  { name: 'up', dr: -1, dc: 0 },
  { name: 'down', dr: 1, dc: 0 },
  { name: 'left', dr: 0, dc: -1 },
  { name: 'right', dr: 0, dc: 1 },
];
export const REWARD = { big: 10, small: 3, pit: -10, step: -0.1 };
export const STEP_CAP = 100;
export const DEFAULTS = { alpha: 0.5, gamma: 0.9, epsilon: 0.5 };

// . floor, # wall, S start, T +10, N +3, P pit
export const MAPS = {
  'near-or-far': { id: 'near-or-far', title: 'Near or far', rows: ['T.....', '.####.', '......', '.#..#.', '......', 'S.N...'] },
  'cliff-edge': { id: 'cliff-edge', title: 'Cliff edge', rows: ['......', '......', '......', '......', '......', 'SPPPPT'] },
};
export const MAP_IDS = ['near-or-far', 'cliff-edge'];

const KIND = { '.': 'floor', '#': 'wall', T: 'big', N: 'small', P: 'pit' };
const OUTCOME = { T: 'big', N: 'small', P: 'pit' };

export function loadMap(id) {
  const m = MAPS[id];
  if (!m) throw new Error(`unknown map: ${id}`);
  const flat = m.rows.join('');
  return {
    id, title: m.title, rows: m.rows,
    nRows: m.rows.length, nCols: m.rows[0].length, nStates: flat.length,
    start: flat.indexOf('S'),
    cells: Array.from(flat, c => (c === 'S' ? '.' : c)),
  };
}

export function tileKind(map, s) {
  return KIND[map.cells[s]];
}

export function stepEnv(map, s, a) {
  const row = Math.floor(s / map.nCols) + ACTIONS[a].dr;
  const col = (s % map.nCols) + ACTIONS[a].dc;
  const inside = row >= 0 && row < map.nRows && col >= 0 && col < map.nCols;
  const moved = row * map.nCols + col;
  const s2 = inside && map.cells[moved] !== '#' ? moved : s;
  const outcome = OUTCOME[map.cells[s2]] || null;
  return { s2, r: REWARD.step + (outcome ? REWARD[outcome] : 0), done: outcome !== null, outcome };
}

export function createAgent(mapId, seed) {
  const map = loadMap(mapId);
  return { map, q: createQTable(map.nStates, ACTIONS.length), rng: mulberry32(seed), episodes: 0, history: [] };
}

export function startEpisode(agent) {
  return { s: agent.map.start, steps: 0, reward: 0, outcome: null };
}

// One move: choose, step, learn. Mutates and returns ep.
export function stepEpisode(agent, ep, { alpha, gamma, epsilon }) {
  if (ep.outcome) return ep;
  const a = chooseAction(agent.q, ep.s, epsilon, agent.rng);
  const res = stepEnv(agent.map, ep.s, a);
  update(agent.q, ep.s, a, res.r, res.s2, res.done, { alpha, gamma });
  ep.s = res.s2;
  ep.steps++;
  ep.reward += res.r;
  ep.outcome = res.outcome;
  if (!ep.outcome && ep.steps >= STEP_CAP) ep.outcome = 'cap';
  if (ep.outcome) {
    agent.history.push(ep.reward);
    agent.episodes++;
  }
  return ep;
}

export function runEpisode(agent, params = DEFAULTS) {
  const ep = startEpisode(agent);
  while (!ep.outcome) stepEpisode(agent, ep, params);
  return ep;
}

export function trainEpisodes(agent, n, params = DEFAULTS) {
  for (let i = 0; i < n; i++) runEpisode(agent, params);
  return agent;
}

const isFloor = (map, s) => map.cells[s] === '.';

// Follow the best action from the start, no exploring. Ties go to the lowest
// action index, so the walk is always the same.
export function greedyWalk(agent) {
  const { map, q } = agent;
  const path = [map.start];
  let s = map.start;
  for (let i = 0; i < STEP_CAP; i++) {
    let best = 0;
    for (let a = 1; a < ACTIONS.length; a++) if (q.v[s * q.nActions + a] > q.v[s * q.nActions + best]) best = a;
    const res = stepEnv(map, s, best);
    s = res.s2;
    path.push(s);
    if (res.done) return { path, outcome: res.outcome };
  }
  return { path, outcome: 'cap' };
}

// Best value per tile; 0 for walls and treasure/pit tiles.
export function valueGrid(agent) {
  const { map, q } = agent;
  return Array.from({ length: map.nStates }, (_, s) => (isFloor(map, s) ? stateValue(q, s) : 0));
}

// Best action per floor tile; null for walls, treasure, pits and unvisited tiles.
export function policyGrid(agent) {
  const { map, q } = agent;
  return Array.from({ length: map.nStates }, (_, s) => {
    if (!isFloor(map, s)) return null;
    const vals = Array.from({ length: q.nActions }, (_, a) => q.v[s * q.nActions + a]);
    if (vals.every(x => x === vals[0])) return null;
    return vals.indexOf(Math.max(...vals));
  });
}
