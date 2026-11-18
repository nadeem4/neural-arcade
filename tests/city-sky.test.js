import { describe, it, expect } from 'vitest';
import { skyColours, sunDirection, sunUv, cloudLayout, fogFor, windowPattern, heatOpacity } from '../games/city/sky.js';

describe('skyColours', () => {
  it('is one fixed late-afternoon palette, whatever the page theme', () => {
    expect(skyColours()).toEqual(skyColours());
    for (const k of ['top', 'bottom', 'sun', 'sunGlow']) expect(skyColours()[k]).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
  it('the horizon is warmer (redder) than the zenith', () => {
    const red = (h) => parseInt(h.slice(1, 3), 16), blue = (h) => parseInt(h.slice(5, 7), 16);
    const { top, bottom } = skyColours();
    expect(red(bottom) - blue(bottom)).toBeGreaterThan(red(top) - blue(top));
  });
});

describe('sunDirection', () => {
  it('is constant, unit length and above the horizon but low', () => {
    const d = sunDirection();
    expect(sunDirection()).toEqual(d);
    expect(Math.hypot(...d)).toBeCloseTo(1, 6);
    expect(d[1]).toBeGreaterThan(0.2);
    expect(d[1]).toBeLessThan(0.6);
  });
});

describe('sunUv', () => {
  it('puts the zenith at the top and the horizon halfway down', () => {
    expect(sunUv([0, 1, 0]).v).toBeCloseTo(0, 6);
    expect(sunUv([1, 0, 0]).v).toBeCloseTo(0.5, 6);
  });
  it('stays inside the sky half of the texture', () => {
    const { u, v } = sunUv(sunDirection());
    expect(u).toBeGreaterThanOrEqual(0); expect(u).toBeLessThan(1);
    expect(v).toBeGreaterThan(0); expect(v).toBeLessThan(0.5);
  });
});

describe('cloudLayout', () => {
  it('is deterministic and has the requested count', () => {
    expect(cloudLayout(6)).toEqual(cloudLayout(6));
    expect(cloudLayout(6)).toHaveLength(6);
    expect(cloudLayout(0)).toEqual([]);
  });
  it('keeps clouds above the horizon with a positive size', () => {
    for (const c of cloudLayout(6)) { expect(c.dir[1]).toBeGreaterThan(0.1); expect(Math.hypot(...c.dir)).toBeCloseTo(1, 6); expect(c.size).toBeGreaterThan(0); }
  });
});

describe('fogFor', () => {
  it('is tighter in the chase than on the map, and tighter again on a phone', () => {
    const map = fogFor(0, 1000, false), chase = fogFor(1, 1000, false), phone = fogFor(1, 1000, true);
    expect(chase.far).toBeLessThan(map.far);
    expect(phone.far).toBeLessThan(chase.far);
    for (const f of [map, chase, phone]) expect(f.near).toBeLessThan(f.far);
  });
  it('blends between map and chase fog', () => {
    const half = fogFor(0.5, 1000, false);
    expect(half.far).toBeGreaterThan(fogFor(1, 1000, false).far);
    expect(half.far).toBeLessThan(fogFor(0, 1000, false).far);
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
