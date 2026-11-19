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
      it(`${card.id} at aspect ${aspect.toFixed(2)}: 5 m from every taller tower from 100 ms on, full or cut`, () => {
        const track = driveTrack(routeFrames(world, cm, card.route), tripEvents(world, card.rewards, card.route), { walls });
        const chaseAt = (t) => ({ ...chaseCamera(stateAt(track, t), chaseForAspect(aspect)), fov: 55 });
        const line = (t) => { const s = chaseAt(t); return { pos: s.pos, target: [s.target[0], ROAD_Y, s.target[2]] }; };
        for (const f of [1, 0.2, 0.37, 0.61, 0.83]) {
          const bt = Math.round(track.total * f), from = { ...chaseAt(bt), pos: clipEased(line, bt, world, cm, clip).pos };
          for (let t = 100; t <= 400; t += 1000 / 60) {
            const gap = wallGap(shotAt('pullback', t, mapShot, from, { roof, push }).pos);
            expect(gap, `drive cut at ${f} of the trip, ${Math.round(t)} ms into the pull-back`).toBeGreaterThanOrEqual(5);
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

describe('RF7c: the wall drift is capped', () => {
  const clip = { margin: 2, minY: ROAD_Y + 2.7 };
  const roof = (x, z) => roofAt(world, cm, x, z), push = (x, z, y) => wallPush(world, cm, x, z, y);
  const aspect = 390 / 844;
  const views = [[0.95, 0, 1.25], [0.3, 2.6, 1.25], [0.3, 4, 0.4]]; // pitch, yaw, zoom
  const sweep = (fn) => {
    for (const [pitch, yaw, zoom] of views) {
      const r = radius * zoom, mapShot = { pos: [cx + Math.sin(yaw) * Math.cos(pitch) * r, Math.sin(pitch) * r, cz + Math.cos(yaw) * Math.cos(pitch) * r], target: [cx, 0, cz], fov: 38 };
      for (const card of story.cards.filter((c) => ['walk', 'mile'].includes(c.id))) {
        const track = driveTrack(routeFrames(world, cm, card.route), tripEvents(world, card.rewards, card.route), { walls });
        const chaseAt = (t) => ({ ...chaseCamera(stateAt(track, t), chaseForAspect(aspect)), fov: 55 });
        const line = (t) => { const s = chaseAt(t); return { pos: s.pos, target: [s.target[0], ROAD_Y, s.target[2]] }; };
        for (const f of [0.1, 1]) {
          const bt = Math.round(track.total * f), from = { ...chaseAt(bt), pos: clipEased(line, bt, world, cm, clip).pos };
          fn(mapShot, from, card.id + ' cut ' + f + ', pitch ' + pitch + ' yaw ' + yaw + ' zoom ' + zoom);
        }
      }
    }
  };
  it('drifts at most 20 m (PUSH_REACH) sideways off the straight line from the chase camera to the map camera', () => {
    sweep((mapShot, from, label) => {
      const [x0, z0] = [from.pos[0], from.pos[2]], dx = mapShot.pos[0] - x0, dz = mapShot.pos[2] - z0, len = Math.hypot(dx, dz);
      for (let t = 5; t < 1200; t += 5) {
        const c = shotAt('pullback', t, mapShot, from, { roof, push }).pos, side = Math.abs((c[0] - x0) * dz - (c[2] - z0) * dx) / len;
        expect(side, label + ' at ' + t + ' ms').toBeLessThanOrEqual(20.01);
      }
    });
  }, 120000);
});

describe('RF7c: a full-length trip keeps the plain path exactly', () => {
  const clip = { margin: 2, minY: ROAD_Y + 2.7 };
  const roof = (x, z) => roofAt(world, cm, x, z);
  const pitch = 0.3, r = radius * 1.25, mapShot = { pos: [cx + Math.sin(2.6) * Math.cos(pitch) * r, Math.sin(pitch) * r, cz + Math.cos(2.6) * Math.cos(pitch) * r], target: [cx, 0, cz], fov: 38 };
  const frozen = {"phone speed":[[164.979929,20.449953,-359.185067],[191.663,189.655513,-394.868404],[411.09077,188.037345,-688.309712],[850.339283,359.433542,-1275.71785],[1209.991378,472.065328,-1756.681499]],"phone walk":[[190.110378,20.449953,-332.309448],[227.555959,184.777723,-384.539215],[430.477039,188.037345,-667.577175],[859.473575,359.433542,-1265.949233],[1210.731458,472.065328,-1755.890025]],"phone lights":[[190.110378,20.449953,-332.309448],[227.555959,184.777723,-384.539215],[430.477039,188.037345,-667.577175],[859.473575,359.433542,-1265.949233],[1210.731458,472.065328,-1755.890025]],"phone legal":[[190.110378,20.449953,-332.309448],[227.555959,184.777723,-384.539215],[430.477039,188.037345,-667.577175],[859.473575,359.433542,-1265.949233],[1210.731458,472.065328,-1755.890025]],"phone mile":[[296.615615,20.449953,-742.125242],[352.533035,84.655513,-804.661981],[512.637891,188.037345,-983.719518],[898.185571,359.433542,-1414.907051],[1213.867985,472.065328,-1767.958899]],"desktop speed":[[164.979929,17.312916,-352.004939],[191.663,189,-387.866212],[411.09077,186.041049,-682.770778],[850.339283,358.603912,-1273.108052],[1209.991378,472.002365,-1756.470047]],"desktop walk":[[182.93025,17.312916,-332.309448],[220.631505,184.800034,-384.539215],[424.938105,186.041049,-667.577175],[856.863777,358.603912,-1265.949233],[1210.520007,472.002365,-1755.890025]],"desktop lights":[[182.93025,17.312916,-332.309448],[220.631505,184.800034,-384.539215],[424.938105,186.041049,-667.577175],[856.863777,358.603912,-1265.949233],[1210.520007,472.002365,-1755.890025]],"desktop legal":[[182.93025,17.312916,-332.309448],[220.631505,184.800034,-384.539215],[424.938105,186.041049,-667.577175],[856.863777,358.603912,-1265.949233],[1210.520007,472.002365,-1755.890025]],"desktop mile":[[296.615615,17.312916,-734.945114],[352.533035,81.955513,-797.906676],[512.637891,186.041049,-978.180584],[898.185571,358.603912,-1412.297253],[1213.867985,472.002365,-1767.747448]]}; // pull-back positions at 100, 300, 500, 800 and 1100 ms, worked out once with origin/main's director.js
  it('the shot the game draws for a full drive (no push) matches frozen positions from main, all five cards, phone and desktop', () => {
    for (const [name, aspect] of [['phone', 390 / 844], ['desktop', 1280 / 720]]) for (const card of story.cards) {
      const track = driveTrack(routeFrames(world, cm, card.route), tripEvents(world, card.rewards, card.route), { walls });
      const chaseAt = (t) => ({ ...chaseCamera(stateAt(track, t), chaseForAspect(aspect)), fov: 55 });
      const line = (t) => { const s = chaseAt(t); return { pos: s.pos, target: [s.target[0], ROAD_Y, s.target[2]] }; };
      const from = { ...chaseAt(track.total), pos: clipEased(line, track.total, world, cm, clip).pos };
      [100, 300, 500, 800, 1100].forEach((t, i) => shotAt('pullback', t, mapShot, from, { roof }).pos.forEach((v, k) => expect(v, name + ' ' + card.id + ' at ' + t + ' ms').toBeCloseTo(frozen[name + ' ' + card.id][i][k], 5)));
    }
  });
  it('scene.js only passes push to the pull-back of a drive cut short', () => {
    const src = readFileSync(new URL('../games/city/scene.js', import.meta.url), 'utf8');
    expect(src).toContain("phase === 'pullback' && play.driveMs < play.track.total ? { push:");
  });
});
