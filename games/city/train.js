// Reward City trainer: tabular Q-learning on the sim's grid world. DOM-free.
import { createQTable, chooseAction, bestAction, update } from '../../engine/qlearn.js';
import { mulberry32 } from '../../engine/rng.js';
import { stepWorld } from './sim.js';
import { STEP_CAP } from './presets.js';

export function createAgent(world, seed) {
  return {
    world,
    q: createQTable(world.nStates, 5),
    rng: mulberry32(seed),
    visits: new Uint32Array(world.cols * world.rows),
    episodes: 0,
  };
}

// One episode from the pickup at tick 0. Hitting the step cap is a plain non-terminal transition.
export function runEpisode(agent, rewards, hyper, epsilon) {
  const { world, q, rng, visits } = agent;
  const { period, goal } = world;
  const params = { alpha: hyper.alpha, gamma: hyper.gamma };
  let cell = world.start;
  let reward = 0;
  let arrived = false;
  let steps = 0;
  const res = {};
  while (steps < STEP_CAP && !arrived) {
    const s = cell * period + (steps % period);
    visits[cell] += 1;
    const a = chooseAction(q, s, epsilon, rng);
    stepWorld(world, rewards, cell, steps, a, res);
    steps++;
    update(q, s, a, res.r, res.cell2 * period + (steps % period), res.done, params);
    reward += res.r;
    cell = res.cell2;
    arrived = res.done && cell === goal;
  }
  return { reward, arrived, steps };
}

// Epsilon falls linearly from eps0 to eps1 over decayEpisodes, counted by agent.episodes.
export function trainEpisodes(agent, rewards, n, hyper) {
  for (let i = 0; i < n; i++) {
    const t = Math.min(1, agent.episodes / hyper.decayEpisodes);
    runEpisode(agent, rewards, hyper, hyper.eps0 + (hyper.eps1 - hyper.eps0) * t);
    agent.episodes++;
  }
  return agent;
}

// One greedy walk from the pickup; stops on arrival or at STEP_CAP.
export function greedyRoute(agent, rewards) {
  const { world, q, rng } = agent;
  const cells = [world.start];
  const actions = [];
  let cell = world.start;
  for (let t = 0; t < STEP_CAP; t++) {
    const a = bestAction(q, cell * world.period + (t % world.period), rng);
    const res = stepWorld(world, rewards, cell, t, a);
    actions.push(a);
    cell = res.cell2;
    cells.push(cell);
    if (res.done) break;
  }
  return { cells, actions };
}
