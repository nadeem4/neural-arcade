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
    const snap = (ms) => JSON.parse(JSON.stringify(trainsAt(line, path, ms))), a = snap(12345), b = snap(12345);
    expect(a).toHaveLength(2);
    expect(a).toEqual(b);
    expect(snap(0)).not.toEqual(snap(20000));
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
  it('no train hangs past a deck end: its ends stay on the line, and short lines get no trains', () => {
    const a = path.pts[0], z = path.pts[path.pts.length - 1];
    for (let ms = 0; ms < 900000; ms += 613) for (const tr of trainsAt(line, path, ms)) {
      // a train's centre is half a train length inside the line, so its ends reach the deck end and no further
      const d = Math.min(Math.hypot(tr.x - a[0], tr.z - a[1]), Math.hypot(tr.x - z[0], tr.z - z[1]));
      expect(d).toBeGreaterThan(0);
    }
    const rails = [{ pts: [[0, 0], [TRAIN.l * 1.5, 0]], elevated: true, sep: 4, h: 6 }];
    expect(pickLine(rails)).toBeNull();
    const tail = trainsAt(line, path, 0)[0], head = trainsAt(line, path, (path.len - TRAIN.l) / TRAIN.speed * 1000)[0];
    expect(Math.hypot(tail.x - a[0], tail.z - a[1])).toBeGreaterThan(TRAIN.l / 2 - line.sep - 1);
    expect(Math.hypot(head.x - z[0], head.z - z[1])).toBeGreaterThan(TRAIN.l / 2 - line.sep - 1);
  });
  it('the trains do not appear in the layout when the line is missing, and scene-furniture draws them from ms', () => {
    const f = readFileSync(new URL('../games/city/scene-furniture.js', import.meta.url), 'utf8');
    expect(f).toMatch(/trainsAt\(/);
    expect(f).toMatch(/treesToHide\(trainFlat/);
    expect(f).not.toMatch(/Date\.now|performance\.now|Math\.random/);
  });
});
