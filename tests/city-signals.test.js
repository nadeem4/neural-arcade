import { describe, it, expect } from 'vitest';
import { loadWorld, lightRed } from '../games/city/sim.js';
import { signalState, signalCorners, headingAction } from '../games/city/signals.js';
import { cellCentre } from '../games/city/geometry.js';

const city = {
  cols: 3, rows: 3, cellM: 12, lightPeriod: 8,
  kind: ['rrr', 'rrr', 'rrr'], oneway: ['...', '...', '...'],
  signals: [[1, 1]], pickup: [0, 0], dropoff: [2, 2],
};
const world = loadWorld(city);
const cell = 1 * 3 + 1;
// forward = (sin h, cos h) in (x, z); north is -z.
const HEADINGS = [[0, Math.PI], [1, Math.PI / 2], [2, 0], [3, -Math.PI / 2]];

describe('headingAction', () => {
  it('maps the four headings to north, east, south, west', () => {
    for (const [action, h] of HEADINGS) expect(headingAction(h)).toBe(action);
  });
  it('tolerates a heading mid-turn by taking the nearest axis', () => {
    expect(headingAction(Math.PI - 0.2)).toBe(0);
    expect(headingAction(-Math.PI + 0.2)).toBe(0);
    expect(headingAction(Math.PI / 2 + 0.3)).toBe(1);
  });
});

describe('signalState', () => {
  it('is stop exactly when the sim would fine a move in that direction, all ticks and headings', () => {
    for (let tick = 0; tick < world.period * 2; tick++) {
      for (const [action, h] of HEADINGS) {
        expect(signalState(world, cell, h, tick)).toBe(lightRed(world, tick, action) ? 'stop' : 'go');
      }
    }
  });
  it('shows both phases', () => {
    const seen = new Set();
    for (let tick = 0; tick < world.period; tick++) seen.add(signalState(world, cell, Math.PI, tick));
    expect(seen).toEqual(new Set(['go', 'stop']));
  });
  it('is go on a cell with no signal', () => {
    for (let tick = 0; tick < world.period; tick++) expect(signalState(world, 0, Math.PI, tick)).toBe('go');
  });
});

describe('signalCorners', () => {
  it('puts the lamp on a corner of the cell, not mid-road, within one tile', () => {
    const [cx, cz] = cellCentre(1, 1, city);
    const { x, z } = signalCorners(world, cell, city.cellM);
    expect(Math.abs(x - cx)).toBeCloseTo(city.cellM / 2);
    expect(Math.abs(z - cz)).toBeCloseTo(city.cellM / 2);
    expect(Math.hypot(x - cx, z - cz)).toBeLessThanOrEqual(city.cellM);
  });
});
