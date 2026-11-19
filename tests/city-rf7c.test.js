import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld } from '../games/city/sim.js';
import { tripEvents } from '../games/city/events.js';
import { routeFrames, chaseCamera } from '../games/city/playback.js';
import { driveTrack, stateAt } from '../games/city/drive.js';
import { clipEased, roofAt, wallPush, cellHeights, ROAD_Y, chaseForAspect } from '../games/city/scene-math.js';
import { shotAt } from '../games/city/director.js';
import { solidRings } from '../games/city/walls.js';
import { cityBounds } from '../games/city/geometry.js';

const read = (f) => JSON.parse(readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8'));
const city = read('chicago.json'), story = read('story.json');
const world = { ...loadWorld(city), height: cellHeights(city) }, cm = city.cellM, walls = solidRings(city);
const { cx, cz, radius } = cityBounds(city);
const towers = city.buildings.filter((b) => !(b.hasParts && !b.part) && (b.minH ?? 0) < 2).map((b) => ({ ring: b.ring, h: b.h ?? 12 }));

// Horizontal metres from a camera to the nearest building that is taller than the camera (0 inside its outline).
const wallGap = ([x, y, z]) => {
  const py = -z; let best = Infinity;
  for (const { ring, h } of towers) {
    if (h < y) continue;
    let inside = false, d = Infinity;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j], b = ring[i];
      if ((b[1] > py) !== (a[1] > py) && x < ((a[0] - b[0]) * (py - b[1])) / (a[1] - b[1]) + b[0]) inside = !inside;
      const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (py - a[1]) * dy) / l)) : 0;
      d = Math.min(d, Math.hypot(x - a[0] - t * dx, py - a[1] - t * dy));
    }
    best = Math.min(best, inside ? 0 : d);
  }
  return best;
};

describe('RF7c: a pull-back keeps clear of tower walls, however the drive was cut', () => {
  const clip = { margin: 2, minY: ROAD_Y + 2.7 };
  const roof = (x, z) => roofAt(world, cm, x, z), push = (x, z, y) => wallPush(world, cm, x, z, y);
  const pitch = 0.95, r = radius * 1.25, mapShot = { pos: [cx, Math.sin(pitch) * r, cz + Math.cos(pitch) * r], target: [cx, 0, cz], fov: 38 };
  for (const aspect of [390 / 844, 1280 / 720]) {
    for (const card of story.cards) {
      it(`${card.id} at aspect ${aspect.toFixed(2)}: 7 m from every taller tower from 100 ms on, full or cut`, () => {
        const track = driveTrack(routeFrames(world, cm, card.route), tripEvents(world, card.rewards, card.route), { walls });
        const chaseAt = (t) => ({ ...chaseCamera(stateAt(track, t), chaseForAspect(aspect)), fov: 55 });
        const line = (t) => { const s = chaseAt(t); return { pos: s.pos, target: [s.target[0], ROAD_Y, s.target[2]] }; };
        for (const f of [1, 0.2, 0.37, 0.61, 0.83]) {
          const bt = Math.round(track.total * f), from = { ...chaseAt(bt), pos: clipEased(line, bt, world, cm, clip).pos };
          for (let t = 100; t <= 400; t += 1000 / 60) {
            const gap = wallGap(shotAt('pullback', t, mapShot, from, { roof, push }).pos);
            expect(gap, `drive cut at ${f} of the trip, ${Math.round(t)} ms into the pull-back`).toBeGreaterThanOrEqual(7);
          }
        }
      }, 30000);
    }
  }
  it('wallPush points away from a building and is nothing in the open or above the roofs', () => {
    const w = { cols: 4, rows: 1, kind: Uint8Array.from([0, 0, 3, 3]), height: new Float32Array([0, 0, 30, 30]) }; // buildings from x = 24 east; row 0 is z in [-12, 0)
    const p = wallPush(w, 12, 20, -6, 5);
    expect(p[0]).toBeLessThan(0);
    expect(wallPush(w, 12, 20, -6, 80)).toBeNull(); // above a 30 m roof
    expect(wallPush(w, 12, 3, -6, 5)).toBeNull(); // 21 m from the nearest building cell centre
  });
});
