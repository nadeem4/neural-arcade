import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld } from '../games/city/sim.js';
import { tripEvents } from '../games/city/events.js';
import { routeFrames, chaseCamera } from '../games/city/playback.js';
import { driveTrack, stateAt } from '../games/city/drive.js';
import { clipCamera, clipEased, liftPath, cellHeights, pinFade, insetOffset, fitDistance, heatQuad, HEAT_INSET, CHASE, MIN_CAM_DIST, ROAD_Y, chaseForAspect } from '../games/city/scene-math.js';
import { shotAt, SWOOP_MS, PULLBACK_MS } from '../games/city/director.js';
import { cityBounds } from '../games/city/geometry.js';

// A tiny world: 8 columns x 5 rows, 10 m cells. Row 0 is the north edge, z = -(rows - 1 - r + 0.5) * cellM.
// Row 2 is a road; rows 0-1 are buildings from column 3 on; everything else is road.
const cellM = 10, cols = 8, rows = 5;
const kind = new Uint8Array(cols * rows); // 0 = road
for (let r = 0; r < 2; r++) for (let c = 3; c < cols; c++) kind[r * cols + c] = 3;
const world = { cols, rows, kind };
const zOfRow = (r) => -(rows - 1 - r + 0.5) * cellM;
const cellOf = (w, x, z, cm) => [Math.floor(x / cm), w.rows - 1 - Math.floor(-z / cm)];
const solidAt = (w, cm, x, z) => {
  const [c, r] = cellOf(w, x, z, cm);
  return c >= 0 && c < w.cols && r >= 0 && r < w.rows && w.kind[r * w.cols + c] === 3;
};
const heightOfCell = (w, cm, x, z) => { const [c, r] = cellOf(w, x, z, cm); return w.height ? w.height[r * w.cols + c] || 12 : 40; };
const blocked = (w, cm, a, b) => { // the segment a -> b (x, y, z) passes through a building below its roof
  for (let i = 0; i <= 200; i++) {
    const x = a[0] + (b[0] - a[0]) * i / 200, z = a[2] + (b[2] - a[2]) * i / 200, y = a[1] + (b[1] - a[1]) * i / 200;
    const deep = [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]].every(([ox, oz]) => solidAt(w, cm, x + ox, z + oz)); // a graze of a cell corner is not "inside"
    if (deep && y < heightOfCell(w, cm, x, z)) return true;
  }
  return false;
};

