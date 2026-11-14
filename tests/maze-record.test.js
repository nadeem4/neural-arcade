import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordClip } from '../games/maze/record.js';

const spec = { seed: 3, episodes: [1, 20, 300], gamma: 0.9 };

describe('the headless maze clip recorder', () => {
  it('is deterministic: the same spec gives the same recording', () => {
    expect(recordClip(spec)).toEqual(recordClip(spec));
  }, 30000);

  it('different seeds give different early snapshots', () => {
    const a = recordClip({ seed: 1, episodes: [1] }), b = recordClip({ seed: 2, episodes: [1] });
    expect({ s: a.snapshots, w: a.walks }).not.toEqual({ s: b.snapshots, w: b.walks });
  });

  it('rejects a bad seed or gamma with a clear error', () => {
    expect(() => recordClip({ seed: NaN })).toThrow(/seed/);
    expect(() => recordClip({ gamma: NaN })).toThrow(/gamma/);
    expect(() => recordClip({ gamma: 1.5 })).toThrow(/gamma/);
    expect(() => recordClip({ gamma: -0.1 })).toThrow(/gamma/);
  });

  it('the CLI writes the clip to --out, even from a path with spaces', () => {
    const dir = mkdtempSync(join(tmpdir(), 'maze rec '));
    const out = join(dir, 'clip.json');
    execFileSync('node', [fileURLToPath(new URL('../games/maze/record.js', import.meta.url)), '--episodes', '1', '--out', out]);
    expect(JSON.parse(readFileSync(out, 'utf8')).snapshots.map(s => s.episode)).toEqual([1]);
  });

  it('records the grid, one snapshot per chosen episode, and a greedy walk at each', () => {
    const clip = recordClip(spec);
    expect(clip.seed).toBe(3);
    expect(clip.gamma).toBe(0.9);
    expect(clip.map.rows).toHaveLength(6);
    expect(clip.map.nCols).toBe(6);
    expect(clip.map.start).toBe(30);
    expect(clip.snapshots.map(s => s.episode)).toEqual([1, 20, 300]);
    for (const s of clip.snapshots) {
      expect(s.values).toHaveLength(36);
      expect(s.policy).toHaveLength(36);
    }
    expect(clip.walks.map(w => w.episode)).toEqual([1, 20, 300]);
    for (const w of clip.walks) {
      expect(w.path[0]).toBe(30);
      expect(['big', 'small', 'pit', 'cap']).toContain(w.outcome);
    }
  });

  it('a high discount makes far-from-goal values big, a low one keeps them small', () => {
    const start = gamma => recordClip({ seed: 1, episodes: [3000], gamma }).snapshots[0].values[30];
    const low = start(0.5), high = start(0.95);
    expect(low).toBeLessThan(2);
    expect(high).toBeGreaterThan(low + 4);
  }, 30000);

  it('rejects an unknown map and unsorted episodes', () => {
    expect(() => recordClip({ map: 'nope' })).toThrow();
    expect(() => recordClip({ episodes: [5, 1] })).toThrow();
  });
});
