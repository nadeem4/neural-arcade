import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const config = JSON.parse(
  readFileSync(new URL('../scripts/city/chicago.config.json', import.meta.url), 'utf8'),
);

describe('chicago.config.json', () => {
  it('has the required keys', () => {
    for (const k of ['id', 'name', 'bbox', 'cellM', 'pickup', 'dropoff', 'landmarks', 'lightPeriod']) {
      expect(config).toHaveProperty(k);
    }
    expect(typeof config.cellM).toBe('number');
    expect(typeof config.lightPeriod).toBe('number');
    expect(Array.isArray(config.landmarks)).toBe(true);
    for (const p of [config.pickup, config.dropoff]) {
      expect(typeof p.lat).toBe('number');
      expect(typeof p.lon).toBe('number');
    }
  });

  it('has a valid bbox [south, west, north, east]', () => {
    const [south, west, north, east] = config.bbox;
    expect(south).toBeLessThan(north);
    expect(west).toBeLessThan(east);
  });

  it('keeps pickup and dropoff inside the bbox', () => {
    const [s, w, n, e] = config.bbox;
    for (const p of [config.pickup, config.dropoff]) {
      expect(p.lat).toBeGreaterThan(s);
      expect(p.lat).toBeLessThan(n);
      expect(p.lon).toBeGreaterThan(w);
      expect(p.lon).toBeLessThan(e);
    }
  });
});