describe('clipCamera', () => {
  it('leaves an open street alone', () => {
    const target = [10, 1, zOfRow(3)], cam = [10, 8, zOfRow(4)];
    const out = clipCamera(cam, target, world, cellM, 2);
    expect(out.pos).toEqual(cam);
    expect(out.clipped).toBe(false);
  });
  it('pulls the camera in front of a building wall that sits between it and the taxi', () => {
    const target = [45, 1, zOfRow(2)];        // on the road (row 2), column 4
    const cam = [45, 8, zOfRow(0)];           // up in the building block to the north
    expect(blocked(world, cellM, cam, target)).toBe(true);
    const out = clipCamera(cam, target, world, cellM, 2);
    expect(out.clipped).toBe(true);
    expect(blocked(world, cellM, out.pos, target)).toBe(false);
    expect(solidAt(world, cellM, out.pos[0], out.pos[2])).toBe(false);
    expect(Math.hypot(out.pos[0] - target[0], out.pos[2] - target[2])).toBeGreaterThanOrEqual(0);
  });
  it('never brings the camera closer to the taxi than the minimum distance, and keeps it above the ground', () => {
    const target = [45, 1, zOfRow(2) - 0.1], cam = [45, 8, zOfRow(1)];
    const out = clipCamera(cam, target, world, cellM, 2);
    const d = Math.hypot(out.pos[0] - target[0], out.pos[1] - target[1], out.pos[2] - target[2]);
    expect(d).toBeGreaterThanOrEqual(MIN_CAM_DIST - 1e-9);
    const low = clipCamera([10, -3, zOfRow(4)], [10, 1, zOfRow(3)], world, cellM, 2);
    expect(low.pos[1]).toBeGreaterThanOrEqual(1);
  });
  it('leaves a high camera alone: the swoop sails over the roofs', () => {
    const out = clipCamera([45, 200, zOfRow(0)], [45, 1, zOfRow(2)], world, cellM, 2);
    expect(out.clipped).toBe(false);
    expect(out.pos).toEqual([45, 200, zOfRow(0)]);
  });
  it('does not skim a roof: a camera a metre above a roof is pulled in', () => {
    const w = { ...world, height: new Float32Array(cols * rows).fill(30) };
    const out = clipCamera([45, 31, zOfRow(0)], [45, 1, zOfRow(2)], w, cellM, 2);
    expect(out.clipped).toBe(true);
  });
  it('uses the real building height: a camera above a low building is left alone, one below a tall roof is pulled in', () => {
    const low = { ...world, height: new Float32Array(cols * rows).fill(2) }, tall = { ...world, height: new Float32Array(cols * rows).fill(60) };
    const cam = [45, 30, zOfRow(0)], target = [45, 1, zOfRow(2)];
    expect(clipCamera(cam, target, low, cellM, 2).clipped).toBe(false); // the line clears a 2 m roof
    expect(clipCamera(cam, target, tall, cellM, 2).clipped).toBe(true); // but not a 60 m one
  });
  it('is pure: the same inputs give the same camera, and the inputs are not changed', () => {
    const target = [45, 1, zOfRow(2)], cam = [45, 8, zOfRow(0)];
    const a = clipCamera(cam, target, world, cellM, 2);
    expect(clipCamera(cam, target, world, cellM, 2)).toEqual(a);
    expect(cam).toEqual([45, 8, zOfRow(0)]);
  });
});

describe('clipEased', () => {
  const at = (ms) => ({ pos: [45, 8, zOfRow(4) - ms * 0.02 + 0], target: [45, 1, zOfRow(4)] }); // never near a wall
  const walk = (ms) => ({ pos: [45, 8, -23 - ms * 0.01], target: [45, 1, -5 - ms * 0.01] }); // drives north along row 2, camera behind it: the north wall of row 1 is reached at about 700 ms
  it('leaves an open street alone', () => {
    const out = clipEased(at, 0, world, cellM);
    expect(out.clipped).toBe(false);
    expect(out.pos[1]).toBe(8);
  });
  it('starts pulling in before the wall is reached and never jumps between nearby frames', () => {
    const plain = (ms) => clipCamera(walk(ms).pos, walk(ms).target, world, cellM, 2).pos;
    let first = -1;
    for (let ms = 0; ms < 2000; ms += 50) if (clipCamera(walk(ms).pos, walk(ms).target, world, cellM, 2).clipped) { first = ms; break; }
    expect(first).toBeGreaterThan(500); // the plain clip only starts here
    expect(clipEased(walk, first - 400, world, cellM).clipped).toBe(true); // the eased one has already started
    expect(plain(0)).toEqual(walk(0).pos);
    let prev = clipEased(walk, 0, world, cellM).pos, worst = 0;
    for (let ms = 10; ms < 2000; ms += 10) {
      const p = clipEased(walk, ms, world, cellM).pos;
      worst = Math.max(worst, Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]));
      prev = p;
    }
    expect(worst).toBeLessThan(1);
  });
  it('is pure in ms', () => {
    expect(clipEased(walk, 1234, world, cellM)).toEqual(clipEased(walk, 1234, world, cellM));
  });
});

