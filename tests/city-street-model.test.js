import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  roadWidth, roadLanes, buildAsphalt, uncoveredRoadCells, buildRoadMarks, arrowPolys, buildCrosswalks, buildRaisedWalks,
  Y_ROAD, Y_MARK, Y_WALK, WALK_RISE,
} from '../games/city/street-model.js';

const vertsOf = (g) => { const out = []; for (let i = 0; i < g.positions.length; i += 3) out.push([g.positions[i], g.positions[i + 1], g.positions[i + 2]]); return out; };
const ok = (g) => { for (const i of g.indices) expect(i).toBeLessThan(g.positions.length / 3); for (const v of g.positions) expect(Number.isFinite(v)).toBe(true); };

describe('road widths and lanes', () => {
  it('uses the mapped width, then lanes at 3.5 m, then a class default', () => {
    expect(roadWidth({ w: 12, lanes: 2, cls: 'secondary' })).toBe(12);
    expect(roadWidth({ w: 0, lanes: 4, cls: 'secondary' })).toBe(14);
    expect(roadWidth({ cls: 'residential' })).toBeGreaterThan(5);
    expect(roadWidth({ cls: 'secondary' })).toBeGreaterThan(roadWidth({ cls: 'service' }));
    expect(roadWidth({})).toBeGreaterThan(0);
  });
  it('counts lanes from the tag, else from the width', () => {
    expect(roadLanes({ w: 10.5, lanes: 3 })).toBe(3);
    expect(roadLanes({ w: 14, lanes: null })).toBe(4);
    expect(roadLanes({ w: 3.5 })).toBe(1);
  });
});

describe('asphalt', () => {
  const city = { cols: 3, rows: 3, cellM: 12, kind: ['bbb', 'rrr', 'bbb'], roads: [{ pts: [[0, 12], [18, 12]], w: 8 }] };
  it('is a ribbon per road at the road height, plus a patch for every road cell the ribbons miss', () => {
    // cell centres on row 1 are y = 18 (rows - 1 - 1 + 0.5 = 1.5 cells up from the south edge); the road is at y = 12
    const cells = uncoveredRoadCells(city);
    expect(cells.length).toBe(3);
    const g = buildAsphalt(city);
    ok(g);
    for (const [, y] of vertsOf(g)) expect(y).toBeCloseTo(Y_ROAD, 5);
    const onRoadCity = { ...city, roads: [{ pts: [[0, 18], [36, 18]], w: 8 }] };
    expect(uncoveredRoadCells(onRoadCity)).toEqual([]);
  });
  it('never patches a cell that is not road', () => {
    const cells = uncoveredRoadCells(city);
    for (const [c, r] of cells) expect(city.kind[r][c]).toBe('r');
  });
});

describe('road marks', () => {
  const two = { pts: [[0, 0], [100, 0]], w: 8, lanes: 2, oneway: 0 };
  const xs = (g) => vertsOf(g).map((v) => v[0]);
  it('a two-way street gets a double yellow centre line and no dashes when it has two lanes', () => {
    const m = buildRoadMarks([two]);
    expect(m.yellow.indices.length).toBeGreaterThan(0);
    expect(m.white.indices.length).toBe(0);
    for (const [, y] of vertsOf(m.yellow)) expect(y).toBeCloseTo(Y_MARK, 5);
    const zs = vertsOf(m.yellow).map((v) => v[2]);
    expect(Math.min(...zs)).toBeLessThan(0); expect(Math.max(...zs)).toBeGreaterThan(0); // one line each side of the centre
  });
  it('a four-lane two-way street also gets a dashed line between the lanes of each direction', () => {
    const m = buildRoadMarks([{ ...two, w: 14, lanes: 4 }]);
    expect(m.white.indices.length).toBeGreaterThan(0);
    expect(m.yellow.indices.length).toBeGreaterThan(0);
  });
  it('a one-way street has no yellow, dashes between its lanes, and nothing when it has one lane', () => {
    expect(buildRoadMarks([{ ...two, oneway: 1, lanes: 3, w: 10.5 }], { arrows: false }).yellow.indices.length).toBe(0);
    expect(buildRoadMarks([{ ...two, oneway: 1, lanes: 3, w: 10.5 }], { arrows: false }).white.indices.length).toBeGreaterThan(0);
    expect(buildRoadMarks([{ ...two, oneway: 1, lanes: 1, w: 4 }], { arrows: false }).white.indices.length).toBe(0);
  });
  it('narrow lanes and alleys (under 5 m) get no marks at all', () => {
    const m = buildRoadMarks([{ ...two, w: 4 }, { ...two, w: 3.5, oneway: 1, lanes: 1 }]);
    expect(m.white.indices.length + m.yellow.indices.length).toBe(0);
  });
  it('lane marks skip junctions', () => {
    const cross = { pts: [[50, -50], [50, 50]], w: 8, lanes: 2, oneway: 0, name: 'Cross' };
    const m = buildRoadMarks([{ ...two, name: 'Main' }, cross]);
    const ys = vertsOf(m.yellow);
    const insideJunction = ys.filter(([x, , z]) => Math.abs(x - 50) < 4 && Math.abs(z) < 4);
    expect(insideJunction).toEqual([]);
    expect(xs(m.yellow).some((x) => x < 45)).toBe(true); // but the road either side is still marked
    expect(xs(m.yellow).some((x) => x > 55)).toBe(true);
  });
  it('a street split into two ways of one name stays marked where the ways meet', () => {
    const a = { ...two, pts: [[0, 0], [50, 0]], name: 'Main' }, b = { ...two, pts: [[50, 0], [100, 0]], name: 'Main' };
    const m = buildRoadMarks([a, b]);
    expect(xs(m.yellow).some((x) => Math.abs(x - 50) < 2)).toBe(true);
  });
  it('arrows point the way a one-way street runs (and reverse for -1), and two-way streets have none', () => {
    const fwd = arrowPolys(0, 0, 1, 0), back = arrowPolys(0, 0, -1, 0);
    const tip = (polys) => polys.flat().reduce((m, p) => (Math.abs(p[0]) > Math.abs(m[0]) ? p : m), [0, 0]);
    expect(tip(fwd)[0]).toBeGreaterThan(0);
    expect(tip(back)[0]).toBeLessThan(0);
    const one = { ...two, oneway: 1, lanes: 1, w: 6 };
    const withArrows = buildRoadMarks([one]).white.indices.length;
    expect(withArrows).toBeGreaterThan(0);
    expect(buildRoadMarks([one], { arrows: false }).white.indices.length).toBe(0);
    expect(buildRoadMarks([{ ...one, oneway: 0 }]).white.indices.length).toBe(0);
    expect(buildRoadMarks([{ ...one, oneway: -1 }]).white.indices.length).toBe(withArrows);
  });
  it('geometry is finite and indexed', () => {
    const m = buildRoadMarks([{ ...two, oneway: 1, lanes: 3, w: 10.5 }]);
    ok(m.white); ok(m.yellow);
  });
});

