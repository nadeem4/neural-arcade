import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { taxiParts, TAXI_YELLOW, wheelAngle, steerAngle, WHEEL_RADIUS, WHEELBASE } from '../games/city/taxi-model.js';

const parts = taxiParts();
const bounds = () => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p.pos[k] - p.size[k] / 2); hi[k] = Math.max(hi[k], p.pos[k] + p.size[k] / 2); }
  return { lo, hi };
};
describe('taxiParts', () => {
  it('has two brake lamps at the back and two head lamps at the front, one each side', () => {
    for (const [role, sign] of [['brake', -1], ['head', 1]]) {
      const lamps = parts.filter((p) => p.role === role);
      expect(lamps).toHaveLength(2);
      expect(lamps[0].pos[0]).toBeLessThan(0);
      expect(lamps[1].pos[0]).toBeGreaterThan(0);
      for (const l of lamps) expect(Math.sign(l.pos[2])).toBe(sign); // forward is +z
    }
  });
  it('has a rounded body, glass cabin, roof, sign and four wheels, every size positive', () => {
    const count = (role) => parts.filter((p) => p.role === role).length;
    expect([count('body'), count('glass'), count('cab'), count('sign'), count('wheel')]).toEqual([1, 1, 1, 1, 4]);
    for (const p of parts) { expect(p.size).toHaveLength(3); for (const s of p.size) expect(s).toBeGreaterThan(0); }
  });
  it('body and glass are extruded side profiles (not boxes) with a few points each', () => {
    for (const [role, min] of [['body', 8], ['glass', 4]]) {
      const p = parts.find((q) => q.role === role);
      expect(p.kind).toBe('extrude');
      expect(p.profile.length).toBeGreaterThanOrEqual(min);
      for (const [z, y] of p.profile) { expect(Math.abs(z)).toBeLessThanOrEqual(p.size[2] / 2 + 0.2); expect(y).toBeGreaterThanOrEqual(0); }
    }
  });
  it('is about 1.9 m wide, 1.5 m tall and 4.2 m long', () => {
    const { lo, hi } = bounds();
    expect(hi[0] - lo[0]).toBeCloseTo(1.9, 0);
    expect(hi[1] - lo[1]).toBeCloseTo(1.5, 0);
    expect(hi[2] - lo[2]).toBeCloseTo(4.2, 0);
    expect(lo[1]).toBeGreaterThanOrEqual(0);
  });
  it('wheels are cylinders resting on the ground, two at the front and two a wheelbase behind', () => {
    const wheels = parts.filter((p) => p.role === 'wheel');
    for (const w of wheels) {
      expect(w.kind).toBe('wheel');
      expect(w.pos[1] - WHEEL_RADIUS).toBeCloseTo(0, 6); // touches y = 0
    }
    expect(wheels.filter((w) => w.front)).toHaveLength(2);
    expect(Math.abs(wheels.find((w) => w.front).pos[2] - wheels.find((w) => !w.front).pos[2])).toBeCloseTo(WHEELBASE, 6);
  });
  it('the brake and head lamps are real blocks, not thin lines', () => {
    for (const p of parts.filter((q) => q.role === 'brake' || q.role === 'head')) {
      expect(p.size[0]).toBeGreaterThanOrEqual(0.3);
      expect(p.size[1]).toBeGreaterThanOrEqual(0.18);
      expect(p.size[2]).toBeGreaterThanOrEqual(0.1);
    }
  });
  it('the tyres stand out past the body sides, each in a dark arch, so they show from the chase camera', () => {
    const body = parts.find((p) => p.role === 'body');
    const arches = parts.filter((p) => p.role === 'arch');
    expect(arches).toHaveLength(4);
    for (const w of parts.filter((p) => p.role === 'wheel')) {
      expect(Math.abs(w.pos[0]) + w.size[0] / 2).toBeGreaterThan(body.size[0] / 2 + 0.05);
      expect(arches.some((a) => Math.sign(a.pos[0]) === Math.sign(w.pos[0]) && Math.abs(a.pos[2] - w.pos[2]) < 0.01)).toBe(true);
    }
  });
  it('keeps the part count modest', () => {
    expect(parts.length).toBeLessThanOrEqual(20);
  });
  it('is taxi yellow with a dark roof sign', () => {
    expect(TAXI_YELLOW).toBe('#F5B820');
    expect(parts.some((p) => p.colour.toUpperCase() === TAXI_YELLOW)).toBe(true);
    expect(parts.find((p) => p.role === 'sign').colour.toUpperCase()).not.toBe(TAXI_YELLOW);
  });
});

