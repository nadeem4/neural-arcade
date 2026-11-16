import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createWorld, act, autoAct } from '../concepts/agent/sim.js';
import { presets } from '../concepts/agent/play.js';
import { figureHtml } from '../concepts/agent/figures.js';
import { GRID, ACTIONS, REWARD, move } from '../assets/grid.js';
import { mulberry32 } from '../engine/rng.js';
import { conceptById } from '../assets/games.js';

const RIGHT = 3, DOWN = 1;

describe('agent sim', () => {
  it('two worlds start the same, on S with nothing earned', () => {
    const a = createWorld(), b = createWorld();
    expect(a).toEqual(b);
    expect(a.pos).toEqual({ x: 0, y: 0 });
    expect(a.last).toBeNull();
    expect(a.total).toBe(0);
  });
  it('act updates pos, last and total by the grid reward', () => {
    const w = createWorld();
    act(w, RIGHT);
    expect(w.pos).toEqual({ x: 1, y: 0 });
    expect(w.last).toEqual({ action: RIGHT, reward: REWARD.step });
    expect(w.steps).toBe(1);
    expect(w.total).toBeCloseTo(REWARD.step);
  });
  it('a wall bump keeps the agent in place and still pays the step', () => {
    const w = createWorld();
    act(w, 0);
    expect(w.pos).toEqual({ x: 0, y: 0 });
    expect(w.last.reward).toBe(REWARD.step);
  });
  it('a terminal act sets done, and the next act restarts the episode', () => {
    const w = createWorld();
    act(w, RIGHT); act(w, RIGHT); // onto the pit at (2,0)
    expect(w.done).toBe(true);
    expect(w.last.reward).toBe(REWARD.pit);
    act(w, RIGHT);
    expect(w.done).toBe(false);
    expect(w.pos).toEqual({ x: 0, y: 0 });
    expect(w.steps).toBe(0);
    expect(w.total).toBe(0);
    expect(w.last).toBeNull();
  });
  it('autoAct is deterministic for a seed and usually finds the treasure', () => {
    const run = seed => {
      const w = createWorld(), rng = mulberry32(seed);
      let wins = 0;
      for (let i = 0; i < 50; i++) { autoAct(w, rng); if (w.done && w.last.reward === REWARD.treasure) wins++; }
      return { w, wins };
    };
    expect(run(5)).toEqual(run(5));
    let wins = 0, pits = 0;
    for (let s = 1; s <= 10; s++) {
      const w = createWorld(), rng = mulberry32(s);
      for (let i = 0; i < 50; i++) { autoAct(w, rng); if (w.done) { if (w.last.reward === REWARD.treasure) wins++; else pits++; } }
    }
    expect(wins).toBeGreaterThan(pits);
  });
});

describe('presets', () => {
  it('has the three presets', () => {
    expect(presets.map(p => p.label)).toEqual(['Move it yourself', 'Let it act on its own', 'Ask the world']);
    expect(presets.map(p => p.state)).toEqual([{ auto: false }, { auto: true }, { auto: false, act: 3 }]);
  });
  it('every preset applied to a fresh world leaves finite numbers', () => {
    for (const p of presets) {
      const w = createWorld(), rng = mulberry32(3);
      if (p.state.act !== undefined) act(w, p.state.act);
      if (p.state.auto) for (let i = 0; i < 10; i++) autoAct(w, rng);
      for (const v of [w.pos.x, w.pos.y, w.steps, w.total]) expect(Number.isFinite(v)).toBe(true);
      expect(p.text.length).toBeGreaterThan(10);
    }
  });
});

describe('figureHtml', () => {
  it('is deterministic, an svg, and carries the real first reward', () => {
    expect(figureHtml(7)).toBe(figureHtml(7));
    expect(figureHtml(7).startsWith('<svg')).toBe(true);
    const w = createWorld(), rng = mulberry32(7);
    autoAct(w, rng);
    expect(figureHtml(7)).toContain(`reward ${w.last.reward.toFixed(1)}`);
  });
  it('shows whole grids and puts the step captions in legible HTML under the svg', () => {
    const h = figureHtml(7);
    const vb = h.match(/viewBox="(\S+) (\S+) (\S+) (\S+)"/).slice(1).map(Number);
    expect(vb[0]).toBeLessThan(0);
    expect(vb[1]).toBeLessThan(0);
    expect(h).toContain('</svg><ol');
    expect(h.match(/<svg[\s\S]*<\/svg>/)[0]).not.toContain('<text x="' + (vb[2] / 2) + '"');
  });
});

describe('agent page file', () => {
  const html = readFileSync(new URL('../concepts/agent/index.html', import.meta.url), 'utf8');
  it('has the shared header, footer and styles', () => {
    for (const s of ['<header data-site', '<footer data-site', '../../assets/studio.css', '../../assets/concept.css']) expect(html).toContain(s);
  });
  it('has the section ids and mounts the page', () => {
    for (const id of ['playground', 'tries', 'writeup', 'video', 'games', 'related']) expect(html).toContain(`id="${id}"`);
    expect(html).toContain("mountConceptPage('agent', '../../')");
  });
  it('leads with the definition from the config', () => {
    expect(html.match(/<p class="lead">([\s\S]*?)<\/p>/)[1].replace(/<[^>]+>/g, '')).toBe(conceptById('agent').definition);
  });
});
