import { describe, it, expect } from 'vitest';
import { skyColours, fogFor, windowPattern, heatOpacity } from '../games/city/sky.js';

describe('skyColours', () => {
  it('gives a different gradient for dark and light', () => {
    const d = skyColours(true), l = skyColours(false);
    expect(d.top).not.toBe(l.top);
    expect(d.bottom).not.toBe(l.bottom);
  });
  it('dark is the dusk blue to warm glow of the mockup', () => {
    expect(skyColours(true)).toMatchObject({ top: '#3D5A80', bottom: '#E9A86B' });
  });
});

describe('fogFor', () => {
  it('is tighter in the chase than on the map, and tighter again on a phone', () => {
    const map = fogFor('map', 1000, false), chase = fogFor('chase', 1000, false), phone = fogFor('chase', 1000, true);
    expect(chase.far).toBeLessThan(map.far);
    expect(phone.far).toBeLessThan(chase.far);
    for (const f of [map, chase, phone]) expect(f.near).toBeLessThan(f.far);
  });
  it('treats swoop and pullback as the chase fog', () => {
    expect(fogFor('swoop', 1000, false)).toEqual(fogFor('chase', 1000, false));
  });
});

describe('windowPattern', () => {
  const lit = (g) => g.flat().filter(Boolean).length / g.flat().length;
  it('is deterministic for a key and the right size', () => {
    const a = windowPattern('loop', 8, 16), b = windowPattern('loop', 8, 16);
    expect(a).toEqual(b);
    expect(a).toHaveLength(16);
    expect(a[0]).toHaveLength(8);
  });
  it('lights between 20% and 60% of windows', () => {
    for (const k of ['a', 'b', 'loop', 'tower-7', '12345']) {
      const f = lit(windowPattern(k, 8, 16));
      expect(f).toBeGreaterThanOrEqual(0.2);
      expect(f).toBeLessThanOrEqual(0.6);
    }
  });
  it('differs across keys', () => {
    expect(windowPattern('a', 8, 16)).not.toEqual(windowPattern('b', 8, 16));
  });
});

describe('heatOpacity', () => {
  it('is full on the map and gone in the chase, fading through swoop and pullback', () => {
    expect(heatOpacity('map', 0)).toBe(1);
    expect(heatOpacity('chase', 0)).toBe(0);
    const s = heatOpacity('swoop', 700), p = heatOpacity('pullback', 600);
    expect(s).toBeGreaterThan(0); expect(s).toBeLessThan(1);
    expect(p).toBeGreaterThan(0); expect(p).toBeLessThan(1);
    expect(heatOpacity('swoop', 0)).toBe(1);
    expect(heatOpacity('pullback', 5000)).toBe(1);
  });
});
