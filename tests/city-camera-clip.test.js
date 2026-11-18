import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadWorld } from '../games/city/sim.js';
import { tripEvents } from '../games/city/events.js';
import { routeFrames, chaseCamera } from '../games/city/playback.js';
import { driveTrack, stateAt } from '../games/city/drive.js';
import { clipCamera, pinFade, CHASE, MIN_CAM_DIST } from '../games/city/scene-math.js';

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
const blocked = (w, cm, a, b) => { // any building cell on the segment a -> b (x, z)
  for (let i = 0; i <= 200; i++) if (solidAt(w, cm, a[0] + (b[0] - a[0]) * i / 200, a[2] + (b[2] - a[2]) * i / 200)) return true;
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
  it('is pure: the same inputs give the same camera, and the inputs are not changed', () => {
    const target = [45, 1, zOfRow(2)], cam = [45, 8, zOfRow(0)];
    const a = clipCamera(cam, target, world, cellM, 2);
    expect(clipCamera(cam, target, world, cellM, 2)).toEqual(a);
    expect(cam).toEqual([45, 8, zOfRow(0)]);
  });
});

describe('pinFade', () => {
  it('is 0 right next to the lens, 1 far away, and grows with distance', () => {
    expect(pinFade([0, 8, 0], [5, 1, 5])).toBe(0);
    expect(pinFade([0, 8, 0], [500, 1, 0])).toBe(1);
    expect(pinFade([0, 8, 0], [35, 1, 0])).toBeGreaterThan(pinFade([0, 8, 0], [25, 1, 0]));
  });
});

// The real map and the five preset routes: walk the chase camera through clipCamera at every 100 ms.
const read = (f) => JSON.parse(readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8'));
const city = read('chicago.json');
const realWorld = loadWorld(city);
const story = read('story.json');

describe('the chase camera on the real map, all five cards', () => {
  for (const card of story.cards) {
    it(`never ends up in a building on the ${card.id} card`, () => {
      const frames = routeFrames(realWorld, city.cellM, card.route);
      const track = driveTrack(frames, tripEvents(realWorld, card.rewards, card.route));
      for (let ms = 0; ms <= track.total; ms += 100) {
        const st = stateAt(track, ms);
        const cam = chaseCamera(st, CHASE);
        const out = clipCamera(cam.pos, [st.x, 1, st.z], realWorld, city.cellM, 2);
        expect(solidAt(realWorld, city.cellM, out.pos[0], out.pos[2])).toBe(false);
        expect(blocked(realWorld, city.cellM, out.pos, [st.x, 1, st.z])).toBe(false);
        expect(out.pos[1]).toBeGreaterThan(0.9);
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
