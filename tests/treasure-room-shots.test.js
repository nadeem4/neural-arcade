import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FIGURES, figureOpts, parseShots } from '../games/treasure-room/shots.js';
import { heatOf } from '../games/treasure-room/level-value.js';
import { makeGrid } from '../assets/grid.js';
import { overlayNames } from '../games/treasure-room/room-overlays.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const story = JSON.parse(read('games/treasure-room/story.json'));
const START = story.triples[0].state;

describe('capture mode figure table', () => {
  it('has eight images in page order, 16:10, with registered overlays', () => {
    expect(FIGURES).toHaveLength(8);
    expect(FIGURES.map(f => f.file)).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map(n => `fig-${n}.webp`));
    expect(FIGURES.map(f => f.level)).toEqual(['loop', 'return', 'policy', 'policy', 'value', 'value', 'mdp', 'mdp']);
    for (const f of FIGURES) {
      expect(f.size[0] / f.size[1]).toBeCloseTo(16 / 10, 1);
      expect(overlayNames(f.overlays)).toEqual(f.overlays);
      expect(f.pose).toBeTruthy();
    }
  });

  it('builds each figure\'s opts from the recorded story', () => {
    const walk = [START, ...story.agent.trace.map(t => t.pos)];
    const R = story.returns, P = story.policy, M = story.mdp;
    expect(figureOpts(story, 1)).toEqual({ agent: START, ghost: walk });
    expect(figureOpts(story, 2)).toEqual({ agent: START, ghost: [R.shortCells, R.detourCells] });
    expect(figureOpts(story, 3)).toEqual({ agent: START, policy: P.bad, ghost: P.badRun.cells });
    expect(figureOpts(story, 4)).toEqual({ agent: START, policy: P.fixed, ghost: P.fixedRun.cells });
    const room = makeGrid(story.room), snaps = story.value.snapshots, mid = snaps.find(s => s.sweep === 2), last = snaps.at(-1);
    expect(figureOpts(story, 5)).toEqual({ values: mid.values, heat: heatOf(mid.values, room) });
    expect(figureOpts(story, 6)).toEqual({ values: last.values, heat: heatOf(last.values, room) });
    expect(figureOpts(story, 7)).toEqual({ agent: START, ghost: M.dry.cells, ice: false });
    expect(figureOpts(story, 8)).toEqual({ agent: START, ghost: M.icy.cells, ice: true });
  });

  it('rejects an unknown figure number', () => {
    expect(() => figureOpts(story, 9)).toThrow();
  });
});

describe('parseShots', () => {
  it('reads fig and any WxH size', () => {
    expect(parseShots('?shots=1&fig=3&size=1280x800')).toEqual({ fig: 3, size: [1280, 800] });
    expect(parseShots('?shots=1&fig=1&size=1280x720')).toEqual({ fig: 1, size: [1280, 720] });
  });
  it('defaults the size to the figure size', () => {
    expect(parseShots('?shots=1&fig=2')).toEqual({ fig: 2, size: FIGURES[1].size });
  });
  it('is null without shots=1 or with a bad fig', () => {
    expect(parseShots('')).toBeNull();
    expect(parseShots('?fig=3')).toBeNull();
    expect(parseShots('?shots=1&fig=12')).toBeNull();
  });
  it('mounts capture mode only on ?shots=1', () => {
    expect(read('games/treasure-room/main.js')).toMatch(/import\('\.\/shots\.js'\)/);
    expect(read('games/treasure-room/main.js')).toMatch(/if \(shot\)/);
    expect(read('games/treasure-room/main.js')).toMatch(/if \(!shot\) \{\s*warm\(/);
  });
});
