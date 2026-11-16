import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { describeCell } from '../concepts/state-action-reward/sim.js';
import { presets } from '../concepts/state-action-reward/play.js';
import { figureHtml } from '../concepts/state-action-reward/figures.js';
import { figureHtml as agentFigure } from '../concepts/agent/figures.js';
import { GRID, REWARD, stateId } from '../assets/grid.js';
import { conceptById } from '../assets/games.js';

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

describe('presets', () => {
  it('has three presets, the last two beside the pit and the treasure', () => {
    expect(presets.map(p => p.label)).toEqual(['Pick cell', 'Look next to the pit', 'Look next to the treasure']);
    expect(presets[1].state.hover).toEqual([1, 0]);
    expect(presets[2].state.hover).toEqual([3, 0]);
  });
  it('every hover is an in-grid cell and describes to finite numbers', () => {
    for (const p of presets) {
      const [x, y] = p.state.hover;
      expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(GRID.w);
      expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThan(GRID.h);
      const d = describeCell(GRID, { x, y });
      expect(Number.isFinite(d.state)).toBe(true);
      for (const o of d.options) expect(Number.isFinite(o.reward)).toBe(true);
      expect(p.text.length).toBeGreaterThan(10);
    }
  });
});

describe('figureHtml', () => {
  it('is an svg carrying the exact rewards describeCell gives', () => {
    const h = figureHtml();
    expect(h.startsWith('<svg')).toBe(true);
    for (const o of describeCell(GRID, { x: 1, y: 0 }).options) expect(h).toContain(o.reward.toFixed(1));
  });
  it('uses theme tokens, never hard-coded hex colours (also the agent figure)', () => {
    expect(figureHtml()).not.toMatch(HEX_COLOUR);
    expect(agentFigure(7)).not.toMatch(HEX_COLOUR);
    expect(figureHtml()).toContain('var(--ink)');
  });
});

describe('state-action-reward page file', () => {
  const html = readFileSync(new URL('../concepts/state-action-reward/index.html', import.meta.url), 'utf8');
  it('has the shared header, footer and styles', () => {
    for (const s of ['<header data-site', '<footer data-site', '../../assets/studio.css', '../../assets/concept.css']) expect(html).toContain(s);
  });
  it('has the section ids and mounts the page', () => {
    for (const id of ['playground', 'tries', 'writeup', 'video', 'games', 'related']) expect(html).toContain(`id="${id}"`);
    expect(html).toContain("mountConceptPage('state-action-reward', '../../')");
  });
  it('leads with the definition from the config', () => {
    expect(html.match(/<p class="lead">([\s\S]*?)<\/p>/)[1].replace(/<[^>]+>/g, '')).toBe(conceptById('state-action-reward').definition);
  });
});
