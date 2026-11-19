import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  roadWidth, roadLanes, buildAsphalt, junctionFills, uncoveredRoadCells, buildRoadMarks, arrowPolys, buildCrosswalks, buildRaisedWalks,
  roadPatches, clipWalks, buildStopLines,
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

describe('junction fills', () => {
  const A = { name: 'A', pts: [[-50, 0], [50, 0]], w: 14 }, B = { name: 'B', pts: [[0, -50], [0, 50]], w: 10 };
  it('puts one disc of asphalt where two differently named roads cross, as wide as the wider road and a little more', () => {
    const f = junctionFills([A, B]);
    expect(f).toHaveLength(1);
    expect(Math.hypot(f[0].x, f[0].y)).toBeLessThan(1e-6);
    expect(f[0].r).toBeGreaterThanOrEqual(7);
    expect(f[0].r).toBeLessThanOrEqual(10);
  });
  it('counts a T junction, where a side road ends on the main road, once', () => {
    expect(junctionFills([A, { name: 'C', pts: [[20, 0.4], [20, 60]], w: 7 }])).toHaveLength(1);
  });
  it('makes none for roads that do not meet, or two ways of one street', () => {
    expect(junctionFills([A, { name: 'D', pts: [[0, 30], [50, 30]], w: 7 }])).toHaveLength(0);
    expect(junctionFills([A, { name: 'A', pts: [[0, -50], [0, 50]], w: 10 }])).toHaveLength(0);
  });
  it('the asphalt gains the discs, flat at road height', () => {
    const city = { cols: 1, rows: 1, cellM: 12, kind: ['b'], roads: [A, B] };
    const plain = buildAsphalt({ ...city, roads: [A, { ...B, name: 'A' }] });
    const g = buildAsphalt(city);
    ok(g);
    expect(g.positions.length).toBeGreaterThan(plain.positions.length);
    for (const [, y] of vertsOf(g)) expect(y).toBeCloseTo(Y_ROAD, 5);
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

describe('asphalt patches', () => {
  const city = { cols: 3, rows: 3, cellM: 12, kind: ['bbb', 'rrr', 'bbb'], roads: [{ pts: [[0, 12], [36, 12]], w: 8 }] };
  it('each uncovered cell gets a one-lane strip from the nearest point on a road to just past the cell centre, not a square', () => {
    const patches = roadPatches(city);
    expect(patches).toHaveLength(uncoveredRoadCells(city).length);
    for (const { pts, w } of patches) {
      expect(w).toBe(7);
      expect(Math.abs(pts[0][1] - 12)).toBeLessThan(1e-6); // starts on the road's centre line
      const cells = uncoveredRoadCells(city).map(([c, r]) => [(c + 0.5) * 12, (city.rows - 1 - r + 0.5) * 12]);
      expect(cells.some(([cx, cy]) => Math.hypot(pts[1][0] - cx, pts[1][1] - cy) <= 2.01 && Math.hypot(pts[1][0] - cx, pts[1][1] - cy) >= 1.99)).toBe(true);
    }
  });
  it('the asphalt stays at road height and is finite', () => { const g = buildAsphalt(city); ok(g); for (const [, y] of vertsOf(g)) expect(y).toBeCloseTo(Y_ROAD, 5); });
});

describe('clipping sidewalks', () => {
  const city = { cols: 3, rows: 3, cellM: 12, kind: ['bbb', 'rbb', 'bbb'], roads: [{ pts: [[0, 12], [40, 12]], w: 8 }], sidewalks: [] };
  it('drops the part of a walk that runs inside a road and keeps the rest', () => {
    const out = clipWalks([{ pts: [[20, -10], [20, 40]], w: 2.4 }], city);
    expect(out.length).toBeGreaterThan(1); // split by the road
    for (const { pts } of out) for (const [x, y] of pts) expect(Math.abs(y - 12)).toBeGreaterThanOrEqual(4 - 1e-6);
  });
  it('leaves a clear walk whole', () => {
    const out = clipWalks([{ pts: [[0, 30], [40, 30]], w: 2.4 }], city);
    expect(out).toHaveLength(1);
    expect(out[0].pts[0]).toEqual([0, 30]); expect(out[0].pts[out[0].pts.length - 1]).toEqual([40, 30]);
  });
  it('keeps clear of a road cell centre', () => {
    const c = { ...city, kind: ['bbb', 'bbb', 'brb'] }; // the road cell centre is (18, 6)
    const out = clipWalks([{ pts: [[0, 6.5], [40, 6.5]], w: 2.4 }], c);
    for (const { pts } of out) for (let i = 0; i < pts.length - 1; i++) {
      const [a, b] = [pts[i], pts[i + 1]], dx = b[0] - a[0], t = Math.max(0, Math.min(1, (18 - a[0]) / dx));
      expect(Math.hypot(a[0] + dx * t - 18, 6.5 - 6)).toBeGreaterThan(1.2);
    }
  });
});

describe('stop lines', () => {
  const two = { pts: [[0, 0], [100, 0]], w: 8, oneway: 0 };
  const head = { x: 50, y: 0, dir: 90 };
  const quads = (g) => { const v = vertsOf(g), out = []; for (let i = 0; i + 3 < v.length; i += 4) out.push(v.slice(i, i + 4).map(([x, , z]) => [x, -z])); return out; };
  const box = (q) => ({ x0: Math.min(...q.map((p) => p[0])), x1: Math.max(...q.map((p) => p[0])), y0: Math.min(...q.map((p) => p[1])), y1: Math.max(...q.map((p) => p[1])) });
  it('on a two-way road draws the approach half on each side, in the right-hand lane, a few metres before the signal', () => {
    const g = buildStopLines([head], [two]);
    ok(g);
    const bs = quads(g).map(box);
    expect(bs).toHaveLength(2);
    const east = bs.find((b) => b.x1 < 50), west = bs.find((b) => b.x0 > 50); // cars going east approach from the west
    expect(east.y1).toBeLessThanOrEqual(0); expect(east.y0).toBeGreaterThanOrEqual(-4);
    expect(west.y0).toBeGreaterThanOrEqual(0); expect(west.y1).toBeLessThanOrEqual(4);
    for (const b of [east, west]) { const d = Math.abs((b.x0 + b.x1) / 2 - 50); expect(d).toBeGreaterThan(3); expect(d).toBeLessThan(14); }
  });
  it('on a one-way road draws one full-width line on the approach side only', () => {
    const bs = quads(buildStopLines([head], [{ ...two, oneway: 1 }])).map(box);
    expect(bs).toHaveLength(1);
    expect(bs[0].x1).toBeLessThan(50);
    expect(bs[0].y0).toBeLessThanOrEqual(-3.5); expect(bs[0].y1).toBeGreaterThanOrEqual(3.5);
    expect(quads(buildStopLines([head], [{ ...two, oneway: -1 }])).map(box)[0].x0).toBeGreaterThan(50);
  });
  it('skips a signal with no road near it, and a side where the road is too short to approach from', () => {
    expect(buildStopLines([{ x: 50, y: 60, dir: 90 }], [two]).indices.length).toBe(0);
    const ends = quads(buildStopLines([{ x: 100, y: 0, dir: 90 }], [two])).map(box); // the road ends at the signal: one approach
    expect(ends).toHaveLength(1);
    expect(ends[0].x1).toBeLessThan(100);
  });
  it('sits at road height, above the asphalt', () => { for (const [, y] of vertsOf(buildStopLines([head], [two]))) expect(y).toBeCloseTo(Y_MARK, 5); });
});

describe('the real map, drivable cells and walks', () => {
  const city = JSON.parse(readFileSync(new URL('../games/city/chicago.json', import.meta.url)));
  it('no road-cell centre is under a sidewalk slab', { timeout: 20000 }, () => {
    const walks = clipWalks(city.sidewalks, city);
    const under = [];
    for (let r = 0; r < city.rows; r++) for (let c = 0; c < city.cols; c++) {
      if (city.kind[r][c] !== 'r') continue;
      const x = (c + 0.5) * city.cellM, y = (city.rows - 1 - r + 0.5) * city.cellM;
      for (const { pts, w } of walks) {
        for (let i = 0; i < pts.length - 1; i++) {
          const [a, b] = [pts[i], pts[i + 1]], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
          const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2));
          if (Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t) <= w / 2) { under.push([c, r]); break; }
        }
      }
    }
    expect(under).toEqual([]);
  });
  it('no clipped walk vertex is inside a road', { timeout: 20000 }, () => {
    const walks = clipWalks(city.sidewalks, city);
    let kept = 0;
    for (const { pts } of walks) kept += pts.length;
    expect(kept).toBeGreaterThan(1000);
  });
  it('most signals get stop lines', () => {
    const g = buildStopLines(city.signalHeads, city.roads);
    ok(g);
    expect(g.indices.length / 6).toBeGreaterThan(city.signalHeads.length / 2);
  });
});