describe('cellHeights', () => {
  it('gives each cell the tallest building over its centre, 0 elsewhere', () => {
    const c = { cols: 4, rows: 3, cellM: 10, buildings: [{ ring: [[1, 1], [19, 1], [19, 19], [1, 19]], h: 30 }, { ring: [[11, 1], [19, 1], [19, 9], [11, 9]], h: 50 }, { ring: [[31, 21], [39, 21], [39, 29], [31, 29]] }] };
    const h = cellHeights(c);
    // row 2 is the south edge: y 0-10; row 0: y 20-30
    expect(h[2 * 4 + 0]).toBe(30); expect(h[2 * 4 + 1]).toBe(50); expect(h[1 * 4 + 0]).toBe(30); expect(h[1 * 4 + 1]).toBe(30);
    expect(h[0 * 4 + 3]).toBe(12); // no height in the map: 12 m
    expect(h[0]).toBe(0);
  });
});

describe('ROAD_Y', () => {
  it('is the one road height: 0.8 m', () => { expect(ROAD_Y).toBe(0.8); });
});

describe('pinFade', () => {
  it('is 0 right next to the lens, 1 far away, and grows with distance', () => {
    expect(pinFade([0, 8, 0], [5, 1, 5])).toBe(0);
    expect(pinFade([0, 8, 0], [500, 1, 0])).toBe(1);
    expect(pinFade([0, 8, 0], [35, 1, 0])).toBeGreaterThan(pinFade([0, 8, 0], [25, 1, 0]));
  });
});

describe('heatQuad', () => {
  it('is a flat square a little smaller than its cell, so neighbouring cells share no edge', () => {
    const a = heatQuad(6, 6, 6), b = heatQuad(18, 6, 6);
    const xs = (q) => [q[0], q[3], q[6], q[9]];
    expect(Math.max(...xs(a))).toBeCloseTo(12 - HEAT_INSET, 6);
    expect(Math.min(...xs(b))).toBeGreaterThan(Math.max(...xs(a)));
    for (const k of [1, 4, 7, 10]) expect(a[k]).toBe(1.2);
    expect(HEAT_INSET).toBeLessThan(0.5);
  });
});

describe('fitDistance', () => {
  it('keeps the start distance when it already fits', () => {
    expect(fitDistance(100, 500, () => true)).toBe(100);
  });
  it('zooms out in steps until it fits, and stops at the limit when it never does', () => {
    const d = fitDistance(100, 500, (x) => x >= 150);
    expect(d).toBeGreaterThanOrEqual(150);
    expect(d).toBeLessThan(150 * 1.1 + 1e-9);
    expect(fitDistance(100, 500, () => false)).toBe(500);
  });
});

describe('insetOffset', () => {
  it('shifts the picture up by half the sheet, so the map centre moves to the middle of what the sheet leaves visible', () => {
    expect(insetOffset(844, 300)).toBe(150);
    expect(insetOffset(844, 0)).toBe(0);
  });
  it('never shifts for a negative sheet, and caps a huge sheet at 40% of the view height', () => {
    expect(insetOffset(800, -20)).toBe(0);
    expect(insetOffset(800, 700)).toBe(160);
  });
  it('with the top buttons reserved, the map centre sits halfway between their bottom edge and the sheet', () => {
    // 844 tall, sheet 300, buttons to 116: free area 116..544, centre 330; the stage centre 422 moves up by 92
    expect(insetOffset(844, 300, 116)).toBe(92);
    expect(844 / 2 - insetOffset(844, 300, 116)).toBe((116 + (844 - 300)) / 2);
    expect(insetOffset(844, 300, 0)).toBe(150);
  });
});

