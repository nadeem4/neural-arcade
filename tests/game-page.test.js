import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { GAMES } from '../assets/games.js';
import { chipsForGame } from '../assets/tracks/model.js';

describe('game pages', () => {
  for (const g of GAMES) {
    it(`${g.id} has the lessons and more-games containers`, () => {
      const html = readFileSync(new URL(`../${g.path}index.html`, import.meta.url), 'utf8');
      for (const id of ['crumb', 'uses', 'usesChips', 'usesTitle', 'moreFrom', 'moreTitle', 'moreTiles']) expect(html, `${g.id} #${id}`).toContain(`id="${id}"`);
      expect(html).toContain('Lessons this game appears in');
      expect(html).toContain('More games');
      expect(html).not.toMatch(/Words this game uses|More from the arcade/);
    });
    it(`${g.id} appears in at least one lesson`, () => expect(chipsForGame(g.id).length).toBeGreaterThan(0));
  }
});

describe('mountGamePage lessons row', () => {
  // no jsdom in this repo: a tiny stand-in document with just the elements the script touches
  const mount = async (ids, game = 'maze') => {
    const els = Object.fromEntries([...ids, 'moreFrom', 'moreTitle', 'moreTiles', 'writeup', 'watchBox', 'watchCol', 'switchWatch'].map(id => [id, { innerHTML: '', hidden: true, dataset: {}, addEventListener() {}, querySelectorAll: () => [] }]));
    vi.stubGlobal('document', {
      body: { dataset: { game } },
      getElementById: id => els[id] ?? null,
      querySelector: () => null,
      querySelectorAll: () => [],
    });
    vi.resetModules();
    await import('../assets/game-page.js');
    return els;
  };
  afterEach(() => vi.unstubAllGlobals());

  it('un-hides #uses, titles it and fills #usesChips with numbered lesson links', async () => {
    const els = await mount(['uses', 'usesChips', 'usesTitle']);
    expect(els.uses.hidden).toBe(false);
    expect(els.usesTitle.innerHTML).toBe('Lessons this game appears in');
    expect(els.usesChips.innerHTML).toContain('href="../../concepts/return/">Lesson 3: Return</a>');
  });
  it('sets the track crumb and the More games title and tiles', async () => {
    const els = await mount(['crumb']);
    expect(els.crumb.innerHTML).toBe('<a href="../../reinforcement-learning/">Reinforcement learning</a> / Treasure Maze');
    expect(els.moreTitle.innerHTML).toBe('More games');
    expect(els.moreTiles.innerHTML).toContain('games/city/');
    expect(els.moreFrom.hidden).toBe(false);
  });
});
