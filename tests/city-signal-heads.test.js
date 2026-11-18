import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld } from '../games/city/sim.js';
import { signalState, headingAction, headAxis, headState } from '../games/city/signals.js';
import { headPlacement, buildSignalHeads, paintLamps } from '../games/city/signal-heads.js';

const city = {
  cols: 3, rows: 3, cellM: 12, lightPeriod: 8,
  kind: ['rrr', 'rrr', 'rrr'], oneway: ['...', '...', '...'],
  signals: [[1, 1]], pickup: [0, 0], dropoff: [2, 2],
};
const world = loadWorld(city);
const cell = 4;
const heading = (bearingDeg) => Math.PI - (bearingDeg * Math.PI) / 180; // forward = (sin h, cos h), north is -z

describe('a head shows what the sim does', () => {
  it('shows red exactly when the sim would fine a car travelling either way along its road, at every tick', () => {
    for (let dir = 0; dir < 180; dir += 7) {
      for (let tick = 0; tick < world.period * 2; tick++) {
        const state = headState(world, tick, dir);
        for (const back of [0, Math.PI]) expect(state).toBe(signalState(world, cell, heading(dir) + back, tick));
      }
    }
  });
  it('a road running north to south and one running east to west are on opposite phases', () => {
    expect(headAxis(0)).toBe(0); expect(headAxis(90)).toBe(1);
    expect(headAxis(178)).toBe(0); expect(headAxis(100)).toBe(1);
    for (let tick = 0; tick < world.period; tick++) expect(headState(world, tick, 0)).not.toBe(headState(world, tick, 90));
    expect(headingAction(heading(0))).toBe(0);
  });
});

describe('placement', () => {
  const roads = [{ pts: [[0, 0], [100, 0]], w: 10 }];
  it('the arm reaches from the pole toward the road and the head faces along the road', () => {
    const p = headPlacement({ x: 50, y: 8, dir: 90 }, roads);
    expect(p.ay).toBeLessThan(0); expect(Math.abs(p.ax)).toBeLessThan(1e-6); // from y = 8 down toward the road at y = 0
    expect(p.armLen).toBeGreaterThan(0);
    expect(p.armLen).toBeLessThanOrEqual(8);
    expect(Math.abs(p.ux)).toBeCloseTo(1, 5); // faces east and west
  });
  it('a head mapped on the carriageway gets its pole beside the road and an arm reaching back over it', () => {
    for (const y of [0, 1.2, -2]) {
      const p = headPlacement({ x: 50, y, dir: 90 }, roads);
      expect(Math.abs(p.y)).toBeGreaterThanOrEqual(5 + 0.6 - 1e-6); // beyond the kerb: road is 10 m wide
      expect(p.armLen).toBeGreaterThan(0);
      expect(Math.sign(p.ay)).toBe(-Math.sign(p.y)); // the arm points back toward the centre line
      expect(p.y + p.ay * p.armLen).toBeLessThan(5); // and the housing hangs over the carriageway
      expect(Math.abs(p.y + p.ay * p.armLen)).toBeLessThan(5);
    }
  });
});

describe('the built heads', () => {
  const roads = [{ pts: [[0, 0], [100, 0]], w: 10 }];
  const heads = [{ x: 20, y: 7, dir: 90 }, { x: 60, y: 7, dir: 0 }];
  const g = buildSignalHeads(heads, roads);
  it('builds a body and lamps with finite, indexed geometry', () => {
    for (const part of [g.body, g.lamps]) {
      expect(part.indices.length).toBeGreaterThan(0);
      for (const i of part.indices) expect(i).toBeLessThan(part.positions.length / 3);
      for (const v of part.positions) expect(Number.isFinite(v)).toBe(true);
    }
    expect(g.body.normals.length).toBe(g.body.positions.length);
    expect(g.lamps.colors.length).toBe(g.lamps.positions.length);
  });
  it('has a red, an amber and a green lamp on both faces of every head', () => {
    for (const role of ['red', 'amber', 'green']) expect(g.lamps.list.filter((l) => l.role === role)).toHaveLength(heads.length * 2);
  });
  it('lights the red lamps of a stopped axis and the green lamps of a going one, and dims the rest', () => {
    const colour = (axis, role) => { const l = g.lamps.list.find((x) => x.axis === axis && x.role === role); return [...g.lamps.colors.slice(l.first * 3, l.first * 3 + 3)]; };
    const sum = (c) => c[0] + c[1] + c[2];
    paintLamps(g.lamps, { 0: 'stop', 1: 'go' });
    expect(sum(colour(0, 'red'))).toBeGreaterThan(sum(colour(0, 'green')));
    expect(sum(colour(1, 'green'))).toBeGreaterThan(sum(colour(1, 'red')));
    const redOn = colour(0, 'red');
    paintLamps(g.lamps, { 0: 'go', 1: 'stop' });
    expect(sum(colour(0, 'red'))).toBeLessThan(sum(redOn));
    expect(sum(colour(1, 'red'))).toBeGreaterThan(sum(colour(1, 'green')));
  });
});

describe('the real map', () => {
  const real = JSON.parse(readFileSync(new URL('../games/city/chicago.json', import.meta.url)));
  it('every mapped head builds with its six lamps', () => {
    expect(real.signalHeads.length).toBeGreaterThan(0);
    const g = buildSignalHeads(real.signalHeads, real.roads);
    expect(g.lamps.list).toHaveLength(real.signalHeads.length * 6);
    for (const v of g.body.positions) expect(Number.isFinite(v)).toBe(true);
  });
});