// The real map and the five preset routes: walk the chase camera through clipCamera at every 100 ms.
const read = (f) => JSON.parse(readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8'));
const city = read('chicago.json');
const realWorld = { ...loadWorld(city), height: cellHeights(city) };
const story = read('story.json');

describe('the chase camera on the real map, all five cards', () => {
  for (const card of story.cards) {
    it(`never ends up in a building on the ${card.id} card`, () => {
      const frames = routeFrames(realWorld, city.cellM, card.route);
      const track = driveTrack(frames, tripEvents(realWorld, card.rewards, card.route));
      for (let ms = 0; ms <= track.total; ms += 100) {
        const st = stateAt(track, ms);
        const at = (t) => { const q = stateAt(track, t); return { pos: chaseCamera(q, CHASE).pos, target: [q.x, ROAD_Y, q.z] }; };
        const out = clipEased(at, ms, realWorld, city.cellM, { margin: 2, minY: ROAD_Y + 2.7 });
        expect(blocked(realWorld, city.cellM, out.pos, [st.x, ROAD_Y, st.z])).toBe(false);
        expect(blocked(realWorld, city.cellM, [out.pos[0], out.pos[1], out.pos[2]], [out.pos[0], out.pos[1], out.pos[2]])).toBe(false); // the camera itself is not inside a roof
        expect(out.pos[1]).toBeGreaterThan(ROAD_Y + 2);
      }
    });
  }
});

describe('the pickup pin at the start of a drive', () => {
  it('is faded out at the chase start, so it cannot fill the lens', () => {
    const card = story.cards[0];
    const frames = routeFrames(realWorld, city.cellM, card.route);
    const track = driveTrack(frames, tripEvents(realWorld, card.rewards, card.route));
    const st = stateAt(track, 0);
    const cam = chaseCamera(st, CHASE);
    expect(pinFade(cam.pos, [st.x, 1, st.z])).toBe(0);
  });
});

// The swoop in and the pullback out, on the real map, every card, a phone and a desktop aspect and several map views, frame by frame at 60 fps.
// The camera is built as scene.js builds it: the director's path from the clipped chase pose at the chase boundary to the map shot, lifted over the roofs.
describe('the camera through the swoop and the pullback', () => {
  const { cx, cz, radius } = cityBounds(city);
  const clip = { margin: 2, minY: ROAD_Y + 2.7 };
  const cm = city.cellM, CLEAR = 6;
  const roofAt = (p) => { // the roof plus the clearance a camera keeps over it, for the cell the camera stands in (0 off the buildings)
    const c = Math.floor(p[0] / cm), r = realWorld.rows - 1 - Math.floor(-p[2] / cm);
    if (c < 0 || c >= realWorld.cols || r < 0 || r >= realWorld.rows || realWorld.kind[r * realWorld.cols + c] !== 3) return 0;
    return (realWorld.height[r * realWorld.cols + c] || 12) + CLEAR;
  };
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const views = [[0.6, 0.95], [0, 0.6], [1.6, 0.35], [2.6, 0.95], [3.6, 0.6], [4.6, 0.35], [5.6, 0.95]];
  const mapShotOf = ([yaw, pitch]) => { const cp = Math.cos(pitch), r = radius * 1.25; return { pos: [cx + Math.sin(yaw) * cp * r, Math.sin(pitch) * r, cz + Math.cos(yaw) * cp * r], target: [cx, 0, cz], fov: 38 }; };
  const rig = (card, aspect, mapShot) => {
    const track = driveTrack(routeFrames(realWorld, cm, card.route), tripEvents(realWorld, card.rewards, card.route));
    const chaseAt = (t) => ({ ...chaseCamera(stateAt(track, t), chaseForAspect(aspect)), fov: 55 });
    const line = (t) => { const s = chaseAt(t); return { pos: s.pos, target: [s.target[0], ROAD_Y, s.target[2]] }; };
    const chaseCam = (t) => clipEased(line, t, realWorld, cm, clip).pos; // the chase phase, as on main
    const cam = (phase, t) => { // the swoop or pullback camera at t ms into the phase
      const bt = phase === 'swoop' ? 0 : track.total, ch = { ...chaseAt(bt), pos: chaseCam(bt) };
      return liftPath((s) => shotAt(phase, s, mapShot, ch).pos, t, phase === 'swoop' ? SWOOP_MS : PULLBACK_MS, realWorld, cm);
    };
    return { track, chaseCam, cam };
  };
  for (const aspect of [390 / 844, 1280 / 720]) {
    for (const card of story.cards) {
      it(`stays out of buildings with no jump on the ${card.id} card at aspect ${aspect.toFixed(2)}`, () => {
        for (const view of views) {
          const mapShot = mapShotOf(view);
          const { track, chaseCam, cam } = rig(card, aspect, mapShot);
          for (const [phase, ms] of [['swoop', SWOOP_MS], ['pullback', PULLBACK_MS]]) {
            let prev = null, worst = 0;
            for (let t = 0; t <= ms + 1e-9; t += 1000 / 60) {
              const p = cam(phase, t);
              expect(p[1], `${phase} ${Math.round(t)} ms, view ${view}: inside a building`).toBeGreaterThanOrEqual(roofAt(p) - 1e-6);
              if (prev) worst = Math.max(worst, d(p, prev));
              prev = p;
            }
            expect(worst, `${phase} worst per-frame move, view ${view}`).toBeLessThan(60); // the unclipped path moves about 35 m a frame at its fastest
          }
          const end = track.total, frame = 1000 / 60;
          expect(d(cam('pullback', 0), chaseCam(end)), 'chase to pullback').toBeLessThanOrEqual(d(chaseCam(end), chaseCam(end - frame)) + 1e-6);
          expect(d(cam('swoop', SWOOP_MS), chaseCam(0)), 'swoop to chase').toBeLessThanOrEqual(d(chaseCam(frame), chaseCam(0)) + 1e-6);
          expect(cam('pullback', PULLBACK_MS)).toEqual(mapShot.pos); // the pullback ends on the map shot, over the city
          expect(cam('swoop', 0)).toEqual(mapShot.pos);
        }
      });
    }
  }
  it('is a function of the trip time only: frames worked out in any order are the same', () => {
    const { cam } = rig(story.cards.find((c) => c.id === 'walk') ?? story.cards[0], 390 / 844, mapShotOf([0.6, 0.95]));
    const ts = [0, 50, 217, 233, 250, 600, 1199];
    const fwd = ts.map((t) => cam('pullback', t)), back = [...ts].reverse().map((t) => cam('pullback', t)).reverse();
    expect(back).toEqual(fwd);
  });
});

describe('liftPath', () => {
  const tall = { ...world, height: new Float32Array(cols * rows).fill(40) }; // rows 0-1 from column 3: 40 m buildings
  const path = (ms) => [45, 10, zOfRow(4) - ms * 0.05]; // flies north at 10 m into the block: the wall of row 1 at 500 ms, row 0 from 700 ms
  it('leaves a path in open air alone', () => {
    expect(liftPath((ms) => [10, 10, zOfRow(4) - ms * 0.01], 300, 1000, tall, cellM)).toEqual([10, 10, zOfRow(4) - 3]);
  });
  it('lifts a point over a building to its roof plus the clearance, and climbs there before it reaches the wall', () => {
    const over = liftPath(path, 800, 1000, tall, cellM); // over row 0
    expect(over[1]).toBeGreaterThanOrEqual(46);
    expect(over[0]).toBe(45); expect(over[2]).toBe(path(800)[2]); // straight up: the path is not bent sideways
    const before = liftPath(path, 480, 1000, tall, cellM); // still over the road of row 2, a metre from the wall (reached at 500 ms)
    expect(before[1]).toBeGreaterThan(10);
  });
  it('climbs at most about a metre a millisecond (no pop at the wall), and is pure in ms', () => {
    const frame = 1000 / 60;
    let prev = liftPath(path, 0, 1000, tall, cellM), worst = 0;
    for (let ms = frame; ms <= 1000; ms += frame) { const p = liftPath(path, ms, 1000, tall, cellM); worst = Math.max(worst, Math.abs(p[1] - prev[1])); prev = p; }
    expect(worst).toBeLessThan(25); // a 36 m climb in one frame would be a pop
    expect(liftPath(path, 777, 1000, tall, cellM)).toEqual(liftPath(path, 777, 1000, tall, cellM));
  });
});
