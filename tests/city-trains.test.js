import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { pairRails } from '../games/city/street-furniture.js';
import { pickLine, trainPath, trainsAt, TRAIN } from '../games/city/trains.js';

const CITY = JSON.parse(readFileSync(new URL('../games/city/chicago.json', import.meta.url), 'utf8'));
const rails = pairRails(CITY.rail ?? []);

describe('L trains', () => {
  it('picks the longest elevated two-track line from the map data', () => {
    const line = pickLine(rails);
    expect(line).toBeTruthy();
    expect(line.elevated).toBe(true);
    expect(line.sep).toBeGreaterThanOrEqual(3.2);
  });
  it('has no line to run on when there is no two-track elevated line', () => {
    expect(pickLine([])).toBeNull();
    expect(pickLine([{ pts: [[0, 0], [100, 0]], elevated: false }, { pts: [[0, 0], [100, 0]], elevated: true, sep: 0 }])).toBeNull();
  });
  const line = pickLine(rails), path = trainPath(line.pts);
  it('two trains, a pure function of ms: the same ms gives the same positions', () => {
    const a = trainsAt(line, path, 12345), b = trainsAt(line, path, 12345);
    expect(a).toHaveLength(2);
    expect(a).toEqual(b);
    expect(trainsAt(line, path, 0)).not.toEqual(trainsAt(line, path, 20000));
  });
  it('the trains stay on the line and sit on the rails', () => {
    const xs = path.pts.map((p) => p[0]), zs = path.pts.map((p) => p[1]), pad = line.sep + 1;
    for (let ms = 0; ms < 600000; ms += 1700) for (const t of trainsAt(line, path, ms)) {
      expect(t.x).toBeGreaterThan(Math.min(...xs) - pad); expect(t.x).toBeLessThan(Math.max(...xs) + pad);
      expect(t.z).toBeGreaterThan(Math.min(...zs) - pad); expect(t.z).toBeLessThan(Math.max(...zs) + pad);
      expect(t.y).toBeGreaterThan(1);
    }
  });
  it('the two trains never overlap: they run on different tracks, wider apart than a train is wide', () => {
    expect(line.sep).toBeGreaterThan(TRAIN.w);
    for (let ms = 0; ms < 600000; ms += 997) {
      const [a, b] = trainsAt(line, path, ms);
      // across-track offsets are +-sep/2 from the centreline, so the gap between their sides is sep - width
      expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(TRAIN.w);
    }
  });
  it('the trains do not appear in the layout when the line is missing, and scene-furniture draws them from ms', () => {
    const f = readFileSync(new URL('../games/city/scene-furniture.js', import.meta.url), 'utf8');
    expect(f).toMatch(/trainsAt\(/);
    expect(f).not.toMatch(/Date\.now|performance\.now|Math\.random/);
  });
});
