// A toy courier: the same car, paid by a pay slip, finds the cheapest way. Pure logic, no DOM.
import { createQTable, chooseAction, bestAction, update } from '../../engine/qlearn.js';
import { mulberry32 } from '../../engine/rng.js';

// . road, # wall, g lawn (drivable, fined), S start, T target. Legal route 10 steps, lawn route 6.
export const MAP = ['.......', '.#####.', 'SgggggT'];
export const DEFAULTS = { time: 1, lawn: 0, perTile: 0, fare: 20 };

const W = MAP[0].length, H = MAP.length;
const MOVES = [[0, -1], [0, 1], [-1, 0], [1, 0]]; // up, down, left, right
const START = { x: 0, y: 2 };
const CAP = 40;
const GAMMA = 0.99;
const idOf = s => s.y * W + s.x;
const tile = (x, y) => MAP[y]?.[x];

export function stepToy(state, action, pay) {
  const [dx, dy] = MOVES[action];
  const t = tile(state.x + dx, state.y + dy);
  const moved = t !== undefined && t !== '#';
  const s2 = moved ? { x: state.x + dx, y: state.y + dy } : { x: state.x, y: state.y };
  const onLawn = moved && t === 'g';
  const done = moved && t === 'T';
  const r = -pay.time - (onLawn ? pay.lawn : 0) + (moved ? pay.perTile : 0) + (done ? pay.fare : 0);
  return { s2, r, done, onLawn, moved };
}

// Fewest steps from start to target, with or without the lawn (breadth-first).
export function shortestSteps(allowLawn) {
  const seen = new Set([idOf(START)]);
  let frontier = [START];
  for (let n = 1; frontier.length; n++) {
    const next = [];
    for (const s of frontier) for (let a = 0; a < 4; a++) {
      const [dx, dy] = MOVES[a];
      const x = s.x + dx, y = s.y + dy, t = tile(x, y);
      if (t === undefined || t === '#' || (t === 'g' && !allowLawn) || seen.has(y * W + x)) continue;
      if (t === 'T') return n;
      seen.add(y * W + x);
      next.push({ x, y });
    }
    frontier = next;
  }
  return Infinity;
}

// Train a fresh courier on this pay, then drive its greedy route (stopping at the target or the step cap).
export function trainToy(pay, { seed = 1, episodes = 400 } = {}) {
  const rng = mulberry32(seed);
  const q = createQTable(W * H, 4);
  for (let ep = 0; ep < episodes; ep++) {
    const eps = Math.max(0.05, 0.5 * (1 - ep / episodes));
    let s = START;
    for (let n = 0; n < CAP; n++) {
      const a = chooseAction(q, idOf(s), eps, rng);
      const { s2, r, done } = stepToy(s, a, pay);
      update(q, idOf(s), a, r, idOf(s2), done, { alpha: 0.5, gamma: GAMMA });
      s = s2;
      if (done) break;
    }
  }
  const route = [START];
  let s = START, arrived = false, lawnTiles = 0, tiles = 0, reward = 0;
  for (let n = 0; n < CAP && !arrived; n++) {
    const a = bestAction(q, idOf(s), rng);
    const res = stepToy(s, a, pay);
    reward += res.r;
    if (res.moved) tiles++;
    if (res.onLawn) lawnTiles++;
    arrived = res.done;
    s = res.s2;
    route.push(s);
  }
  return { route, arrived, steps: route.length - 1, lawnTiles, tiles, reward };
}
