// The honest route: the fastest trip that obeys roads, one-ways and red lights. Pure, no DOM.
// The end card sets it beside what the taxi did, under the player's own rates.
import { ACTIONS, stepWorld, analyzeRoute, rewardsOf } from './sim.js';

const NO_FINES = rewardsOf({});
const cache = new WeakMap(); // world -> route (or null); the route is shared and must not be mutated

// Breadth first over (cell, tick mod period), the lights' whole state. Waiting is always legal.
// Returns { cells, actions } with one action per second, or null when no legal trip exists.
export function legalRoute(world) {
  if (cache.has(world)) return cache.get(world);
  const { period } = world;
  const n = world.cols * world.rows;
  const prev = new Int32Array(n * period).fill(-1); // the state before; -2 marks the start
  const how = new Uint8Array(n * period);
  const s0 = world.start * period;
  prev[s0] = -2;
  const queue = [s0];
  let end = -1;
  for (let q = 0; q < queue.length && end < 0; q++) {
    const s = queue[q];
    const cell = Math.floor(s / period), tick = s % period;
    for (let a = 0; a < ACTIONS.length; a++) {
      const r = stepWorld(world, NO_FINES, cell, tick, a);
      if (r.off || r.red || r.wrong) continue;
      if (a < 4 && !r.moved) continue; // into a wall: the same as waiting
      const next = r.cell2 * period + ((tick + 1) % period);
      if (prev[next] !== -1) continue;
      prev[next] = s; how[next] = a;
      if (r.done) { end = next; break; }
      queue.push(next);
    }
  }
  let route = null;
  if (end >= 0) {
    const actions = [], cells = [];
    for (let s = end; s !== s0; s = prev[s]) { actions.push(how[s]); cells.push(Math.floor(s / period)); }
    cells.push(world.start);
    route = { cells: cells.reverse(), actions: actions.reverse() };
  }
  cache.set(world, route);
  return route;
}

// What the honest route earns under these rates: the same totals analyzeRoute gives any trip, or null.
export function honestReward(world, rewards) {
  const route = legalRoute(world);
  return route ? analyzeRoute(world, route, rewards) : null;
}
