import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createPolicy, setAction, runPolicy } from '../concepts/policy/sim.js';
import { RULEBOOKS } from '../concepts/policy/rulebooks.js';
import { figureHtml } from '../concepts/policy/figures.js';
import { GRID } from '../assets/grid.js';
import { lessonById } from '../assets/tracks/model.js';

const HEX_COLOUR = /["'(:]#[0-9a-f]{3,8}\b/i;
const CELLS = GRID.w * GRID.h;
const outcomeOf = i => runPolicy(GRID, RULEBOOKS[i].policy);

describe('createPolicy and setAction', () => {
  it('has one action per cell, all the fill', () => {
    const p = createPolicy(GRID, 3);
    expect(p).toHaveLength(CELLS);
    expect(p.every(a => a === 3)).toBe(true);
    expect(createPolicy(GRID).every(a => a === 0)).toBe(true);
  });
  it('setAction returns a new policy and does not mutate its input', () => {
    const p = createPolicy(GRID, 0);
    const q = setAction(p, 6, 2);
    expect(q[6]).toBe(2);
    expect(p[6]).toBe(0);
    expect(q).not.toBe(p);
  });
});

describe('runPolicy', () => {
  it('walking right along the top row falls in the pit', () => {
    const r = runPolicy(GRID, createPolicy(GRID, 3));
    expect(r.outcome).toBe('pit');
    expect(r.path[0]).toEqual([0, 0]);
    expect(r.path.at(-1)).toEqual([2, 0]);
    expect(r.total).toBeCloseTo(-10.1);
  });
  it('walking into a wall edge counts as going round in circles', () => {
    expect(runPolicy(GRID, createPolicy(GRID, 2)).outcome).toBe('loop');
  });
  it('stops at maxSteps with timeout when it keeps finding new cells', () => {
    expect(runPolicy(GRID, createPolicy(GRID, 3), 1).outcome).toBe('timeout');
  });
  it('does not mutate the policy', () => {
    const p = createPolicy(GRID, 3), copy = [...p];
    runPolicy(GRID, p);
    expect(p).toEqual(copy);
  });
});

describe('rulebooks', () => {
  it('the stated claims are true: bad loops, risky hits the pit, good finds the treasure', () => {
    expect(outcomeOf(0).outcome).toBe('loop');
    expect(outcomeOf(1).outcome).toBe('pit');
    const good = outcomeOf(2);
    expect(good.outcome).toBe('treasure');
    expect(good.total).toBeGreaterThan(0);
  });
});

describe('figureHtml', () => {
  it('shows each outcome word and the exact totals', () => {
    const h = figureHtml();
    for (const w of ['circles', 'pit', 'treasure']) expect(h.toLowerCase()).toContain(w);
    for (let i = 0; i < 3; i++) expect(h).toContain(outcomeOf(i).total.toFixed(1));
  });
  it('uses theme tokens only, never hex or the page ink', () => {
    const h = figureHtml();
    expect(h).not.toMatch(HEX_COLOUR);
    expect(h).toContain('var(--stage-ink)');
    expect(h).not.toContain('var(--ink)');
  });
});

describe('policy page file', () => {
  const html = readFileSync(new URL('../concepts/policy/index.html', import.meta.url), 'utf8');
  it('has the shared header, footer and styles', () => {
    for (const s of ['<header data-site', '<footer data-site', '../../assets/studio.css', '../../assets/concept.css']) expect(html).toContain(s);
  });
  it('is generated: the lesson sections and runtime, with the write-up and page script beside it', () => {
    for (const id of ['tries', 'writeup', 'play', 'watch', 'read']) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('assets/lesson-page.js');
    expect(readFileSync(new URL('../concepts/policy/writeup.html', import.meta.url), 'utf8')).toContain('id="figure"');
    expect(readFileSync(new URL('../concepts/policy/page.js', import.meta.url), 'utf8')).not.toContain('mountPlayground');
  });
  it('leads with the lesson line from the track config', () => {
    expect(html.match(/<p class="lead">([\s\S]*?)<\/p>/)[1].replace(/<[^>]+>/g, '')).toBe(lessonById('policy').says);
  });
});
