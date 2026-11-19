import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld } from '../games/city/sim.js';
import { tripEvents } from '../games/city/events.js';
import { routeFrames, chaseCamera } from '../games/city/playback.js';
import { driveTrack, stateAt } from '../games/city/drive.js';
import { clipCamera, clipEased, roofAt, wallPush, cellHeights, pinFade, insetOffset, fitDistance, heatQuad, HEAT_INSET, CHASE, MIN_CAM_DIST, ROAD_Y, chaseForAspect } from '../games/city/scene-math.js';
import { shotAt, raceShot, SWOOP_MS, PULLBACK_MS } from '../games/city/director.js';
import { raceTracks, raceStateAt } from '../games/city/race.js';
import { solidRings } from '../games/city/walls.js';
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

// The swoop in and the pullback out, on the real map, frame by frame at 60 fps, built as scene.js builds them: the director's crane from the
// clipped chase pose at the chase boundary to the map shot, held over the roofs. Every card at a phone and a desktop aspect, the drive cut short
// (footage maxms) at four points, every race pair, and 45 map views (5 compass angles x 3 pitches x 3 zooms). Heavy (about 30 s in all), but well under the runner-presets file.
describe('the camera through the swoop and the pullback', () => {
  const { cx, cz, radius } = cityBounds(city);
  const clip = { margin: 2, minY: ROAD_Y + 2.7 };
  const cm = city.cellM, frame = 1000 / 60, walls = solidRings(city);
  const roof = (x, z) => roofAt(realWorld, cm, x, z);
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const dir = (s) => { const v = s.target.map((x, k) => x - s.pos[k]), l = Math.hypot(...v); return v.map((x) => x / l); };
  const turn = (a, b) => { const u = dir(a), v = dir(b); return (Math.acos(Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2])) * 180) / Math.PI; };
  const down = (s) => (Math.asin(-dir(s)[1]) * 180) / Math.PI; // degrees below the horizon
  const views = [];
  for (const yaw of [0, 0.6, 1.6, 3.1, 4.7]) for (const pitch of [0.3, 0.95, 1.4]) for (const zoom of [0.4, 1.25, 3]) views.push({ yaw, pitch, zoom });
  const mapShotOf = ({ yaw, pitch, zoom }) => { const cp = Math.cos(pitch), r = radius * zoom; return { pos: [cx + Math.sin(yaw) * cp * r, Math.sin(pitch) * r, cz + Math.cos(yaw) * cp * r], target: [cx, 0, cz], fov: 38 }; };
  const rig = (chaseAt, driveMs, mapShot) => {
    const line = (t) => { const s = chaseAt(t); return { pos: s.pos, target: [s.target[0], ROAD_Y, s.target[2]] }; };
    const chaseCam = (t) => ({ ...chaseAt(t), pos: clipEased(line, t, realWorld, cm, clip).pos }); // the chase phase, as on main
    const from = { swoop: chaseCam(0), pullback: chaseCam(driveMs) }; // the chase pose at each boundary, worked out once
    const cam = (phase, t) => shotAt(phase, t, mapShot, from[phase], { roof, push: (x, z, y) => wallPush(realWorld, cm, x, z, y) });
    return { from, cam };
  };
  // Every frame of both phases and the frames either side of both chase boundaries; returns the worst of each measure.
  const fly = (chaseAt, driveMs, view) => {
    const mapShot = mapShotOf(view), rigged = rig(chaseAt, driveMs, mapShot), { cam } = rigged, w = { inside: 0, move: 0, turn: 0, steep: 0, from: 0, ends: 0 };
    for (const [phase, ms] of [['swoop', SWOOP_MS], ['pullback', PULLBACK_MS]]) {
      const from = rigged.from[phase], bound = Math.max(60, (2.5 * d(from.pos, mapShot.pos)) / (ms / frame)); // 60 m, or 2.5 times the straight line's average speed
      let prev = null;
      for (let t = 0; t <= ms + 1e-9; t += frame) {
        const s = cam(phase, t);
        w.inside = Math.max(w.inside, roof(s.pos[0], s.pos[2]) - s.pos[1]);
        w.steep = Math.max(w.steep, down(s) - Math.max(80, (view.pitch * 180) / Math.PI));
        if (prev) { w.move = Math.max(w.move, d(s.pos, prev.pos) / bound); w.turn = Math.max(w.turn, turn(s, prev)); }
        prev = s;
      }
      const meet = cam(phase, phase === 'swoop' ? ms : 0), far = cam(phase, phase === 'swoop' ? 0 : ms);
      // The crane meets the chase pose exactly, so its first (or last) frame step above is the step across the boundary; the step on the
      // chase side is the chase's own motion, measured with the chase.
      w.from = Math.max(w.from, d(meet.pos, from.pos), d(meet.target, from.target));
      w.ends = Math.max(w.ends, d(far.pos, mapShot.pos), d(far.target, mapShot.target)); // and the map shot exactly
    }
    return w;
  };
  const worst = (ws) => ws.reduce((a, w) => Object.fromEntries(Object.keys(w).map((k) => [k, Math.max(a[k] ?? 0, w[k])])), {});
  const expectGood = (w, what) => {
    expect(w.inside, `${what}: metres inside a building`).toBeLessThanOrEqual(1e-6);
    expect(w.move, `${what}: worst per-frame move over its bound`).toBeLessThanOrEqual(1);
    expect(w.turn, `${what}: worst view turn in one frame (degrees)`).toBeLessThanOrEqual(15);
    expect(w.steep, `${what}: degrees steeper than 80 (or the map's own pitch)`).toBeLessThanOrEqual(1e-6);
    expect(w.from, `${what}: gap to the chase pose at the boundary`).toBeLessThanOrEqual(1e-6);
    expect(w.ends, `${what}: gap to the map shot at the far end`).toBeLessThanOrEqual(1e-6);
  };
  for (const aspect of [390 / 844, 1280 / 720]) {
    for (const card of story.cards) {
      it(`stays out of buildings, turns slowly and meets both ends on the ${card.id} card at aspect ${aspect.toFixed(2)}, full and cut short`, () => {
        const track = driveTrack(routeFrames(realWorld, cm, card.route), tripEvents(realWorld, card.rewards, card.route), { walls });
        const chaseAt = (t) => ({ ...chaseCamera(stateAt(track, t), chaseForAspect(aspect)), fov: 55 });
        expectGood(worst(views.map((v) => fly(chaseAt, track.total, v))), `${card.id}, the whole drive`);
        [0.2, 0.37, 0.61, 0.83].forEach((f, i) => { // each cut with a third of the views, in turn, so every view meets a cut
          const driveMs = Math.round(track.total * f);
          expectGood(worst(views.filter((_, j) => j % 3 === i % 3).map((v) => fly(chaseAt, driveMs, v))), `${card.id}, drive cut at ${driveMs} ms`);
        });
      }, 30000);
    }
  }
  it('stays out of buildings, turns slowly and meets both ends in every race', () => {
    for (let i = 0; i < story.cards.length; i++) for (let j = i + 1; j < story.cards.length; j++) {
      let race; try { race = raceTracks(realWorld, cm, [story.cards[i], story.cards[j]], walls); } catch { continue; } // only cards with the same pickup race
      const chaseAt = (t) => { const s = raceStateAt(race, t); return raceShot(s.cars[0].state, s.cars[1].state); };
      expectGood(worst(views.map((v) => fly(chaseAt, race.total, v))), `race ${story.cards[i].id} v ${story.cards[j].id}`);
    }
  }, 60000);
  it('is a function of the trip time only: frames worked out in any order are the same', () => {
    const card = story.cards.find((c) => c.id === 'walk') ?? story.cards[0];
    const track = driveTrack(routeFrames(realWorld, cm, card.route), tripEvents(realWorld, card.rewards, card.route), { walls });
    const { cam } = rig((t) => ({ ...chaseCamera(stateAt(track, t), chaseForAspect(390 / 844)), fov: 55 }), track.total, mapShotOf({ yaw: 0.6, pitch: 0.3, zoom: 0.4 }));
    const ts = [0, 50, 217, 233, 250, 600, 1199];
    const fwd = ts.map((t) => cam('pullback', t)), back = [...ts].reverse().map((t) => cam('pullback', t)).reverse();
    expect(back).toEqual(fwd);
  });
});

describe('roofAt', () => {
  const tall = { ...world, height: new Float32Array(cols * rows).fill(40) }; // rows 0-1 from column 3: 40 m buildings
  it('is the roof plus the 6 m a camera keeps over it, and 0 off the buildings', () => {
    expect(roofAt(tall, cellM, 45, zOfRow(0))).toBe(46);
    expect(roofAt(tall, cellM, 45, zOfRow(2))).toBe(0);
    expect(roofAt(tall, cellM, -5, zOfRow(0))).toBe(0); // off the map
  });
});
