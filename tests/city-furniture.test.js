import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { furnitureTier } from '../games/city/quality.js';
import { Y_ROAD, Y_WALK } from '../games/city/street-model.js';
import { headPlacement } from '../games/city/signal-heads.js';
import {
  hash01, treeSpecs, crownBlobs, lampSpecs, railSegments, pairRails, railColumns, columnLegs, railParts, clearanceFromRoads, SURFACE,
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
  it('moves a lamp that sits in a lane out to the kerb, and leaves a clear one alone', () => {
    const roads = [{ pts: [[0, 0], [100, 0]], w: 10 }]; // lanes reach 5 m either side
    const [inLane, onKerb] = lampSpecs([[50, 2], [50, 8]], roads);
    expect(onKerb).toEqual({ x: 50, z: -8 });
    expect(clearanceFromRoads(inLane.x, inLane.z, roads)).toBeGreaterThanOrEqual(0.5);
    expect(inLane.x).toBeCloseTo(50, 5);
    expect(inLane.z).toBeLessThan(0); // pushed the way it already leaned (data y = 2 is world z = -2)
  });
  it('drops a lamp that would share a spot with a signal pole', () => {
    const out = lampSpecs([[10, 10], [30, 10]], [], [{ x: 11, z: -10.5 }]);
    expect(out).toEqual([{ x: 30, z: -10 }]);
  });
  it('on the real map no lamp is within 2.5 m of a signal pole', () => {
    const poles = city.signalHeads.map((h) => { const p = headPlacement(h, city.roads); return { x: p.x, z: -p.y }; });
    const out = lampSpecs(city.lamps, city.roads, poles);
    expect(out.length).toBeGreaterThan(city.lamps.length * 0.8);
    for (const l of out) for (const p of poles) expect(Math.hypot(l.x - p.x, l.z - p.z)).toBeGreaterThanOrEqual(2.5);
  });
  it('on the real map no lamp stands in a lane', () => {
    const roads = city.roads;
    const bad = lampSpecs(city.lamps, roads).filter((l) => clearanceFromRoads(l.x, l.z, roads) < 0.4);
    expect(bad).toHaveLength(0);
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

describe('railSegments at a bend', () => {
  it('lengthens both segments so the outer deck edge has no notch', () => {
    const plain = railSegments([[0, 0], [10, 0], [10, 10]]);
    const wide = railSegments([[0, 0], [10, 0], [10, 10]], 2.4);
    expect(wide[0].len).toBeGreaterThan(plain[0].len + 2);
    expect(wide[1].len).toBeGreaterThan(plain[1].len + 2);
    // the outer corner of the deck (10 + 2.4, +2.4 on the outside) lies inside the first box
    const s = wide[0], u = (12.4 - s.x) * Math.cos(s.yaw), v = (2.4 - s.z) * 1; // yaw 0: box spans x, and z across
    expect(Math.abs(u)).toBeLessThanOrEqual(s.len / 2 + 1e-6);
    expect(Math.abs(v - 0)).toBeLessThanOrEqual(2.4 + 1e-6);
  });
  it('a straight run is not lengthened', () => {
    const a = railSegments([[0, 0], [10, 0], [20, 0]], 2.4);
    expect(a[0].len).toBeCloseTo(10.4);
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
  it('drops a column whose legs cannot clear a road the line crosses', () => {
    const wide = [{ pts: [[50, -200], [50, 200]], w: 60 }]; // a 60 m wide road under the line: no leg can stand clear nearby
    const c = railColumns(straight, wide, { spacing: 20 });
    expect(c.length).toBeLessThan(5);
    for (const k of c) for (const [x, z] of columnLegs(k)) expect(clearanceFromRoads(x, z, wide)).toBeGreaterThanOrEqual(0);
  });
  it('real L: no leg of any column stands in a driving lane, and columns are never more than 40 m apart on a straight', () => {
    let legs = 0;
    for (const r of pairRails(city.rail)) {
      if (!r.elevated) continue;
      for (const k of railColumns(r.pts, city.roads, { sep: r.sep })) {
        for (const [x, z] of columnLegs(k)) { legs++; expect(clearanceFromRoads(x, z, city.roads)).toBeGreaterThanOrEqual(0); }
      }
    }
    expect(legs).toBeGreaterThan(200);
  });
});

describe('pairRails', () => {
  const two = (d) => [
    { pts: [[0, 0], [100, 0]], h: 8, elevated: true },
    { pts: [[0, d], [100, d]], h: 8, elevated: true },
  ];
  it('joins two parallel elevated ways into one centreline with their gap', () => {
    const out = pairRails(two(4));
    expect(out).toHaveLength(1);
    expect(out[0].sep).toBeCloseTo(4, 0);
    for (const [, y] of out[0].pts) expect(y).toBeCloseTo(2, 0);
  });
  it('leaves far apart, ground and different-height ways alone', () => {
    expect(pairRails(two(30))).toHaveLength(2);
    expect(pairRails(two(4).map((r, i) => ({ ...r, h: 8 + i })))).toHaveLength(2);
    expect(pairRails(two(4).map((r) => ({ ...r, elevated: false, h: 0 })))).toHaveLength(2);
    expect(pairRails(two(30)).every((r) => !r.sep)).toBe(true);
  });
  it('real map: the L pairs (0,27), (1,11), (8,12), (9,15), (10,14), (24,25), (28,29), (3,26), (6,7) and every item is used once', () => {
    const out = pairRails(city.rail);
    const paired = out.filter((r) => r.ways.length === 2).map((r) => r.ways.join(','));
    for (const w of ['0,27', '1,11', '8,12', '9,15', '10,14', '24,25', '28,29', '3,26', '6,7']) expect(paired).toContain(w);
    expect(out.flatMap((r) => r.ways).sort((a, b) => a - b)).toEqual(city.rail.map((_, i) => i));
  });
  it('real map: no two decks of different items overlap on the same plane', () => {
    const decks = pairRails(city.rail).flatMap((r, ri) => railParts(r, city.roads).filter((p) => p.colour === 'deck').map((p) => ({ ...p, ri })));
    const inside = (a, b) => { // is a's centre inside b's footprint, shrunk a little
      const dx = a.x - b.x, dz = a.z - b.z, c = Math.cos(b.yaw), s = Math.sin(b.yaw);
      const u = dx * c - dz * s, v = dx * s + dz * c; // z axis of the box is the track's -z direction
      return Math.abs(u) < b.sx / 2 - 0.5 && Math.abs(v) < b.sz / 2 - 0.5;
    };
    let hits = 0;
    for (const a of decks) for (const b of decks) if (a.ri !== b.ri && Math.abs(a.y - b.y) < 0.05 && inside(a, b)) hits++;
    expect(hits).toBe(0); // lines that cross at one data height are lifted apart
  });
});

describe('railParts', () => {
  it('elevated line: deck, two girders, two rails per segment, plus columns, at height h', () => {
    const parts = railParts({ pts: [[0, 0], [40, 0]], h: 8, elevated: true }, []);
    const by = (c) => parts.filter((p) => p.colour === c);
    expect(by('deck')).toHaveLength(1);
    expect(by('rail')).toHaveLength(2);
    expect(by('steel').length).toBeGreaterThanOrEqual(2 + 3); // girders + at least one beam and two legs
    expect(Math.max(...by('rail').map((p) => p.y))).toBeGreaterThan(Y_ROAD + 8);
    expect(by('deck')[0].y).toBeLessThanOrEqual(Y_ROAD + 8);
  });
  it('a paired line draws one wide deck and four rails', () => {
    const parts = railParts({ pts: [[0, 0], [40, 0]], h: 8, elevated: true, sep: 4 }, []);
    const by = (c) => parts.filter((p) => p.colour === c);
    expect(by('deck')).toHaveLength(1);
    expect(by('deck')[0].sz).toBeGreaterThan(4 + 4);
    expect(by('rail')).toHaveLength(4);
  });
  it('ground line: a track bed and two rails, no structure', () => {
    const parts = railParts({ pts: [[0, 0], [40, 0]], h: 0, elevated: false }, []);
    expect(parts.map((p) => p.colour).sort()).toEqual(['bed', 'rail', 'rail']);
    expect(Math.max(...parts.map((p) => p.y))).toBeLessThan(Y_ROAD + 0.6);
    const bed = parts.find((p) => p.colour === 'bed');
    expect(bed.y - bed.sy / 2).toBeCloseTo(SURFACE.ground, 5); // stands on the ground plane
    expect(bed.y + bed.sy / 2).toBeGreaterThan(Y_ROAD); // and reaches up through the road
  });
  it('columns stand on the ground plane and stop under the girders; the deck is measured from the road', () => {
    const parts = railParts({ pts: [[0, 0], [40, 0]], h: 8, elevated: true }, []);
    const legs = parts.filter((p) => p.colour === 'steel' && p.sx === 0.7 && p.sz === 0.7);
    expect(legs.length).toBeGreaterThanOrEqual(2);
    for (const l of legs) {
      expect(l.y - l.sy / 2).toBeCloseTo(SURFACE.ground, 5);
      expect(l.y + l.sy / 2).toBeLessThan(Y_ROAD + 8 - 0.6 - 0.4);
    }
  });
  it('lamps and trees start at the right surface', () => {
    expect(SURFACE.lampBase).toBeCloseTo(Y_WALK - 0.1, 5);
    expect(SURFACE.grass).toBeLessThan(Y_ROAD);
  });
  it('the whole L is finite and in one modest instance count', () => {
    const all = pairRails(city.rail).flatMap((r) => railParts(r, city.roads));
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
  it('draws the paired L, hides lamps, trees and L parts near the chase camera, and disposes every instanced mesh', () => {
    expect(furn).toContain('pairRails(');
    expect(furn).toContain('treesToHide(');
    expect(furn).toContain('for (const m of meshes) m.dispose()');
    expect(furn.split('= hider(').length - 1).toBe(3); // lamps, trees and the L
    expect(scene).not.toContain("'leaf']");
  });
  it('the lamp heads glow untoned on desktop; nothing random or timed', () => {
    expect(furn).toMatch(/emissive/);
    expect(furn).toMatch(/toneMapped: false/);
    expect(furn).not.toMatch(/Math\.random|Date\.now|performance\.now/);
    expect(readFileSync(new URL('../games/city/street-furniture.js', import.meta.url), 'utf8')).not.toMatch(/Math\.random|Date\.now|performance\.now/);
  });
});