describe('crosswalks', () => {
  it('draws zebra bars along the traffic, side by side across the road, only where mapped', () => {
    expect(buildCrosswalks([]).indices.length).toBe(0);
    const g = buildCrosswalks([{ x: 100, y: 50, angle: 90, w: 12 }]); // walking east across a road that runs north to south
    ok(g);
    const v = vertsOf(g);
    const xs = v.map((p) => p[0]), zs = v.map((p) => p[2]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(10); // spans the road width
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(12);
    expect(Math.max(...zs) - Math.min(...zs)).toBeLessThan(4); // each bar is a few metres along the road
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(100, 0);
    expect(Math.abs((Math.min(...zs) + Math.max(...zs)) / 2 + 50)).toBeLessThan(0.5);
    for (const p of v) expect(p[1]).toBeGreaterThan(Y_ROAD);
  });
});

describe('raised sidewalks', () => {
  const walk = { pts: [[0, 10], [40, 10]], w: 2.4 };
  const g = buildRaisedWalks([walk]);
  it('lifts a flat top above the road by the kerb height and drops walls down to the road', () => {
    ok(g);
    const ys = vertsOf(g).map((p) => p[1]);
    expect(Math.max(...ys)).toBeCloseTo(Y_WALK, 6);
    expect(Math.min(...ys)).toBeCloseTo(Y_ROAD, 6);
    expect(Y_WALK - Y_ROAD).toBeCloseTo(WALK_RISE, 6);
    expect(g.normals.length).toBe(g.positions.length);
  });
  it('the kerb faces point away from the walkway and every triangle agrees with its normal', () => {
    const v = vertsOf(g);
    let walls = 0;
    for (let i = 0; i < v.length; i++) {
      const n = [g.normals[i * 3], g.normals[i * 3 + 1], g.normals[i * 3 + 2]];
      if (Math.abs(n[1]) < 0.5) { walls++; expect(n[2] * (v[i][2] + 10)).toBeGreaterThan(0); } // z = -y; the walkway's centre line is z = -10
    }
    expect(walls).toBeGreaterThan(0);
    const I = g.indices;
    for (let t = 0; t < I.length; t += 3) {
      const [a, b, c] = [v[I[t]], v[I[t + 1]], v[I[t + 2]]];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const cr = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      const n = [g.normals[I[t] * 3], g.normals[I[t] * 3 + 1], g.normals[I[t] * 3 + 2]];
      expect(cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('the real map', () => {
  const city = JSON.parse(readFileSync(new URL('../games/city/chicago.json', import.meta.url)));
  it('every road cell the sim can drive is asphalt: either under a drawn road or patched', () => {
    const patched = new Set(uncoveredRoadCells(city).map(([c, r]) => r * city.cols + c));
    let roadCells = 0;
    for (let r = 0; r < city.rows; r++) for (let c = 0; c < city.cols; c++) if (city.kind[r][c] === 'r') roadCells++;
    for (const i of patched) expect(city.kind[Math.floor(i / city.cols)][i % city.cols]).toBe('r');
    expect(patched.size).toBeLessThan(roadCells); // most cells are already under a road ribbon
    expect(patched.size).toBeGreaterThan(0);
  });
  it('marks, crossings and walks build finite geometry within a triangle budget', { timeout: 20000 }, () => {
    const m = buildRoadMarks(city.roads), x = buildCrosswalks(city.crossings), w = buildRaisedWalks(city.sidewalks), a = buildAsphalt(city);
    for (const g of [m.white, m.yellow, x, w, a]) ok(g);
    const tris = [m.white, m.yellow, x, w, a].reduce((s, g) => s + g.indices.length / 3, 0);
    console.log(`street surfaces: ${tris} triangles`);
    expect(tris).toBeLessThan(160000);
    expect(m.yellow.indices.length).toBeGreaterThan(0);
    expect(m.white.indices.length).toBeGreaterThan(0);
  });
});
