import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { REWARDS, discounted, returnOf, setReward } from '../concepts/return/sim.js';
import { presets } from '../concepts/return/play.js';
import { figureHtml } from '../concepts/return/figures.js';
import { conceptById } from '../assets/games.js';

const HEX_COLOUR = /["'(:]#[0-9a-f]{3,8}\b/i;

describe('discounted and returnOf', () => {
  it('default row has eight rewards ending in one big 10', () => {
    expect(REWARDS).toHaveLength(8);
    expect(REWARDS[7]).toBe(10);
  });
  it('gamma 1 leaves the rewards unchanged and returns their sum', () => {
    expect(discounted(REWARDS, 1)).toEqual(REWARDS);
    expect(returnOf(REWARDS, 1)).toBe(17);
  });
  it('gamma 0.5 makes the third reward a quarter', () => {
    expect(discounted([4, 4, 4], 0.5)[2]).toBe(1);
  });
  it('returnOf([1,1,1], 0.5) is 1.75', () => {
    expect(returnOf([1, 1, 1], 0.5)).toBe(1.75);
  });
  it('gamma 0 keeps only the first reward', () => {
    expect(returnOf([3, 9, 9], 0)).toBe(3);
  });
  it('with a far 10 and gamma 0.5 the near rewards dominate', () => {
    expect(returnOf(REWARDS, 0.5)).toBeLessThan(3);
  });
  it('discounting never raises the return of non-negative rewards', () => {
    expect(returnOf(REWARDS, 0.9)).toBeLessThan(returnOf(REWARDS, 1));
  });
});

describe('setReward', () => {
  it('returns a new row and leaves the input alone', () => {
    const row = [1, 1, 1];
    const next = setReward(row, 1, 5);
    expect(next).toEqual([1, 5, 1]);
    expect(row).toEqual([1, 1, 1]);
  });
});

describe('presets', () => {
  it('has the three discounts, in order', () => {
    expect(presets.map(p => p.label)).toEqual(['No discount', 'Discount 0.9', 'Near-sighted']);
    expect(presets.map(p => p.state.gamma)).toEqual([1, 0.9, 0.5]);
  });
  it('every gamma is valid and gives a finite return, with text', () => {
    for (const p of presets) {
      expect(p.state.gamma).toBeGreaterThanOrEqual(0);
      expect(p.state.gamma).toBeLessThanOrEqual(1);
      expect(Number.isFinite(returnOf(REWARDS, p.state.gamma))).toBe(true);
      expect(p.text.length).toBeGreaterThan(10);
    }
  });
  it('the stated claims are true: more discount, smaller return', () => {
    const r = presets.map(p => returnOf(REWARDS, p.state.gamma));
    expect(r[0]).toBeGreaterThan(r[1]);
    expect(r[1]).toBeGreaterThan(r[2]);
  });
});

describe('figureHtml', () => {
  it('is an svg carrying the exact returns for gamma 1, 0.9 and 0.5', () => {
    const h = figureHtml();
    expect(h.startsWith('<svg')).toBe(true);
    for (const g of [1, 0.9, 0.5]) expect(h).toContain(returnOf(REWARDS, g).toFixed(2));
  });
  it('uses theme tokens only, never hex or the page ink', () => {
    const h = figureHtml();
    expect(h).not.toMatch(HEX_COLOUR);
    expect(h).toContain('var(--stage-ink)');
    expect(h).not.toContain('var(--ink)');
  });
});

describe('return page file', () => {
  const html = readFileSync(new URL('../concepts/return/index.html', import.meta.url), 'utf8');
  it('has the shared header, footer and styles', () => {
    for (const s of ['<header data-site', '<footer data-site', '../../assets/studio.css', '../../assets/concept.css']) expect(html).toContain(s);
  });
  it('has the section ids and mounts the page', () => {
    for (const id of ['playground', 'tries', 'writeup', 'video', 'games', 'related']) expect(html).toContain(`id="${id}"`);
    expect(html).toContain("mountConceptPage('return', '../../')");
  });
  it('leads with the definition from the config', () => {
    expect(html.match(/<p class="lead">([\s\S]*?)<\/p>/)[1].replace(/<[^>]+>/g, '')).toBe(conceptById('return').definition);
  });
});
