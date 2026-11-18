// Reward City sim: a DOM-free grid world. Row 0 is the north edge.
import { DEFAULT_REWARDS } from './presets.js';

// 0..3 match the oneway codes N,E,S,W; 4 is wait.
export const ACTIONS = [
  { name: 'north', dr: -1, dc: 0 },
  { name: 'east', dr: 0, dc: 1 },
  { name: 'south', dr: 1, dc: 0 },
  { name: 'west', dr: 0, dc: -1 },
  { name: 'wait', dr: 0, dc: 0 },
];

const KIND = { r: 0, f: 1, p: 2, b: 3, w: 4, x: 5 };
const DIR = { N: 0, E: 1, S: 2, W: 3 };
const FOOT = 1, PARK = 2;

// The light period comes from city.lightPeriod, else the optional second argument, else 8.
export function loadWorld(city, period) {
  const { cols, rows } = city;
  const kind = new Uint8Array(cols * rows);
  const oneway = new Int8Array(cols * rows).fill(-1);
  const signal = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const k = KIND[city.kind[r][c]];
      if (k === undefined) throw new Error(`unknown kind '${city.kind[r][c]}' at col ${c}, row ${r}`);
      kind[i] = k;
      const o = city.oneway[r][c];
      if (o in DIR) oneway[i] = DIR[o];
    }
  }
  for (const [c, r] of city.signals) signal[r * cols + c] = 1;
  const p = city.lightPeriod ?? period ?? 8;
  return {
    cols, rows, kind, oneway, signal,
    start: city.pickup[1] * cols + city.pickup[0],
    goal: city.dropoff[1] * cols + city.dropoff[0],
    period: p,
    nStates: cols * rows * p,
  };
}

// Vertical moves are red in the second half of the period, horizontal in the first.
export function lightRed(world, tick, action) {
  if (action > 3) return false;
  const second = tick % world.period >= world.period / 2;
  return action % 2 === 0 ? second : !second;
}

export function rewardsOf(partial) {
  return { ...DEFAULT_REWARDS, ...partial };
}

// Pass `out` to reuse one result object across calls (the trainer does); without it a fresh one is returned.
export function stepWorld(world, rewards, cell, tick, action, out = {}) {
  const { cols, rows, kind } = world;
  const a = ACTIONS[action];
  const row = Math.floor(cell / cols) + a.dr;
  const col = (cell % cols) + a.dc;
  const inside = row >= 0 && row < rows && col >= 0 && col < cols;
  const target = inside ? row * cols + col : cell;
  const moved = action < 4 && inside && kind[target] < 3;
  const cell2 = moved ? target : cell;
  const off = moved && (kind[cell2] === FOOT || kind[cell2] === PARK);
  const red = moved && world.signal[cell2] === 1 && lightRed(world, tick, action);
  const o1 = world.oneway[cell], o2 = world.oneway[cell2];
  const wrong = moved && ((o1 >= 0 && (o1 + 2) % 4 === action) || (o2 >= 0 && (o2 + 2) % 4 === action));
  const done = moved && cell2 === world.goal;
  out.cell2 = cell2;
  out.r = -rewards.time - (off ? rewards.off : 0) - (red ? rewards.red : 0)
    - (wrong ? rewards.wrong : 0) + (moved ? rewards.perTile : 0) + (done ? rewards.fare : 0);
  out.done = done; out.moved = moved; out.off = off; out.red = red; out.wrong = wrong;
  return out;
}

export const newTotals = () => ({ arrived: false, seconds: 0, tiles: 0, offTiles: 0, parkTiles: 0, redRuns: 0, wrongWays: 0, reward: 0 });

// Adds one stepWorld result to the trip totals; analyzeRoute and tripEvents both use it.
export function tally(world, totals, s) {
  totals.seconds++;
  totals.reward += s.r;
  if (s.moved) totals.tiles++;
  if (s.off) totals.offTiles++;
  if (s.moved && world.kind[s.cell2] === PARK) totals.parkTiles++;
  if (s.red) totals.redRuns++;
  if (s.wrong) totals.wrongWays++;
  if (s.done) totals.arrived = true;
}

// Replays a route ({ cells, actions }, one action per second) and totals what happened.
export function analyzeRoute(world, route, rewards) {
  const out = newTotals();
  let cell = route.cells[0];
  for (let t = 0; t < route.actions.length; t++) {
    const s = stepWorld(world, rewards, cell, t, route.actions[t]);
    cell = s.cell2;
    tally(world, out, s);
    if (s.done) break;
  }
  return out;
}
