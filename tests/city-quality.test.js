import { describe, it, expect } from 'vitest';
import { tierFor } from '../games/city/quality.js';

describe('tierFor', () => {
  const desk = tierFor({ phone: false, reducedMotion: false });
  const phone = tierFor({ phone: true, reducedMotion: false });
  it('phone tier is lighter on every field', () => {
    expect(phone.shadowSize).toBeLessThan(desk.shadowSize);
    expect(phone.pixelRatio).toBeLessThan(desk.pixelRatio);
    expect(phone.cloudCount).toBeLessThan(desk.cloudCount);
    expect(phone.windowCell).toBeLessThan(desk.windowCell);
  });
  it('both tiers have shadows, phones with the cheaper hard-edged filter', () => {
    expect(phone.shadowSize).toBeGreaterThan(0);
    expect(desk.softShadows).toBe(true);
    expect(phone.softShadows).toBe(false);
  });
  it('holds the plan values', () => {
    expect(desk).toEqual({ shadowSize: 2048, pixelRatio: 2, cloudCount: 6, windowCell: 32, softShadows: true });
    expect(phone).toEqual({ shadowSize: 1024, pixelRatio: 1.5, cloudCount: 3, windowCell: 16, softShadows: false });
  });
  it('reduced motion never makes a tier heavier', () => {
    expect(tierFor({ phone: false, reducedMotion: true }).shadowSize).toBeLessThanOrEqual(desk.shadowSize);
  });
});

describe('scene wiring', async () => {
  const { readFileSync } = await import('node:fs');
  const scene = readFileSync(new URL('../games/city/scene.js', import.meta.url), 'utf8');
  it('reads its numbers from tierFor and sets filmic tone mapping', () => {
    expect(scene).toMatch(/tierFor\(/);
    expect(scene).toMatch(/ACESFilmicToneMapping/);
    expect(scene).toMatch(/outputColorSpace/);
  });
  it('does not recolour the sky from the page theme, and keeps the heat overlay untoned', () => {
    expect(scene).not.toMatch(/skyColours\(dark/);
    expect(scene).toMatch(/toneMapped: false/);
  });
});