describe('wheelAngle', () => {
  it('is zero at rest and turns one full revolution per wheel circumference', () => {
    expect(wheelAngle(0)).toBe(0);
    expect(wheelAngle(2 * Math.PI * WHEEL_RADIUS)).toBeCloseTo(2 * Math.PI, 9);
  });
  it('grows with distance', () => {
    expect(wheelAngle(5)).toBeGreaterThan(wheelAngle(2));
  });
});

describe('steerAngle', () => {
  it('is zero on a straight and when there is no number', () => {
    expect(steerAngle(0)).toBe(0);
    expect(steerAngle(NaN)).toBe(0);
  });
  it('follows the sign of the curvature and is capped', () => {
    expect(steerAngle(0.1)).toBeGreaterThan(0);
    expect(steerAngle(-0.1)).toBeLessThan(0);
    expect(steerAngle(0.1)).toBeCloseTo(-steerAngle(-0.1), 9);
    expect(Math.abs(steerAngle(10))).toBeLessThanOrEqual(0.6 + 1e-9);
  });
  it('matches the bicycle model: tan(steer) = wheelbase * curvature', () => {
    expect(Math.tan(steerAngle(0.1))).toBeCloseTo(WHEELBASE * 0.1, 9);
  });
});

describe('record-mode determinism', () => {
  it('the taxi, drive, camera clip and tag modules never read the clock or a random number', () => {
    for (const f of ['taxi-model.js', 'scene-taxi.js', 'drive.js', 'scene-math.js', 'events.js']) {
      expect(readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8'), f).not.toMatch(/Math\.random|Date\.now|performance\.now/);
    }
  });
});

describe('heights come from the one road height', () => {
  const src = (f) => readFileSync(new URL('../games/city/' + f, import.meta.url), 'utf8');
  it('the tyres rest on the road, and the shadow sits above the lane marks', async () => {
    const { ROAD_Y, MARK_Y } = await import('../games/city/scene-math.js');
    const { TAXI_Y, SHADOW_Y } = await import('../games/city/scene-taxi.js');
    expect(TAXI_Y).toBe(ROAD_Y);
    expect(MARK_Y).toBeGreaterThan(ROAD_Y);
    expect(SHADOW_Y).toBeGreaterThan(MARK_Y);
  });
});

describe('the contact shadow is made once per maker', () => {
  it('builds its texture and material in the cache and frees the texture on dispose', () => {
    const s = readFileSync(new URL('../games/city/scene-taxi.js', import.meta.url), 'utf8');
    expect(s.match(/new THREE\.CanvasTexture/g)).toHaveLength(1);
    expect(s).toMatch(/cache\.shadow \?\?= shadowMaterial\(\)/);
    expect(s).toMatch(/m\.map\?\.dispose\(\)/);
  });
});

describe('the street surfaces use the same heights', () => {
  it('street-model road and mark heights are ROAD_Y and MARK_Y, and the shadow clears the crossings', async () => {
    const { ROAD_Y, MARK_Y } = await import('../games/city/scene-math.js');
    const { Y_ROAD, Y_MARK, Y_CROSS } = await import('../games/city/street-model.js');
    const { SHADOW_Y } = await import('../games/city/scene-taxi.js');
    expect([Y_ROAD, Y_MARK]).toEqual([ROAD_Y, MARK_Y]);
    expect(SHADOW_Y).toBeGreaterThan(Y_CROSS);
  });
});
