// Treasure Room logic: one 5x5 room, a step with an optional slip, value iteration, policy and return maths.
// assets/grid.js has its own -0.1 step and no slip, so the move, value and policy code lives here.
import { ACTIONS, makeGrid, stateId } from '../../assets/grid.js';

export const REWARD = { treasure: 10, pit: -10, step: -1, coin: 2 };
export const SLIP = 0.1; // each side; icy floor = 2 * SLIP in all

// S start, T treasure, X pit, # wall, . floor (x right, y down)
export const ROOM = makeGrid([
  '.....',
  'S....',
  '..X.#',
  '.#..T',
  '.....',
]);
// Level 3's room: the same layout with a coin (C) on the left edge, two steps below the start.
export const COIN_ROOM = makeGrid([
  '.....',
  'S....',
  '..X.#',
  'C#..T',
  '.....',
]);
export const roomForLevel = n => (n === 3 ? COIN_ROOM : ROOM);
export const START = (() => {
  for (let y = 0; y < ROOM.h; y++) for (let x = 0; x < ROOM.w; x++) if (ROOM.cells[y][x] === 'S') return { x, y };
})();

const UP = 0, DOWN = 1, LEFT = 2, RIGHT = 3;
const SIDES = [[LEFT, RIGHT], [LEFT, RIGHT], [UP, DOWN], [UP, DOWN]];
// Tiles that end the episode: what the walk reports and what stepping on them pays.
export const ENDS = { T: { outcome: 'treasure', reward: REWARD.treasure }, C: { outcome: 'coin', reward: REWARD.coin }, X: { outcome: 'pit', reward: REWARD.pit } };
export const isFloor = (room, x, y) => room.cells[y][x] !== '#' && !ENDS[room.cells[y][x]];

function move(room, pos, a) {
  const { dx, dy } = ACTIONS[a];
  const x = pos.x + dx, y = pos.y + dy;
  if (x < 0 || y < 0 || x >= room.w || y >= room.h || room.cells[y][x] === '#') {
    return { pos: { x: pos.x, y: pos.y }, reward: REWARD.step, done: false };
  }
  const end = ENDS[room.cells[y][x]];
  return { pos: { x, y }, reward: end ? end.reward : REWARD.step, done: !!end };
}

export function transitions(room, pos, action, slip = 0) {
  const outs = slip > 0
    ? [[action, 1 - 2 * slip], [SIDES[action][0], slip], [SIDES[action][1], slip]]
    : [[action, 1]];
  return outs.map(([actual, p]) => ({ p, actual, ...move(room, pos, actual) }));
}

export function step(room, pos, action, { slip = 0, rng } = {}) {
  const t = transitions(room, pos, action, slip);
  let pick = t[0];
  if (slip > 0) {
    const u = rng();
    pick = u < t[0].p ? t[0] : u < t[0].p + t[1].p ? t[1] : t[2];
  }
  const { pos: np, reward, done, actual } = pick;
  return { pos: np, reward, done, intended: action, actual, slipped: actual !== action };
}

export function adjacentToPit(room, pos) {
  return ACTIONS.some(({ dx, dy }) => room.cells[pos.y + dy]?.[pos.x + dx] === 'X');
}

export function qValue(room, values, pos, action, gamma, slip = 0) {
  let q = 0;
  for (const t of transitions(room, pos, action, slip)) {
    q += t.p * (t.reward + (t.done ? 0 : gamma * values[stateId(room, t.pos)]));
  }
  return q;
}

// One Bellman sweep: every floor tile takes the best action's value from the tiles next to it. The input is not changed.
export function sweepOnce(room, values, { gamma, slip = 0 }) {
  const next = values.slice();
  for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) {
    if (!isFloor(room, x, y)) continue;
    let best = -Infinity;
    for (let a = 0; a < 4; a++) best = Math.max(best, qValue(room, values, { x, y }, a, gamma, slip));
    next[stateId(room, { x, y })] = best;
  }
  return next;
}

export function valueIteration(room, { gamma, slip = 0, sweeps = 200 }) {
  let v = new Array(room.w * room.h).fill(0);
  for (let i = 0; i < sweeps; i++) v = sweepOnce(room, v, { gamma, slip });
  return v;
}

export function greedyPolicy(room, values, { gamma, slip = 0 }) {
  const policy = new Array(room.w * room.h).fill(-1);
  for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) {
    if (!isFloor(room, x, y)) continue;
    let best = -Infinity, pick = 0;
    for (let a = 0; a < 4; a++) {
      const q = qValue(room, values, { x, y }, a, gamma, slip);
      if (q > best + 1e-9) { best = q; pick = a; }
    }
    policy[stateId(room, { x, y })] = pick;
  }
  return policy;
}

function walk(room, from, nextAction, { slip, rng, maxSteps }) {
  const trace = [];
  let pos = from, total = 0, outcome = 'timeout';
  for (let i = 0; i < maxSteps; i++) {
    const action = nextAction(pos, i);
    if (action === undefined || action < 0) break;
    const r = step(room, pos, action, { slip, rng });
    trace.push({ pos: r.pos, action, actual: r.actual, reward: r.reward, slipped: r.slipped, done: r.done });
    total += r.reward;
    pos = r.pos;
    if (r.done) { outcome = ENDS[room.cells[pos.y][pos.x]].outcome; break; }
  }
  return { trace, total, outcome };
}

export function runPolicy(room, policy, { slip = 0, rng, maxSteps = 30, from = START } = {}) {
  return walk(room, from, pos => policy[stateId(room, pos)], { slip, rng, maxSteps });
}

export function pathActions(room, from, actions) {
  return walk(room, from, (_, i) => actions[i], { slip: 0, maxSteps: actions.length });
}

export const discounted = (rewards, gamma) => rewards.map((r, t) => r * gamma ** t);
export const returnOf = (rewards, gamma) => discounted(rewards, gamma).reduce((s, x) => s + x, 0);
export const treasureWorth = (steps, gamma) => REWARD.treasure * gamma ** steps;

export function bestPathCells(room, policy, from = START) {
  const cells = [{ x: from.x, y: from.y }];
  for (const t of runPolicy(room, policy, { from }).trace) cells.push({ x: t.pos.x, y: t.pos.y });
  return cells;
}
