import { describe, it, expect } from 'vitest';
import { motionAllowed, routeFrames, lightPhase, chaseCamera, heatColour, frameAt, TICK_MS } from '../games/city/playback.js';
import { loadWorld, lightRed, analyzeRoute, rewardsOf } from '../games/city/sim.js';
import { cellCentre } from '../games/city/geometry.js';
import { STEP_CAP } from '../games/city/presets.js';

const grid = (rows, cols) => ({
  cols, rows, cellM: 10, lightPeriod: 8,
  kind: Array.from({ length: rows }, () => 'r'.repeat(cols).split('')),
  oneway: Array.from({ length: rows }, () => Array(cols).fill('')),
  signals: [], pickup: [0, 0], dropoff: [cols - 1, rows - 1],
});
const city = grid(3, 3);
const world = loadWorld(city);
// actions: 0 N, 1 E, 2 S, 3 W, 4 wait
const route = { cells: [0, 1, 1, 4], actions: [1, 4, 2] };

describe('routeFrames', () => {
  it('has one frame per action plus the start', () => {
    const f = routeFrames(world, 10, route);
    expect(f).toHaveLength(4);
    expect(f.map((x) => x.tick)).toEqual([0, 1, 2, 3]);
  });
  it('puts frames at cell centres from geometry', () => {
    const f = routeFrames(world, 10, route);
    const [x, z] = cellCentre(1, 0, city);
    expect([f[1].x, f[1].z]).toEqual([x, z]);
  });
  it('a wait keeps position and heading', () => {
    const f = routeFrames(world, 10, route);
    expect(f[2].x).toBe(f[1].x);
    expect(f[2].z).toBe(f[1].z);
    expect(f[2].heading).toBe(f[1].heading);
  });
  it('heading points along the move', () => {
    const f = routeFrames(world, 10, { cells: [4, 5, 2], actions: [1, 0] }); // east then north
    const fwd = (h) => [Math.sin(h), Math.cos(h)];
    const e = fwd(f[1].heading), n = fwd(f[2].heading);
    expect(e[0]).toBeCloseTo(1); expect(e[1]).toBeCloseTo(0, 5);
    expect(n[0]).toBeCloseTo(0, 5); expect(n[1]).toBeCloseTo(-1); // north is -z
    expect(f[2].z).toBeLessThan(f[1].z);
  });
  it('a looping route with STEP_CAP entries yields STEP_CAP+1 frames', () => {
    const actions = Array.from({ length: STEP_CAP }, (_, i) => (i % 2 ? 3 : 1));
    const cells = [0]; actions.forEach((a) => cells.push(a === 1 ? 1 : 0));
    expect(routeFrames(world, 10, { cells, actions })).toHaveLength(STEP_CAP + 1);
  });
  it('plays at most STEP_CAP steps even when the route is longer', () => {
    const actions = Array(STEP_CAP + 50).fill(4);
    const cells = Array(STEP_CAP + 51).fill(0);
    expect(routeFrames(world, 10, { cells, actions })).toHaveLength(STEP_CAP + 1);
  });
});

describe('lightPhase', () => {
  it('flips at half the period and agrees with lightRed for both axes', () => {
    expect(lightPhase(world, 0)).toBe(0);
    expect(lightPhase(world, 3)).toBe(0);
    expect(lightPhase(world, 4)).toBe(1);
    expect(lightPhase(world, 8)).toBe(0);
    for (let t = 0; t < 20; t++) {
      expect(lightRed(world, t, 0)).toBe(lightPhase(world, t) === 1); // north-south red in phase 1
      expect(lightRed(world, t, 1)).toBe(lightPhase(world, t) === 0); // east-west red in phase 0
    }
  });
  it('shows red on screen for a red-light run found by analyzeRoute', () => {
    const c = grid(1, 3); c.signals = [[1, 0]]; c.pickup = [0, 0]; c.dropoff = [2, 0];
    const w = loadWorld(c);
    const r = { cells: [0, 1, 2], actions: [1, 1] }; // east into the signal at tick 0: east-west red
    expect(analyzeRoute(w, r, rewardsOf({})).redRuns).toBe(1);
    expect(lightPhase(w, 0)).toBe(0); // phase 0: east-west red
  });
});

