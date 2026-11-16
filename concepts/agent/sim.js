// One agent in the shared grid world. Pure logic, no DOM.
import { GRID, move, valueIteration, greedyPolicy, stateId } from '../../assets/grid.js';

const GAMMA = 0.9;
const POLICY = greedyPolicy(GRID, valueIteration(GRID, GAMMA), GAMMA);

function start() {
  for (let y = 0; y < GRID.h; y++) for (let x = 0; x < GRID.w; x++) if (GRID.cells[y][x] === 'S') return { x, y };
}

export function createWorld() {
  return { pos: start(), last: null, steps: 0, total: 0, done: false };
}

// After treasure or pit the episode is over (done). The next act starts a fresh one instead of moving.
export function act(world, actionIndex) {
  if (world.done) { Object.assign(world, createWorld()); return world; }
  const r = move(GRID, world.pos, actionIndex);
  world.pos = r.pos;
  world.last = { action: actionIndex, reward: r.reward };
  world.steps++;
  world.total += r.reward;
  world.done = r.done;
  return world;
}

// Mostly follows the best-known route, sometimes tries something random.
export function autoAct(world, rng) {
  const a = rng() < 0.8 ? POLICY[stateId(GRID, world.pos)] : Math.floor(rng() * 4);
  return act(world, a < 0 ? Math.floor(rng() * 4) : a);
}
