import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { furnitureTier } from '../games/city/quality.js';
import {
  hash01, treeSpecs, crownBlobs, lampSpecs, railSegments, railColumns, columnLegs, railParts, clearanceFromRoads,
} from '../games/city/street-furniture.js';

const city = JSON.parse(readFileSync(new URL('../games/city/chicago.json', import.meta.url), 'utf8'));

describe('hash01', () => {
  it('is deterministic, in [0,1) and spread', () => {
    expect(hash01(5, 2)).toBe(hash01(5, 2));
    expect(hash01(5, 2)).not.toBe(hash01(5, 3));
    const v = Array.from({ length: 500 }, (_, i) => hash01(i));
    expect(Math.min(...v)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...v)).toBeLessThan(1);
    expect(new Set(v).size).toBeGreaterThan(490);
  });
});

describe('treeSpecs', () => {
  const pts = [[10, 20], [11, 21], [12, 22], [13, 23]];
  it('puts each tree where the data does (world z = -y) and is repeatable', () => {
    const a = treeSpecs(pts, 1), b = treeSpecs(pts, 1);
    expect(a).toEqual(b);
    expect(a.map((t) => [t.x, t.z])).toEqual([[10, -20], [11, -21], [12, -22], [13, -23]]);
  });
  it('varies size, shape and green by tree index, inside sane limits', () => {
    const specs = treeSpecs(city.trees, 1);
    expect(specs).toHaveLength(4128);
    const key = (f) => new Set(specs.map(f)).size;
    expect(key((t) => t.crownR.toFixed(2))).toBeGreaterThan(10);
    expect(key((t) => t.dl.toFixed(2))).toBeGreaterThan(10);
    for (const t of specs) {
      expect(t.trunkH).toBeGreaterThan(1.5); expect(t.trunkH).toBeLessThan(4);
      expect(t.crownR).toBeGreaterThan(1.5); expect(t.crownR).toBeLessThan(4);
      expect(Math.abs(t.dl)).toBeLessThanOrEqual(0.12); expect(Math.abs(t.dh)).toBeLessThanOrEqual(0.05);
      expect(Number.isFinite(t.rot)).toBe(true);
    }
  });
  it('a lighter tier keeps every nth tree but each keeps its own look', () => {
    const all = treeSpecs(pts, 1), half = treeSpecs(pts, 2);
    expect(half.map((t) => t.x)).toEqual([10, 12]);
    expect(half[1]).toEqual(all[2]);
  });
  it('crown blobs: three irregular ones, or one for the phone', () => {
    expect(crownBlobs(3)).toHaveLength(3);
    expect(crownBlobs(1)).toEqual([crownBlobs(3)[0]]);
    expect(new Set(crownBlobs(3).map((b) => b.r)).size).toBe(3);
  });
});

describe('lampSpecs', () => {
  it('maps the data points to world x, z', () => {
    expect(lampSpecs([[3, 4], [5, -6]])).toEqual([{ x: 3, z: -4 }, { x: 5, z: 6 }]);
    expect(lampSpecs(city.lamps)).toHaveLength(city.lamps.length);
  });
});

describe('railSegments', () => {
  it('one box per polyline segment, along it, with its heading', () => {
    const s = railSegments([[0, 0], [10, 0], [10, 10]]);
    expect(s).toHaveLength(2);
    expect(s[0].x).toBeCloseTo(5); expect(s[0].z).toBeCloseTo(0); expect(s[0].len).toBeGreaterThanOrEqual(10);
    expect(s[0].yaw).toBeCloseTo(0);
    expect(s[1].z).toBeCloseTo(-5); expect(s[1].yaw).toBeCloseTo(Math.PI / 2); // data y up is world -z
  });
});

