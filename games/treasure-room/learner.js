// Lesson 1's learner: tabular Q-learning on ROOM, trained in one call. The page never shows the table.
import { ROOM, START, ENDS, step } from './sim.js';
import { ACTIONS, stateId } from '../../assets/grid.js';
import { createQTable, chooseAction, update } from '../../engine/qlearn.js';
import { mulberry32 } from '../../engine/rng.js';

export const TRIES = 200;
const SEED = 1, ALPHA = 0.5, GAMMA = 0.9, EPSILON = 0.2;
const MAX_STEPS = 60; // shortcut: a try that wanders this long is cut off, upgrade if the room gets a loop with no end

function run(q, epsilon, rng, learning) {
  let pos = { ...START }, score = 0;
  const path = [pos], rewards = [];
  for (let n = 0; n < MAX_STEPS; n++) {
    const s = stateId(ROOM, pos), a = chooseAction(q, s, epsilon, rng);
    const r = step(ROOM, pos, a);
    if (learning) update(q, s, a, r.reward, stateId(ROOM, r.pos), r.done, { alpha: ALPHA, gamma: GAMMA });
    pos = r.pos; score += r.reward; path.push(pos); rewards.push(r.reward);
    if (r.done) break;
  }
  return { path, rewards, score, outcome: ENDS[ROOM.cells[pos.y][pos.x]]?.outcome ?? null };
}

export function learn() {
  const rng = mulberry32(SEED), q = createQTable(ROOM.w * ROOM.h, ACTIONS.length);
  const tries = Array.from({ length: TRIES }, () => run(q, EPSILON, rng, true));
  return { scores: tries.map(t => t.score), first: tries[0], last: run(q, 0, rng, false) };
}
