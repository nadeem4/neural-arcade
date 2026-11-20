import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { INFO } from '../games/treasure-room/words.js';
import { levelPanelHtml, mountLevelPlay, BUILT_LEVELS } from '../games/treasure-room/level-panel.js';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = levelPanelHtml();
const panel = read('games/treasure-room/level-panel.js');

describe('levelPanelHtml', () => {
  it('has every id the panel looks up', () => {
    for (const id of ['stage', 'say', 'levelPanel', 'steps', 'score', 'sees', 'log', 'arrowOut', 'arrowBack', 'handover', 'restart', 'levelTitle', 'levelBrief', 'status', 'tiles']) {
      expect(html, id).toContain(`id="${id}"`);
    }
  });
  it('has the level 3 to 6 controls', () => {
    for (const id of ['routes', 'gamma', 'walk', 'go', 'fix', 'resetArrows', 'sum', 'sweep', 'sweep10', 'walkUp', 'resetSweeps', 'icy', 'dry', 'walkPlan', 'trips', 'showMdp', 'tags']) {
      expect(html, id).toContain(`id="${id}"`);
    }
  });
  it('has the stage canvas with a label, and a live line that is not announced', () => {
    expect(html).toMatch(/<canvas id="stage"[^>]*aria-label="[^"]+"/);
    expect(html).toMatch(/id="say"[^>]*aria-live="off"|aria-live="off"[^>]*id="say"/);
  });
  it('has four move buttons, one per action, as real buttons', () => {
    expect([...html.matchAll(/<button[^>]*data-move="(\d)"/g)].map(m => m[1]).sort()).toEqual(['0', '1', '2', '3']);
  });
  it('has an (i) button on every control, each with its INFO sentence', () => {
    const controls = [...html.matchAll(/class="info"[^>]*aria-controls="([\w-]+)"/g)].map(m => m[1]);
    expect(controls.length).toBeGreaterThanOrEqual(4);
    for (const id of controls) expect(html, id).toMatch(new RegExp(`class="info-text"[^>]*id="${id}"[^>]*hidden|id="${id}"[^>]*class="info-text"[^>]*hidden`));
    for (const k of [...html.matchAll(/data-info="(\w+)"/g)].map(m => m[1])) expect(INFO, k).toHaveProperty(k);
    expect(panel).toMatch(/INFO\[/);
  });
  it('marks each panel part with the levels that show it, and every level has a view', () => {
    for (const n of BUILT_LEVELS) expect(html).toMatch(new RegExp(`data-levels="[^"]*\\b${n}\\b`));
    for (const m of html.matchAll(/data-levels="([\d ]+)"/g)) for (const n of m[1].split(' ')) expect(panel).toMatch(new RegExp(`\\b${n}:\\s*level`));
  });
  it('calls the level 6 section "The floor"', () => {
    expect(html).toContain('<span id="mh">The floor</span>');
    expect(html).not.toContain('The icy floor</span>');
  });
  it('leaves the title out when asked', () => {
    expect(html).toContain('id="levelTitle"');
    expect(levelPanelHtml({ showTitle: false })).not.toContain('id="levelTitle"');
    expect(levelPanelHtml({ showTitle: false })).toContain('id="levelBrief"');
  });
  it('lists the six built levels and exports a mount function', () => {
    expect(BUILT_LEVELS).toEqual([1, 2, 3, 4, 5, 6]);
    expect(typeof mountLevelPlay).toBe('function');
  });
});
