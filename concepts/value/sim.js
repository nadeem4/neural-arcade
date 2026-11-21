// Value of each cell, heat shading. Pure logic, no DOM.
import { valueIteration } from '../../assets/grid.js';

export const valuesFor = (grid, gamma) => valueIteration(grid, gamma);

// 0..1 for heat shading; a flat range gives 0.
export const shadeOf = (value, min, max) => (max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0);
