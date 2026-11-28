import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { describeCell } from '../concepts/state/sim.js';
import { figureHtml } from '../concepts/state/figures.js';
import { GRID, REWARD, stateId } from '../assets/grid.js';
import { flatLessons, lessonById } from '../assets/tracks/model.js';

const UP = 0, DOWN = 1, LEFT = 2, RIGHT = 3;
const HEX_COLOUR = /["'(:]#[0-9a-f]{3,8}\b/i;

describe('describeCell', () => {
  it('start cell has four options with state id 0', () => {
    const d = describeCell(GRID, { x: 0, y: 0 });
    expect(d.state).toBe(0);
    expect(d.options).toHaveLength(4);
    expect(d.options.map(o => o.action)).toEqual([UP, DOWN, LEFT, RIGHT]);
  });
  it('cell beside the pit shows the pit move at -10', () => {
    const o = describeCell(GRID, { x: 1, y: 0 }).options[RIGHT];
    expect(o.reward).toBe(REWARD.pit);
    expect(o.to).toEqual({ x: 2, y: 0 });
  });
  it('cell beside the treasure shows 10', () => {
    expect(describeCell(GRID, { x: 3, y: 0 }).options[RIGHT].reward).toBe(REWARD.treasure);
  });
  it('edge moves cost a step and stay put', () => {
    const d = describeCell(GRID, { x: 0, y: 0 });
    for (const a of [UP, LEFT]) {
      expect(d.options[a].reward).toBe(REWARD.step);
      expect(d.options[a].to).toEqual({ x: 0, y: 0 });
    }
  });
  it('does not mutate the grid or position', () => {
    const grid = JSON.stringify(GRID), pos = { x: 1, y: 1 };
    describeCell(GRID, pos);
    expect(JSON.stringify(GRID)).toBe(grid);
    expect(pos).toEqual({ x: 1, y: 1 });
    expect(describeCell(GRID, pos).state).toBe(stateId(GRID, pos));
  });
});

describe('figureHtml', () => {
  it('is an svg carrying the exact rewards describeCell gives', () => {
    const h = figureHtml();
    expect(h.startsWith('<svg')).toBe(true);
    for (const o of describeCell(GRID, { x: 1, y: 0 }).options) expect(h).toContain(o.reward.toFixed(1));
  });
  it('uses theme tokens, never hard-coded hex colours', () => {
    expect(figureHtml()).not.toMatch(HEX_COLOUR);
    expect(figureHtml()).toContain('var(--stage-ink)');
    expect(figureHtml()).not.toContain('var(--ink)'); // the figure sits on the dark stage
  });
});

describe('Treasure Room lesson write-ups', () => {
  const lessons = flatLessons().filter((l) => l.status === 'live' && l.level);
  it.each(lessons.map((l) => l.id))('%s shows its idea in one code block after the first h2', (id) => {
    const w = readFileSync(new URL(`../concepts/${id}/writeup.html`, import.meta.url), 'utf8');
    expect(w.match(/<pre class="code">/g)).toHaveLength(1);
    expect(w.indexOf('<h2>')).toBeGreaterThan(-1);
    expect(w.indexOf('<pre class="code">')).toBeGreaterThan(w.indexOf('<h2>'));
  });
  it('Lesson 1 has no figure', () => {
    expect(readFileSync(new URL('../concepts/loop/writeup.html', import.meta.url), 'utf8')).not.toContain('<figure');
  });
});

describe('state page file', () => {
  const html = readFileSync(new URL('../concepts/state/index.html', import.meta.url), 'utf8');
  it('has the shared header, footer and styles', () => {
    for (const s of ['<header data-site', '<footer data-site', '../../assets/studio.css', '../../assets/concept.css']) expect(html).toContain(s);
  });
  it('is generated: the lesson sections and runtime, with the write-up and page script beside it', () => {
    for (const id of ['tries', 'writeup', 'play', 'watch', 'read']) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('assets/lesson-page.js');
    expect(readFileSync(new URL('../concepts/state/writeup.html', import.meta.url), 'utf8')).toContain('id="figure"');
    expect(readFileSync(new URL('../concepts/state/page.js', import.meta.url), 'utf8')).not.toContain('mountPlayground');
  });
  it('leads with the lesson line from the track config', () => {
    expect(html.match(/<p class="lead">([\s\S]*?)<\/p>/)[1].replace(/<[^>]+>/g, '')).toBe(lessonById('state').says);
  });
});