describe('railColumns', () => {
  const straight = [[0, 0], [100, 0]];
  it('spaces columns about 20 m apart along the line', () => {
    const c = railColumns(straight, [], { spacing: 20 });
    expect(c).toHaveLength(5);
    const xs = c.map((k) => k.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeCloseTo(20, 0);
  });
  it('lands both legs beside a road the line runs down, not in the lane', () => {
    const road = [{ pts: [[-10, 0], [110, 0]], w: 7 }];
    for (const k of railColumns(straight, road, { spacing: 20 })) {
      for (const [x, z] of columnLegs(k)) expect(clearanceFromRoads(x, z, road)).toBeGreaterThanOrEqual(0);
    }
  });
  it('legs sit square across a diagonal line', () => {
    const k = railColumns([[0, 0], [30, 40]], [], { spacing: 50 })[0];
    const [a, b] = columnLegs(k), tx = Math.cos(k.yaw), tz = -Math.sin(k.yaw);
    expect((a[0] - b[0]) * tx + (a[1] - b[1]) * tz).toBeCloseTo(0);
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeCloseTo(2 * k.lat);
    expect(tx).toBeCloseTo(0.6); expect(tz).toBeCloseTo(-0.8);
  });
  it('real L: columns stay near the line and almost all legs are off the driving lanes', () => {
    let legs = 0, off = 0;
    for (const r of city.rail.filter((q) => q.elevated)) {
      for (const k of railColumns(r.pts, city.roads)) {
        for (const [x, z] of columnLegs(k)) { legs++; if (clearanceFromRoads(x, z, city.roads) >= 0) off++; }
      }
    }
    expect(legs).toBeGreaterThan(200);
    expect(off / legs).toBeGreaterThan(0.8);
  });
});

describe('railParts', () => {
  it('elevated line: deck, two girders, two rails per segment, plus columns, at height h', () => {
    const parts = railParts({ pts: [[0, 0], [40, 0]], h: 8, elevated: true }, []);
    const by = (c) => parts.filter((p) => p.colour === c);
    expect(by('deck')).toHaveLength(1);
    expect(by('rail')).toHaveLength(2);
    expect(by('steel').length).toBeGreaterThanOrEqual(2 + 3); // girders + at least one beam and two legs
    expect(Math.max(...by('rail').map((p) => p.y))).toBeGreaterThan(8);
    expect(by('deck')[0].y).toBeLessThanOrEqual(8);
  });
  it('ground line: a track bed and two rails, no structure', () => {
    const parts = railParts({ pts: [[0, 0], [40, 0]], h: 0, elevated: false }, []);
    expect(parts.map((p) => p.colour).sort()).toEqual(['bed', 'rail', 'rail']);
    expect(Math.max(...parts.map((p) => p.y))).toBeLessThan(1);
  });
  it('the whole L is finite and in one modest instance count', () => {
    const all = city.rail.flatMap((r) => railParts(r, city.roads));
    expect(all.length).toBeGreaterThan(500); expect(all.length).toBeLessThan(4000);
    for (const p of all) for (const v of [p.x, p.y, p.z, p.yaw, p.sx, p.sy, p.sz]) expect(Number.isFinite(v)).toBe(true);
  });
});

describe('furnitureTier', () => {
  it('phones get fewer trees, one-blob crowns, no glow and no furniture shadows', () => {
    const d = furnitureTier({ phone: false }), p = furnitureTier({ phone: true });
    expect(p.treeStep).toBeGreaterThan(d.treeStep);
    expect(p.crownBlobs).toBeLessThan(d.crownBlobs);
    expect(d.lampGlow).toBe(true); expect(p.lampGlow).toBe(false);
    expect(d.shadows).toBe(true); expect(p.shadows).toBe(false);
  });
});

describe('scene wiring', () => {
  const scene = readFileSync(new URL('../games/city/scene.js', import.meta.url), 'utf8');
  const furn = readFileSync(new URL('../games/city/scene-furniture.js', import.meta.url), 'utf8');
  it('scene.js builds, uses and disposes the furniture; no cones left', () => {
    expect(scene).toMatch(/buildFurniture\(/);
    expect(scene).toMatch(/furniture\.dispose\(\)/);
    expect(scene).not.toMatch(/ConeGeometry/);
  });
  it('the lamp heads glow untoned on desktop; nothing random or timed', () => {
    expect(furn).toMatch(/emissive/);
    expect(furn).toMatch(/toneMapped: false/);
    expect(furn).not.toMatch(/Math\.random|Date\.now|performance\.now/);
    expect(readFileSync(new URL('../games/city/street-furniture.js', import.meta.url), 'utf8')).not.toMatch(/Math\.random|Date\.now|performance\.now/);
  });
});
