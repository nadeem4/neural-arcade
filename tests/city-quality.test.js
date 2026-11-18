import { describe, it, expect } from 'vitest';
import { tierFor } from '../games/city/quality.js';

describe('tierFor', () => {
  const desk = tierFor({ phone: false, reducedMotion: false });
  const phone = tierFor({ phone: true, reducedMotion: false });
  it('phone tier is lighter on every field', () => {
    expect(phone.shadowSize).toBeLessThan(desk.shadowSize);
    expect(phone.pixelRatio).toBeLessThan(desk.pixelRatio);
    expect(phone.cloudCount).toBeLessThan(desk.cloudCount);
    expect(phone.facadeDetail).toBeLessThan(desk.facadeDetail);
    expect(desk.roofBoxes).toBe(true);
    expect(phone.roofBoxes).toBe(false);
  });
  it('both tiers have shadows, phones with the cheaper hard-edged filter', () => {
    expect(phone.shadowSize).toBeGreaterThan(0);
    expect(desk.softShadows).toBe(true);
    expect(phone.softShadows).toBe(false);
  });
  it('holds the plan values', () => {
    expect(desk).toEqual({ shadowSize: 2048, pixelRatio: 2, cloudCount: 6, facadeDetail: 2, roofBoxes: true, softShadows: true });
    expect(phone).toEqual({ shadowSize: 1024, pixelRatio: 1.5, cloudCount: 3, facadeDetail: 1, roofBoxes: false, softShadows: false });
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
  it('keeps exact colours (trails, signal lamps, brake lamps) out of tone mapping', async () => {
    const taxi = readFileSync(new URL('../games/city/scene-taxi.js', import.meta.url), 'utf8');
    for (const name of ['trail', 'trailB', 'lamp']) expect(scene).toMatch(new RegExp(String.raw`mats\.${name} = new THREE\.\w+Material\(\{[^}]*toneMapped: false`));
    expect(taxi.match(/MeshBasicMaterial\(\{[^}]*toneMapped: false/g)).toHaveLength(2);
  });
  it('gives the taxi and pins the city environment intensity', () => {
    const taxi = readFileSync(new URL('../games/city/scene-taxi.js', import.meta.url), 'utf8');
    expect(scene).toMatch(/mats\.pin = [^;]*envMapIntensity: ENV_INTENSITY/);
    expect(taxi).toMatch(/envMapIntensity: ENV_INTENSITY/);
  });
});
