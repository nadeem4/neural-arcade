import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { valuesFor, shadeOf, moveTreasure } from '../concepts/value/sim.js';
import { presets } from '../concepts/value/play.js';
import { figureHtml } from '../concepts/value/figures.js';
import { GRID, stateId } from '../assets/grid.js';
import { conceptById } from '../assets/games.js';

const HEX_COLOUR = /["'(:]#[0-9a-f]{3,8}\b/i;
const at = (grid, x, y) => stateId(grid, { x, y });
const stateOf = i => presets[i].state;
const gridOf = s => (s.treasure ? moveTreasure(GRID, s.treasure) : GRID);

describe('valuesFor', () => {
  it('values grow toward the treasure along the path', () => {
    const v = valuesFor(GRID, 0.9);
    expect(v).toHaveLength(GRID.w * GRID.h);
    expect(v[at(GRID, 3, 0)]).toBeGreaterThan(v[at(GRID, 3, 1)] - 1e-9);
    expect(v[at(GRID, 4, 1)]).toBeGreaterThan(v[at(GRID, 3, 1)]);
    expect(v[at(GRID, 3, 1)]).toBeGreaterThan(v[at(GRID, 2, 1)]);
    expect(v[at(GRID, 2, 1)]).toBeGreaterThan(v[at(GRID, 1, 1)]);
  });
  it('a higher discount gives the start cell a higher value', () => {
    expect(valuesFor(GRID, 0.95)[0]).toBeGreaterThan(valuesFor(GRID, 0.3)[0]);
  });
});

describe('shadeOf', () => {
  it('clamps to 0..1', () => {
    expect(shadeOf(-5, 0, 10)).toBe(0);
    expect(shadeOf(50, 0, 10)).toBe(1);
    expect(shadeOf(5, 0, 10)).toBeCloseTo(0.5);
  });
  it('is monotone and survives min equal to max', () => {
    expect(shadeOf(2, 0, 10)).toBeLessThan(shadeOf(3, 0, 10));
    expect(shadeOf(1, 1, 1)).toBe(0);
  });
});

describe('moveTreasure', () => {
  it('moves the T to a floor cell and returns a new grid', () => {
    const g = moveTreasure(GRID, [0, 3]);
    expect(g.cells[3][0]).toBe('T');
    expect(g.cells[0][4]).toBe('.');
    expect(g.cells.flat().filter(c => c === 'T')).toHaveLength(1);
    expect(g).not.toBe(GRID);
  });
  it('does not mutate the original grid', () => {
    moveTreasure(GRID, [0, 3]);
    expect(GRID.cells[0][4]).toBe('T');
    expect(GRID.cells[3][0]).toBe('.');
  });
  it('rejects wall, pit, start and off-grid cells', () => {
    for (const p of [[1, 2], [2, 0], [0, 0], [9, 9], [-1, 0]]) expect(() => moveTreasure(GRID, p), String(p)).toThrow();
  });
  it('changes which neighbour has the highest value', () => {
    const a = valuesFor(GRID, 0.9), b = valuesFor(moveTreasure(GRID, [0, 3]), 0.9);
    expect(b[at(GRID, 0, 2)]).toBeGreaterThan(a[at(GRID, 0, 2)]);
    expect(b[at(GRID, 4, 1)]).toBeLessThan(a[at(GRID, 4, 1)]);
  });
});

describe('presets', () => {
  it('are near-sighted, far-sighted and move treasure', () => {
    expect(presets.map(p => p.label)).toEqual(['Near-sighted', 'Far-sighted', 'Move the treasure']);
    for (const p of presets) expect(p.text.length).toBeGreaterThan(10);
  });
  it('every preset yields finite values on a valid grid', () => {
    for (let i = 0; i < presets.length; i++) {
      const s = stateOf(i), g = gridOf(s);
      expect(valuesFor(g, s.gamma).every(Number.isFinite)).toBe(true);
    }
  });
  it('the stated claims are true', () => {
    const near = valuesFor(GRID, stateOf(0).gamma), far = valuesFor(GRID, stateOf(1).gamma);
    expect(near[0]).toBeLessThan(0);
    expect(far[0]).toBeGreaterThan(7);
    const s = stateOf(2), g = gridOf(s);
    expect(g.cells[s.treasure[1]][s.treasure[0]]).toBe('T');
    expect(valuesFor(g, s.gamma)[at(g, 0, 2)]).toBeGreaterThan(valuesFor(GRID, s.gamma)[at(g, 0, 2)]);
  });
});

describe('figureHtml', () => {
  it('shows the exact start-cell value at each discount, rounded', () => {
    const h = figureHtml();
    expect(h).toContain(valuesFor(GRID, 0.3)[0].toFixed(1));
    expect(h).toContain(valuesFor(GRID, 0.95)[0].toFixed(1));
    expect(h).toContain('0.3');
    expect(h).toContain('0.95');
  });
  it('uses theme tokens only, never hex or the page ink', () => {
    const h = figureHtml();
    expect(h).not.toMatch(HEX_COLOUR);
    expect(h).toContain('var(--stage-ink)');
    expect(h).not.toContain('var(--ink)');
  });
});

describe('value page file', () => {
  const html = readFileSync(new URL('../concepts/value/index.html', import.meta.url), 'utf8');
  it('has the shared header, footer and styles', () => {
    for (const s of ['<header data-site', '<footer data-site', '../../assets/studio.css', '../../assets/concept.css']) expect(html).toContain(s);
  });
  it('is generated: the lesson sections and runtime, with the write-up and page script beside it', () => {
    for (const id of ['playground', 'tries', 'writeup', 'play', 'watch', 'read']) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('assets/lesson-page.js');
    expect(readFileSync(new URL('../concepts/value/writeup.html', import.meta.url), 'utf8')).toContain('id="figure"');
    expect(readFileSync(new URL('../concepts/value/page.js', import.meta.url), 'utf8')).toContain('mountPlayground');
  });
  it('leads with the definition from the config', () => {
    expect(html.match(/<p class="lead">([\s\S]*?)<\/p>/)[1].replace(/<[^>]+>/g, '')).toBe(conceptById('value').definition);
  });
});
