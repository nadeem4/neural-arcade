import { describe, it, expect } from 'vitest';
import { skyColours, sunDirection, sunUv, cloudLayout, fogFor, heatOpacity } from '../games/city/sky.js';

describe('skyColours', () => {
  it('is one fixed late-afternoon palette, whatever the page theme', () => {
    expect(skyColours()).toEqual(skyColours());
    for (const k of ['top', 'bottom', 'sun', 'sunGlow']) expect(skyColours()[k]).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
  it('the bottom of the sky is the haze colour, so the horizon meets the fog with no peach band', () => {
    expect(skyColours().bottom).toBe(skyColours().haze);
  });
});

describe('neutral daylight (no orange cast)', () => {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  it('the sun is warm white, not orange', () => {
    const [r, g, b] = rgb(skyColours().sun);
    expect(r).toBeGreaterThanOrEqual(0xF0);
    expect(g).toBeGreaterThanOrEqual(0xDC);
    expect(r - b).toBeLessThanOrEqual(0x30);
  });
  it('the sky is a clear blue overhead and a lighter blue between, fading to the haze at the horizon', () => {
    const { top, mid, bottom } = skyColours();
    const [tr, , tb] = rgb(top), [mr, , mb] = rgb(mid), [br, , bb] = rgb(bottom);
    expect(tb - tr).toBeGreaterThan(60);
    expect(mb - mr).toBeGreaterThan(20);
    expect(bb).toBeGreaterThanOrEqual(br); // light blue at the horizon, not warm
  });
  it('the haze (fog and lower dome) is a light blue and the sky fill from above is near neutral, so shade is not blue', () => {
    const [r, , b] = rgb(skyColours().haze);
    expect(b - r).toBeGreaterThan(10);
    expect(Math.min(r, b)).toBeGreaterThan(0xB0);
    const [hr, , hb] = rgb(skyColours().hemiSky);
    expect(hb - hr).toBeLessThanOrEqual(0x14);
  });
  it('the fill from below is neutral grey, so shaded faces keep detail without a tint', () => {
    const [r, g, b] = rgb(skyColours().hemiGround);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(0x14);
    expect(Math.min(r, g, b)).toBeGreaterThan(0x60);
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
