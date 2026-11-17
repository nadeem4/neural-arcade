import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildBuildings, buildRoadStrips, buildLaneMarks, buildFlats, treePositions, cityBounds, triangulate, cellCentre,
} from '../games/city/geometry.js';

const square = (x, y, s, h) => ({ ring: [[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]], h });
const areaOf = (pos, idx) => {
  let a = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const [p, q, r] = [idx[i], idx[i + 1], idx[i + 2]].map((k) => [pos[k * 3], pos[k * 3 + 2]]);
    a += Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1])) / 2;
  }
  return a;
};
const inRing = (x, y, ring) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

describe('buildBuildings', () => {
  const m = buildBuildings([square(10, 20, 8, 12)]);
  it('stays within the footprint and height, north is -z', () => {
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < m.positions.length; i += 3) {
      const [x, y, z] = [m.positions[i], m.positions[i + 1], m.positions[i + 2]];
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      expect(x).toBeGreaterThanOrEqual(10); expect(x).toBeLessThanOrEqual(18);
      expect(z).toBeGreaterThanOrEqual(-28); expect(z).toBeLessThanOrEqual(-20);
    }
    expect(minY).toBe(0); expect(maxY).toBe(12);
  });
  it('has valid indices and unit normals', () => {
    expect(m.indices.length % 3).toBe(0);
    expect(m.indices.length).toBeGreaterThan(0);
    const n = m.positions.length / 3;
    for (const i of m.indices) expect(i).toBeLessThan(n);
    expect(m.normals.length).toBe(m.positions.length);
    for (let i = 0; i < m.normals.length; i += 3) {
      expect(Math.hypot(m.normals[i], m.normals[i + 1], m.normals[i + 2])).toBeCloseTo(1, 5);
    }
  });
  it('faces outward: triangle winding agrees with the stored normal, for CW and CCW rings', () => {
    const cw = { ring: [[0, 0], [0, 5], [5, 5], [5, 0], [0, 0]], h: 4 };
    for (const b of [square(0, 0, 5, 4), cw]) {
      const g = buildBuildings([b]);
      for (let i = 0; i < g.indices.length; i += 3) {
        const [a, p, q] = [g.indices[i], g.indices[i + 1], g.indices[i + 2]];
        const v = (k) => [g.positions[k * 3], g.positions[k * 3 + 1], g.positions[k * 3 + 2]];
        const [A, B, C] = [v(a), v(p), v(q)];
        const u = B.map((t, k) => t - A[k]), w = C.map((t, k) => t - A[k]);
        const c = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
        const dot = c[0] * g.normals[a * 3] + c[1] * g.normals[a * 3 + 1] + c[2] * g.normals[a * 3 + 2];
        expect(dot).toBeGreaterThan(0);
      }
    }
  });
  it('triangulates a concave L footprint to its real area', () => {
    const L = [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10], [0, 0]];
    const roof = buildFlats([L], 0);
    expect(areaOf(roof.positions, roof.indices)).toBeCloseTo(64, 5);
    const tri = triangulate(L.slice(0, -1).reverse());
    expect(tri.length).toBe(4 * 3);
  });
  it('skips degenerate rings', () => {
    expect(buildBuildings([{ ring: [[0, 0], [1, 1], [0, 0]], h: 5 }]).indices.length).toBe(0);
  });
});

describe('roads', () => {
  const two = { pts: [[0, 0], [20, 0]], w: 8, oneway: 0 };
  it('road strip is a ribbon of the right width', () => {
    const g = buildRoadStrips([two]);
    expect(g.indices.length % 3).toBe(0);
    expect(areaOf(g.positions, g.indices)).toBeCloseTo(160, 5);
    for (const i of g.indices) expect(i).toBeLessThan(g.positions.length / 3);
  });
  it('lane marks are dashed on two-way roads and absent on one-way roads', () => {
    expect(buildLaneMarks([two]).indices.length).toBeGreaterThan(0);
    expect(buildLaneMarks([{ ...two, oneway: 1 }]).indices.length).toBe(0);
    expect(buildLaneMarks([{ ...two, w: 3 }]).indices.length).toBe(0);
  });
});

describe('treePositions', () => {
  const parks = [[[0, 0], [60, 0], [60, 40], [0, 40], [0, 0]]];
  it('is deterministic, inside the park, about 1 per 120 m2', () => {
    const a = treePositions(parks, 7), b = treePositions(parks, 7);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(a.length / 3).toBe(20);
    for (let i = 0; i < a.length; i += 3) expect(inRing(a[i], -a[i + 2], parks[0])).toBe(true);
    expect(Array.from(treePositions(parks, 8))).not.toEqual(Array.from(a));
  });
  it('caps at 600', () => {
    const big = [[[0, 0], [1000, 0], [1000, 1000], [0, 1000], [0, 0]]];
    expect(treePositions(big, 1).length / 3).toBe(600);
  });
});

describe('cityBounds', () => {
  it('contains every building', () => {
    const city = { buildings: [square(0, 0, 10, 5), square(300, 500, 10, 5)], roads: [] };
    const { cx, cz, radius } = cityBounds(city);
    for (const b of city.buildings) for (const [x, y] of b.ring) {
      expect(Math.hypot(x - cx, -y - cz)).toBeLessThanOrEqual(radius + 1e-6);
    }
  });
});

describe('real map', () => {
  it('builds finite geometry within budget', { timeout: 20000 }, () => {
    const city = JSON.parse(readFileSync(new URL('../games/city/chicago.json', import.meta.url)));
    const t0 = performance.now();
    const parts = {
      b: buildBuildings(city.buildings), r: buildRoadStrips(city.roads), l: buildLaneMarks(city.roads),
      f: buildFlats([...city.parks, ...city.water], 0), p: buildRoadStrips(city.paths),
      t: treePositions(city.parks, 1),
    };
    const ms = performance.now() - t0;
    let verts = 0, tris = 0;
    for (const g of Object.values(parts)) {
      for (const arr of g.positions ? Object.values(g) : [g]) {
        for (const v of arr) expect(Number.isFinite(v)).toBe(true);
      }
      verts += (g.positions ?? g).length / 3; tris += (g.indices?.length ?? 0) / 3;
    }
    console.log(`real map: ${verts} vertices, ${tris} triangles, ${Math.round(ms)} ms`);
    expect(verts).toBeLessThan(400000);
    expect(parts.b.indices.length).toBeGreaterThan(0);
    expect(parts.t.length / 3).toBeLessThanOrEqual(600);
    const { radius } = cityBounds(city);
    expect(radius).toBeGreaterThan(100);
  });
});

describe('cellCentre', () => {
  it('matches the converter grid (x east, y north, row 0 is north) with z = -y', () => {
    const rows = 112, cellM = 12; // convert.js: y = (rows - 1 - row + 0.5) * cellM
    const city = { rows, cellM };
    for (const [c, r] of [[0, 0], [24, 28], [75, 111]]) {
      const [x, z] = cellCentre(c, r, city);
      expect(x).toBe((c + 0.5) * cellM);
      expect(z).toBe(-((rows - 1 - r + 0.5) * cellM));
    }
  });
});
