import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

// The Treasure Room level on each page is the only playground; these four lessons used to repeat it as a 2D grid.
const IDS = ['agent', 'state-action-reward', 'policy', 'value'];
const read = (id, f) => readFileSync(new URL(`../concepts/${id}/${f}`, import.meta.url), 'utf8');
const triesOf = id => [...read(id, 'index.html').match(/<ol class="tries" id="tries">([\s\S]*?)<\/ol>/)[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m => m[1]);

describe.each(IDS)('%s lesson has no 2D grid playground', id => {
  it('no play.js, no playground stage, no canvas, no playground wiring', () => {
    expect(existsSync(new URL(`../concepts/${id}/play.js`, import.meta.url))).toBe(false);
    const html = read(id, 'index.html');
    expect(html).not.toContain('id="playground"');
    expect(html).not.toContain('<canvas');
    expect(read(id, 'page.js')).not.toMatch(/play\.js|mountPlayground|wireTries/);
  });
  it('keeps the figure and three tries that name the level controls above', () => {
    expect(read(id, 'page.js')).toContain('figureHtml');
    const tries = triesOf(id);
    expect(tries).toHaveLength(3);
    for (const t of tries) expect(t).not.toMatch(/<button/);
  });
});

describe('each lesson try points at a real control of its level', () => {
  const NAMES = {
    agent: ['arrow', 'Let the AI play', 'What the AI sees'],
    'state-action-reward': ['Log', 'pit', 'treasure'],
    policy: ['Click', 'Go', 'Let the AI fix it'],
    value: ['Sweep', 'Discount', 'Walk uphill'],
  };
  for (const id of IDS) {
    it(id, () => {
      const text = triesOf(id).join(' ');
      for (const n of NAMES[id]) expect(text, n).toContain(n);
    });
  }
});
