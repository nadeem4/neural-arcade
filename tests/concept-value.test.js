import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { valuesFor, shadeOf } from '../concepts/value/sim.js';
import { figureHtml } from '../concepts/value/figures.js';
import { GRID, stateId } from '../assets/grid.js';
import { lessonById } from '../assets/tracks/model.js';

const HEX_COLOUR = /["'(:]#[0-9a-f]{3,8}\b/i;
const at = (grid, x, y) => stateId(grid, { x, y });

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
    for (const id of ['tries', 'writeup', 'play', 'watch', 'read']) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('assets/lesson-page.js');
    expect(readFileSync(new URL('../concepts/value/writeup.html', import.meta.url), 'utf8')).toContain('id="figure"');
    expect(readFileSync(new URL('../concepts/value/page.js', import.meta.url), 'utf8')).not.toContain('mountPlayground');
  });
  it('leads with the lesson line from the track config', () => {
    expect(html.match(/<p class="lead">([\s\S]*?)<\/p>/)[1].replace(/<[^>]+>/g, '')).toBe(lessonById('value').says);
  });
});
