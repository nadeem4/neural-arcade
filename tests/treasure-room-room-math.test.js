import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeGrid } from '../assets/grid.js';
import { ROOM } from '../games/treasure-room/sim.js';
import {
  DIMS, PARTS, VIEW, cellToWorld, worldToCell, layoutRoom, nearSides, cameraPose, fitDistance,
  roomRadius, rayToCell, isTap, labelScale, tierFor, formatStats,
  MOVE_MS, moveStyle, tweenAt, facing, atTreasure
} from '../games/treasure-room/room-math.js';

const big = makeGrid(['S......', '.......', '...X...', '.#...#.', '......T', '.......', '.......', '.......', '.......']); // 7 x 9

describe('cells and world', () => {
  it('centres the room on the origin', () => {
    expect(cellToWorld(ROOM, 2, 2)).toEqual({ x: 0, z: 0 });
    expect(cellToWorld(big, 6, 8)).toEqual({ x: 3, z: 4 });
  });
  it('worldToCell inverts cellToWorld and is null outside', () => {
    for (const r of [ROOM, big]) for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const p = cellToWorld(r, x, y);
      expect(worldToCell(r, p.x + 0.4, p.z - 0.4)).toEqual({ x, y });
    }
    expect(worldToCell(ROOM, 2.6, 0)).toBeNull();
  });
});

describe('the move tween', () => {
  const A = { x: 1, y: 1 }, B = { x: 2, y: 1 };
  it('picks a style', () => {
    expect(MOVE_MS).toBe(350);
    expect(moveStyle({ from: A, to: B, ice: false, reduce: false })).toBe('hop');
    expect(moveStyle({ from: A, to: B, ice: true, reduce: false })).toBe('slide');
    expect(moveStyle({ from: A, to: B, ice: false, reduce: true })).toBe('snap');
    expect(moveStyle({ from: null, to: B })).toBe('snap');
    expect(moveStyle({ from: A, to: A })).toBe('snap');
  });
  it('snaps a move of more than one step instead of arcing across the room', () => {
    expect(moveStyle({ from: { x: 1, y: 1 }, to: { x: 4, y: 3 } })).toBe('snap');
    expect(moveStyle({ from: { x: 1, y: 1 }, to: { x: 2, y: 2 } })).toBe('snap');
    expect(moveStyle({ from: { x: 1, y: 1 }, to: { x: 3, y: 1 }, ice: true })).toBe('snap');
    expect(moveStyle({ from: A, to: { x: 1, y: 2 } })).toBe('hop');
  });
  it('hops up and lands, slides flat', () => {
    expect(tweenAt('hop', 0).lift).toBe(0);
    expect(tweenAt('hop', 1).lift).toBeCloseTo(0);
    expect(tweenAt('hop', 0.5).lift).toBeCloseTo(0.18);
    expect(tweenAt('slide', 0.5).lift).toBe(0);
    expect(tweenAt('hop', 1).k).toBe(1);
    expect(tweenAt('hop', 0).k).toBe(0);
  });
  it('faces the way it goes', () => {
    expect(facing({ x: 1, y: 1 }, { x: 2, y: 1 })).toBeCloseTo(Math.PI / 2);
    expect(facing({ x: 1, y: 1 }, { x: 1, y: 2 })).toBeCloseTo(0);
    expect(facing({ x: 1, y: 1 }, { x: 0, y: 1 })).toBeCloseTo(-Math.PI / 2);
    expect(facing({ x: 1, y: 1 }, { x: 1, y: 0 })).toBeCloseTo(Math.PI);
  });
  it('knows the treasure', () => {
    expect(atTreasure(ROOM, { x: 4, y: 3 })).toBe(true);
    expect(atTreasure(ROOM, { x: 0, y: 0 })).toBe(false);
    expect(atTreasure(ROOM, null)).toBe(false);
  });
});