describe('chaseCamera', () => {
  it('sits behind the heading, up in the air, looking at the taxi', () => {
    const frame = { x: 5, z: -20, heading: Math.PI / 2, tick: 0 }; // facing +x
    const { pos, target } = chaseCamera(frame, { back: 14, up: 7 });
    expect(pos[0]).toBeCloseTo(5 - 14);
    expect(pos[1]).toBe(7);
    expect(pos[2]).toBeCloseTo(-20);
    expect(target[0]).toBe(5); expect(target[2]).toBe(-20);
  });
  it('has defaults', () => {
    const { pos } = chaseCamera({ x: 0, z: 0, heading: 0, tick: 0 });
    expect(pos[1]).toBe(7);
  });
});

describe('motionAllowed', () => {
  it('is false when reduce matches', () => {
    expect(motionAllowed({ matches: true })).toBe(false);
  });
  it('is true when it does not match, or matchMedia is missing', () => {
    expect(motionAllowed({ matches: false })).toBe(true);
    expect(motionAllowed(undefined)).toBe(true);
    expect(motionAllowed()).toBe(true);
  });
});

describe('heatColour', () => {
  it('is monotonic in count and safe when max is 0', () => {
    let prev = [-1, -1, -1];
    for (let c = 0; c <= 10; c++) {
      const col = heatColour(c, 10);
      col.forEach((v, i) => { expect(v).toBeGreaterThanOrEqual(prev[i]); expect(v).toBeLessThanOrEqual(1); });
      prev = col;
    }
    expect(heatColour(0, 10)).toEqual([0, 0, 0]);
    for (const v of heatColour(5, 0)) expect(Number.isFinite(v)).toBe(true);
    expect(heatColour(0, 0)).toEqual([0, 0, 0]);
  });
});

describe('frameAt', () => {
  const frames = [
    { x: 0, z: 0, heading: Math.PI, tick: 0 },
    { x: 10, z: 0, heading: Math.PI / 2, tick: 1 },
    { x: 10, z: 0, heading: Math.PI / 2, tick: 2 },
  ];
  it('ticks at 400 ms', () => { expect(TICK_MS).toBe(400); });
  it('starts at the first frame and is not done', () => {
    const f = frameAt(frames, 0, 400);
    expect([f.x, f.z, f.tick, f.done]).toEqual([0, 0, 0, false]);
  });
  it('moves linearly between frames and reports the tick it is leaving', () => {
    const f = frameAt(frames, 200, 400);
    expect(f.x).toBeCloseTo(5); expect(f.tick).toBe(0);
    expect(frameAt(frames, 400, 400).tick).toBe(1);
  });
  it('turns the short way and has finished turning by the end of the segment', () => {
    expect(frameAt(frames, 399, 400).heading).toBeCloseTo(Math.PI / 2, 1);
    const wrap = [{ x: 0, z: 0, heading: 0.1, tick: 0 }, { x: 1, z: 0, heading: 2 * Math.PI - 0.1, tick: 1 }];
    const h = frameAt(wrap, 20, 400).heading; // 5 % in: still near 0.1, never swinging through pi
    expect(Math.abs(Math.sin(h))).toBeLessThan(0.5);
  });
  it('is done and clamped on the last frame once the time has passed', () => {
    const f = frameAt(frames, 99999, 400);
    expect(f.done).toBe(true); expect(f.x).toBe(10); expect(f.tick).toBe(2);
  });
  it('a single frame is done at once', () => {
    expect(frameAt([frames[0]], 0, 400).done).toBe(true);
  });
});
