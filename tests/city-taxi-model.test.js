import { describe, it, expect } from 'vitest';
import { taxiParts, TAXI_YELLOW } from '../games/city/taxi-model.js';

const parts = taxiParts();
describe('taxiParts', () => {
  it('has exactly two brake lights, one each side at the back', () => {
    const lights = parts.filter((p) => p.role === 'brake');
    expect(lights).toHaveLength(2);
    expect(lights[0].pos[0]).toBeLessThan(0);
    expect(lights[1].pos[0]).toBeGreaterThan(0);
    for (const l of lights) expect(l.pos[2]).toBeLessThan(0); // forward is +z
  });
  it('has a body, cab, a roof sign and four wheels, every size positive', () => {
    const count = (role) => parts.filter((p) => p.role === role).length;
    expect([count('body'), count('cab'), count('sign'), count('wheel')]).toEqual([1, 1, 1, 4]);
    for (const p of parts) { expect(p.size).toHaveLength(3); for (const s of p.size) expect(s).toBeGreaterThan(0); }
  });
  it('is about 1.9 m wide, 1.4 m tall and 4.2 m long', () => {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const p of parts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p.pos[k] - p.size[k] / 2); hi[k] = Math.max(hi[k], p.pos[k] + p.size[k] / 2); }
    expect(hi[0] - lo[0]).toBeCloseTo(1.9, 0);
    expect(hi[1] - lo[1]).toBeCloseTo(1.4, 0);
    expect(hi[2] - lo[2]).toBeCloseTo(4.2, 0);
    expect(lo[1]).toBeGreaterThanOrEqual(0);
  });
  it('is taxi yellow with a dark roof sign', () => {
    expect(TAXI_YELLOW).toBe('#F5B820');
    expect(parts.some((p) => p.colour.toUpperCase() === TAXI_YELLOW)).toBe(true);
    expect(parts.find((p) => p.role === 'sign').colour.toUpperCase()).not.toBe(TAXI_YELLOW);
  });
});
