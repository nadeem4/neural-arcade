// A policy is one action index per grid cell. Pure logic, no DOM.
import { move, stateId } from '../../assets/grid.js';

export const createPolicy = (grid, fill = 0) => new Array(grid.w * grid.h).fill(fill);

export const setAction = (policy, cellIndex, action) => policy.map((a, i) => (i === cellIndex ? action : a));

function start(grid) {
  for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) if (grid.cells[y][x] === 'S') return { x, y };
}

// Follow the rulebook from the start. Stepping onto a cell already visited (or bumping a wall) is a loop.
export function runPolicy(grid, policy, maxSteps = 30) {
  let pos = start(grid), total = 0;
  const path = [[pos.x, pos.y]], seen = new Set([stateId(grid, pos)]);
  for (let i = 0; i < maxSteps; i++) {
    const r = move(grid, pos, policy[stateId(grid, pos)]);
    pos = r.pos;
    total += r.reward;
    path.push([pos.x, pos.y]);
    if (r.done) return { path, total, outcome: r.reward > 0 ? 'treasure' : 'pit' };
    const id = stateId(grid, pos);
    if (seen.has(id)) return { path, total, outcome: 'loop' };
    seen.add(id);
  }
  return { path, total, outcome: 'timeout' };
}