describe('layoutRoom', () => {
  it('lays out any grid size', () => {
    for (const r of [ROOM, big]) {
      const L = layoutRoom(r);
      expect(L.tiles).toHaveLength(r.w * r.h);
      expect(L.tiles.filter(t => t.part === 'floor_tile_big_spikes')).toHaveLength(1);
      expect(L.blocks).toHaveLength(r.cells.flat().filter(c => c === '#').length);
      expect(L.walls).toHaveLength(2 * (r.w + r.h));
      expect(L.corners).toHaveLength(4);
      for (const w of L.walls) expect(w.outward[0] * w.x + w.outward[1] * w.z).toBeGreaterThan(0);
      for (const c of L.corners) {
        expect(Math.abs(c.x) + L.cornerSize / 2).toBeCloseTo(r.w / 2 + L.wallD);
        expect(Math.abs(c.z) + L.cornerSize / 2).toBeCloseTo(r.h / 2 + L.wallD);
      }
    }
  });
  it('turns each corner so its arms run along the walls', () => {
    const L = layoutRoom(ROOM);
    // The model's L has arms along local -x and +z; rotY turns them to (-cos, sin) and (sin, cos) in x and z.
    const key = ([x, z]) => `${Math.round(x)},${Math.round(z)}`;
    for (const c of L.corners) {
      const arms = [[-Math.cos(c.rotY), Math.sin(c.rotY)], [Math.sin(c.rotY), Math.cos(c.rotY)]].map(key).sort();
      const towardRoom = [[-Math.sign(c.x), 0], [0, -Math.sign(c.z)]].map(key).sort();
      expect(arms).toEqual(towardRoom);
    }
  });
  it('stands the chest upright with coins beside it, on the treasure cell', () => {
    const L = layoutRoom(ROOM);
    expect(L.chest).toMatchObject({ y: 0, rotX: PARTS.chest_gold.rotX });
    expect(L.coin).toBeTruthy();
    const t = cellToWorld(ROOM, 4, 3);
    expect(Math.abs(L.chest.x - t.x)).toBeLessThan(0.5);
    expect(Math.abs(L.chest.z - t.z)).toBeLessThan(0.5);
  });
  it('puts floor tiles flush with y = 0 and blocks low', () => {
    const L = layoutRoom(ROOM);
    for (const t of L.tiles.filter(t => t.part === 'floor_tile_large')) expect(t.y).toBeLessThanOrEqual(0);
    for (const b of L.blocks) { expect(b.h).toBeLessThan(L.wallH / 2); expect(b.y).toBeCloseTo(b.h / 2); }
  });
  it('hangs two torches on the north wall', () => {
    const L = layoutRoom(ROOM);
    expect(L.torches).toHaveLength(2);
    for (const t of L.torches) expect(t.z).toBeLessThan(-ROOM.h / 2 + 0.5);
  });
  it('takes measured dims', () => {
    const L = layoutRoom(ROOM, { ...DIMS, wall: { w: 2, h: 2, d: 0.5 } });
    expect(L.wallH).toBeCloseTo(1);
  });
});

describe('camera and picking', () => {
  it('names the sides that face the camera', () => {
    expect([...nearSides(0.44)].sort()).toEqual(['E', 'S']);
    expect([...nearSides(0)]).toEqual(['S']);
    expect([...nearSides(-0.5)].sort()).toEqual(['S', 'W']);
  });
  it('a tap lands on the right tile at every allowed turn of the camera', () => {
    for (const az of [VIEW.azimuth - VIEW.azRange, VIEW.azimuth, VIEW.azimuth + VIEW.azRange]) {
      for (const polar of [VIEW.polarMin, VIEW.polar, VIEW.polarMax]) {
        for (const [x, y] of [[0, 0], [4, 0], [0, 4], [4, 4], [2, 2]]) {
          const pose = cameraPose({ azimuth: az, polar, dist: 9, target: [0, 0, 0] }), p = cellToWorld(ROOM, x, y);
          const dir = [p.x - pose.position[0], -pose.position[1], p.z - pose.position[2]];
          expect(rayToCell(ROOM, pose.position, dir)).toEqual({ x, y });
        }
      }
    }
  });
  it('rays that miss the floor give null', () => {
    expect(rayToCell(ROOM, [0, 5, 0], [0, 1, 0])).toBeNull();
    expect(rayToCell(ROOM, [9, 5, 0], [0, -1, 0])).toBeNull();
  });
  it('fits more distance on a narrow view and on a bigger room', () => {
    expect(fitDistance({ w: 360, h: 360, fov: 35, radius: 4 })).toBeGreaterThanOrEqual(fitDistance({ w: 1280, h: 360, fov: 35, radius: 4 }));
    expect(roomRadius(big, 0.25)).toBeGreaterThan(roomRadius(ROOM, 0.25));
  });
});

describe('taps, labels, tiers and stats', () => {
  it('a tap is short and still', () => {
    expect(isTap({ x: 0, y: 0, t: 0 }, { x: 3, y: 4, t: 200 })).toBe(true);
    expect(isTap({ x: 0, y: 0, t: 0 }, { x: 30, y: 0, t: 200 })).toBe(false);
    expect(isTap({ x: 0, y: 0, t: 0 }, { x: 0, y: 0, t: 900 })).toBe(false);
  });
  it('labels are bigger on a narrow view', () => {
    expect(labelScale(360)).toBeGreaterThan(labelScale(1280));
    expect(labelScale(360)).toBeCloseTo(0.24 * 1.9, 5);
    expect(labelScale(1280)).toBeCloseTo(0.24, 5);
  });
  it('the widest label at 360 wide is no wider than a tile', () => {
    expect(2 * labelScale(360)).toBeLessThanOrEqual(1); // the quad is 2 * scale wide, and holds "-10.0"
  });
  it('tiers', () => {
    expect(tierFor(360)).toMatchObject({ pixelRatioMax: 1.5, shadowMap: 512, torchLights: false });
    expect(tierFor(1280)).toMatchObject({ pixelRatioMax: 2, shadowMap: 1024, torchLights: true });
  });
  it('formats the debug line', () => {
    expect(formatStats({ fps: 59.6, calls: 24, triangles: 41200, geometries: 18, textures: 3, kb: 565, firstMs: 223 }))
      .toBe('60 fps | 24 calls | 41.2k tris | 18 geo | 3 tex | 565 KB | first 223 ms');
  });
  it('stays pure', () => {
    const src = readFileSync(new URL('../games/treasure-room/room-math.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from\s+['"](three|\.\.\/\.\.\/assets\/vendor)/);
    expect(src).not.toMatch(/\bdocument\b|\bwindow\b/);
  });
});
