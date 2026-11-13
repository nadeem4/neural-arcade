// Treasure Maze: a tabular Q-learning gridworld. No DOM, so tests, the page
// and the story recorder all share it.
import { mulberry32 } from '../../engine/rng.js';
import { createQTable, bestAction, stateValue, chooseAction, update } from '../../engine/qlearn.js';

export const ACTIONS = [
  { name: 'up', dx: 0, dy: -1 },
  { name: 'right', dx: 1, dy: 0 },
  { name: 'down', dx: 0, dy: 1 },
  { name: 'left', dx: -1, dy: 0 },
];
export const REWARD = { big: 10, small: 3, pit: -10, step: -0.1 };
export const STEP_CAP = 100;
export const DEFAULTS = { alpha: 0.5, gamma: 0.9, epsilon: 0.5 };

// . floor, # wall, S start, T +10, N +3, P pit
export const MAPS = {
  'near-or-far': { rows: ['T.....', '.####.', '......', '.#..#.', '......', 'S.N...'] },
  'cliff-edge': { rows: ['......', '......', '......', '......', '......', 'SPPPPT'] },
};
export const MAP_IDS = ['near-or-far', 'cliff-edge'];

const KINDS = { '.': 'floor', '#': 'wall', S: 'start', T: 'big', N: 'small', P: 'pit' };
const OUTCOME = { big: 'big', small: 'small', pit: 'pit' };

export function loadMap(id) {
  const rows = MAPS[id].rows;
  const h = rows.length, w = rows[0].length;
  return { id, rows, w, h, nStates: w * h, start: rows.join('').indexOf('S') };
}

export function tileKind(map, s) {
  return KINDS[map.rows[Math.floor(s / map.w)][s % map.w]];
}

export function stepEnv(map, s, a) {
  const x = (s % map.w) + ACTIONS[a].dx;
  const y = Math.floor(s / map.w) + ACTIONS[a].dy;
  const inside = x >= 0 && x < map.w && y >= 0 && y < map.h;
  const s2 = inside && tileKind(map, y * map.w + x) !== 'wall' ? y * map.w + x : s;
  const kind = tileKind(map, s2);
  if (OUTCOME[kind]) return { s2, r: REWARD[kind], done: true, outcome: kind };
  return { s2, r: REWARD.step, done: false, outcome: null };
}

export function createAgent({ mapId, seed = 1, ...params }) {
  const map = loadMap(mapId);
  return {
    map,
    q: createQTable(map.nStates, ACTIONS.length),
    rng: mulberry32(seed),
    params: { ...DEFAULTS, ...params },
    episodes: 0,
  };
}

export function startEpisode(agent) {
  return { s: agent.map.start, steps: 0, ret: 0, done: false, outcome: null };
}

// One step: choose, move, and (unless learn is false) update the table.
export function stepEpisode(agent, ep, { learn = true } = {}) {
  const { alpha, gamma, epsilon } = agent.params;
  const a = chooseAction(agent.q, ep.s, epsilon, agent.rng);
  const res = stepEnv(agent.map, ep.s, a);
  if (learn) update(agent.q, ep.s, a, res.r, res.s2, res.done, { alpha, gamma });
  ep.s = res.s2;
  ep.steps++;
  ep.ret += res.r;
  ep.done = res.done;
  ep.outcome = res.outcome;
  if (!ep.done && ep.steps >= STEP_CAP) { ep.done = true; ep.outcome = 'cap'; }
  return { ...res, a };
}

export function runEpisode(agent, opts) {
  const ep = startEpisode(agent);
  while (!ep.done) stepEpisode(agent, ep, opts);
  agent.episodes++;
  return { outcome: ep.outcome, steps: ep.steps, ret: ep.ret };
}
