// Value of each cell, heat shading and moving the treasure. Pure logic, no DOM.
import { valueIteration } from '../../assets/grid.js';

export const valuesFor = (grid, gamma) => valueIteration(grid, gamma);

// 0..1 for heat shading; a flat range gives 0.
export const shadeOf = (value, min, max) => (max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0);

// A new grid with the treasure moved to a floor cell. The original is left alone.
export function moveTreasure(grid, [x, y]) {
  const c = grid.cells[y]?.[x];
  if (c !== '.' && c !== 'T') throw new Error(`treasure needs a floor cell, got ${c ?? 'off the grid'}`);
  return { ...grid, cells: grid.cells.map((row, j) => row.map((k, i) => (i === x && j === y ? 'T' : k === 'T' ? '.' : k))) };
}
