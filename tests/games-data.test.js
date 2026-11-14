import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { CATEGORIES, GAMES, videoOf, newest, categoriesWithGames, groupCategories, browse, gameById, homeModel, categoryModel, moreFrom } from '../assets/games.js';

const FIELDS = ['id', 'title', 'category', 'lesson', 'learnsBy', 'goesWrongWhen', 'added', 'shot', 'path', 'writeup'];
const fake = (id, o = {}) => ({ id, title: id, category: 'how-ai-learns', lesson: '', added: '2026-01-01', ...o });

describe('games data', () => {
  it('every game has all required fields', () => {
    for (const g of GAMES) {
      for (const f of FIELDS) expect(typeof g[f], `${g.id}.${f}`).toBe('string');
      for (const f of FIELDS) expect(g[f].length, `${g.id}.${f}`).toBeGreaterThan(0);
      expect('youtube' in g).toBe(true);
    }
  });
  it('path folder and writeup page exist on disk', () => {
    for (const g of GAMES) {
      expect(existsSync(new URL('../' + g.path, import.meta.url)), g.path).toBe(true);
      expect(existsSync(new URL('../' + g.shot, import.meta.url)), g.shot).toBe(true);
      expect(existsSync(new URL('../' + g.writeup + 'index.html', import.meta.url)), g.writeup).toBe(true);
    }
  });
  it('category exists in CATEGORIES', () => {
    const ids = CATEGORIES.map(c => c.id);
    for (const g of GAMES) expect(ids).toContain(g.category);
  });
  it('youtube is null or a valid id', () => {
    for (const g of GAMES) if (g.youtube !== null) expect(g.youtube).toMatch(/^[\w-]{11}$/);
  });
  it('each game links its explainer video', () => {
    const ids = Object.fromEntries(GAMES.map(g => [g.id, g.youtube]));
    expect(ids).toMatchObject({ racer: 'tG00TxTB8ns', teach: 'qfzRiq3DoJo', runner: 'K1I7QxfrgIk', balance: 'ui3l3xSUZ4U' });
  });
  it('ids are unique and added parses as a date', () => {
    expect(new Set(GAMES.map(g => g.id)).size).toBe(GAMES.length);
    for (const g of GAMES) expect(Number.isNaN(Date.parse(g.added)), g.id).toBe(false);
  });
  it('gameById finds a game', () => {
    expect(gameById('runner').title).toBe('Coin Runner');
    expect(gameById('nope')).toBeUndefined();
  });
});

describe('videoOf', () => {
  it('is null without a youtube id', () => expect(videoOf({ youtube: null })).toBeNull());
  it('builds the thumbnail url', () => {
    expect(videoOf({ youtube: 'abcdefg' })).toEqual({ id: 'abcdefg', thumb: 'https://i.ytimg.com/vi/abcdefg/hqdefault.jpg' });
  });
});

describe('newest', () => {
  it('picks the latest, ties by title', () => {
    expect(newest([fake('a', { added: '2026-01-01' }), fake('b', { added: '2026-02-01' })]).id).toBe('b');
    expect(newest([fake('z', { title: 'Zed' }), fake('y', { title: 'Alpha' })]).id).toBe('y');
  });
});

describe('categories', () => {
  const cats = [{ id: 'x', title: 'X' }, { id: 'y', title: 'Y' }];
  it('categoriesWithGames drops empty', () => {
    expect(categoriesWithGames(cats, [fake('a', { category: 'x' })]).map(c => c.id)).toEqual(['x']);
  });
  it('groupCategories caps at 4 newest first', () => {
    const games = Array.from({ length: 6 }, (_, i) => fake('g' + i, { category: 'x', added: `2026-01-0${i + 1}` }));
    const [grp] = groupCategories(cats, games);
    expect(grp.category.id).toBe('x');
    expect(grp.games.map(g => g.id)).toEqual(['g5', 'g4', 'g3', 'g2']);
    expect(groupCategories(cats, games, 2)[0].games).toHaveLength(2);
  });
});

describe('browse', () => {
  const cats = [{ id: 'x', title: 'Evolution' }, { id: 'y', title: 'Reward' }];
  const games = [
    fake('b', { title: 'Alpha', category: 'x', lesson: 'Overfitting', added: '2026-01-01' }),
    fake('a', { title: 'Zulu', category: 'y', lesson: 'Loopholes', added: '2026-03-01' }),
  ];
  it('searches title, lesson and category title, case-insensitively', () => {
    expect(browse(games, cats, { q: 'ALPHA' }).items.map(g => g.id)).toEqual(['b']);
    expect(browse(games, cats, { q: 'overfit' }).items.map(g => g.id)).toEqual(['b']);
    expect(browse(games, cats, { q: 'reward' }).items.map(g => g.id)).toEqual(['a']);
  });
  it('filters by category', () => expect(browse(games, cats, { category: 'y' }).items.map(g => g.id)).toEqual(['a']));
  it('sorts newest or a to z', () => {
    expect(browse(games, cats, {}).items.map(g => g.id)).toEqual(['a', 'b']);
    expect(browse(games, cats, { sort: 'az' }).items.map(g => g.id)).toEqual(['b', 'a']);
  });
  it('pages 30 games into 2 pages of 24 and clamps the page', () => {
    const many = Array.from({ length: 30 }, (_, i) => fake('g' + i, { title: 'G' + String(i).padStart(2, '0') }));
    const r = browse(many, cats, {});
    expect([r.total, r.pages, r.items.length, r.page]).toEqual([30, 2, 24, 1]);
    const r2 = browse(many, cats, { page: 9 });
    expect([r2.page, r2.items.length]).toEqual([2, 6]);
    expect(browse(many, cats, { page: -3 }).page).toBe(1);
  });
  it('returns total 0 for no match', () => {
    const r = browse(games, cats, { q: 'zzz' });
    expect([r.total, r.items.length, r.page]).toEqual([0, 0, 1]);
    expect(r.pages).toBe(1);
  });
});

describe('physical-ai and balance', () => {
  it('physical-ai category exists with a lead', () => {
    const c = CATEGORIES.find(c => c.id === 'physical-ai');
    expect(c.title).toBe('Physical AI');
    expect(c.lead).toBe('How robots learn to move, sense and act in the physical world.');
  });
  it('balance entry', () => {
    const g = gameById('balance');
    expect(g).toMatchObject({ title: 'Balance', category: 'physical-ai', youtube: 'ui3l3xSUZ4U', path: 'games/balance/', writeup: 'games/balance/how-it-works/', shot: 'games/balance/shot.jpg' });
    expect(g.lesson).toMatch(/Teaches feedback control, PID, evolution and disturbances\.$/);
  });
  it('the real hero is Balance, the newest game with a video and a demo', () => {
    expect(homeModel(CATEGORIES, GAMES).hero.id).toBe('balance');
  });
});

describe('home demo config', () => {
  const FIELDS = ['net', 'learns', 'panel', 'alt'];
  it('the hero has a demo block of words', () => {
    const { demo } = homeModel(CATEGORIES, GAMES).hero;
    for (const f of FIELDS) expect(demo[f].length, f).toBeGreaterThan(0);
  });
  it('every game with a demo has games/<id>/demo.js and all its words', () => {
    for (const g of GAMES.filter(g => g.demo)) {
      expect(existsSync(new URL(`../games/${g.id}/demo.js`, import.meta.url)), g.id).toBe(true);
      for (const f of FIELDS) expect(g.demo[f], `${g.id}.${f}`).toMatch(/\S/);
    }
  });
  it('Coin Runner and Balance have demos; Racer and Teach do not yet', () => {
    expect(gameById('runner').demo.panel).toBe('Its four moves, right now');
    expect(gameById('balance').demo.net).toBe('4 inputs, 6 hidden, 1 push');
    expect(gameById('racer').demo).toBeNull();
    expect(gameById('teach').demo).toBeNull();
  });
});

describe('homeModel', () => {
  const cats = [{ id: 'x', title: 'X' }, { id: 'y', title: 'Y' }, { id: 'empty', title: 'Empty' }];
  const games = [
    fake('a', { category: 'x', added: '2026-01-01' }),
    fake('b', { category: 'x', added: '2026-03-01' }),
    fake('c', { category: 'x', added: '2026-02-01' }),
    fake('d', { category: 'y', added: '2026-02-15' }),
  ];
  const m = homeModel(cats, games);
  it('hero is the newest game overall', () => expect(m.hero.id).toBe('b'));
  it('hero is the newest game that has a youtube id', () => {
    const demo = { net: '', learns: '', panel: '', alt: '' };
    const withVideo = [...games, fake('e', { added: '2026-04-01' }), fake('f', { added: '2026-05-01', youtube: 'abcdefghijk', demo }), fake('g', { added: '2026-06-01', youtube: null, demo })];
    expect(homeModel(cats, withVideo).hero.id).toBe('f');
  });
  it('a game with a video but no demo is never the hero', () => {
    const demo = { net: '', learns: '', panel: '', alt: '' };
    const g = [fake('old', { added: '2026-01-01', youtube: 'abcdefghijk', demo }), fake('new', { added: '2026-05-01', youtube: 'abcdefghijk', demo: null })];
    expect(homeModel(cats, g).hero.id).toBe('old');
  });
  it('with no video game, the hero is the newest game that has a demo', () => {
    const demo = { net: 'n', learns: 'l', panel: 'p', alt: 'a' };
    const g = [fake('withDemo', { added: '2026-01-01', demo }), fake('newer', { added: '2026-05-01', demo: null })];
    expect(homeModel(cats, g).hero.id).toBe('withDemo');
  });
  it('a category has its newest as big and the others newest-first in rest', () => {
    expect(m.categories[0].big.id).toBe('b');
    expect(m.categories[0].rest.map(g => g.id)).toEqual(['c', 'a']);
  });
  it('leaves empty categories out of categories and chips', () => {
    expect(m.categories.map(c => c.category.id)).toEqual(['x', 'y']);
    expect(m.chips.map(c => c.id)).toEqual(['x', 'y']);
  });
  it('flags the New badge only on the newest game overall', () => {
    expect(m.categories.map(c => c.bigIsNew)).toEqual([true, false]);
  });
});

describe('categoryModel', () => {
  const cats = [{ id: 'x', title: 'X' }, { id: 'y', title: 'Y' }, { id: 'empty', title: 'Empty' }];
  const games = [
    fake('a', { category: 'x', added: '2026-01-01' }),
    fake('b', { category: 'x', added: '2026-03-01' }),
    fake('c', { category: 'x', added: '2026-01-01', title: 'Zed' }),
    fake('d', { category: 'y', added: '2026-02-15' }),
  ];
  it('is null for an unknown id', () => expect(categoryModel(cats, games, 'nope')).toBeNull());
  it('lists games newest first', () => {
    expect(categoryModel(cats, games, 'x').games.map(g => g.id)).toEqual(['b', 'a', 'c']);
  });
  it('first is the oldest, ties by title', () => {
    expect(categoryModel(cats, games, 'x').first.id).toBe('a');
  });
  it('others excludes the current and empty categories', () => {
    expect(categoryModel(cats, games, 'x').others.map(c => c.id)).toEqual(['y']);
  });
});

describe('moreFrom', () => {
  const a = fake('a', { added: '2026-01-01' }), b = fake('b', { added: '2026-03-01' }), c = fake('c', { added: '2026-02-01' });
  const other = fake('o', { category: 'elsewhere', added: '2026-04-01' });
  it('lists the same category, newest first, without the game itself', () => {
    expect(moreFrom(a, [a, b, c, other]).map(g => g.id)).toEqual(['b', 'c']);
  });
  it('caps at max (default 3)', () => {
    const many = Array.from({ length: 6 }, (_, i) => fake('g' + i, { added: `2026-01-0${i + 1}` }));
    expect(moreFrom(a, [a, ...many])).toHaveLength(3);
    expect(moreFrom(a, [a, ...many], 2)).toHaveLength(2);
  });
  it('is empty when the game is alone in its category', () => {
    expect(moreFrom(a, [a, other])).toEqual([]);
  });
});

describe('reinforcement learning and the maze', () => {
  it('Coin Runner is in reinforcement learning; the first two stay in How AI learns', () => {
    expect(gameById('runner').category).toBe('reinforcement-learning');
    expect(GAMES.filter(g => g.category === 'how-ai-learns').map(g => g.id)).toEqual(['racer', 'teach']);
  });
  it('the category exists with a lead', () => {
    const c = CATEGORIES.find(c => c.id === 'reinforcement-learning');
    expect(c.title).toBe('Reinforcement learning');
    expect(c.lead.length).toBeGreaterThan(0);
  });
  it('maze entry has every field, no video yet, and its category exists', () => {
    const g = gameById('maze');
    expect(g).toMatchObject({ title: 'Treasure Maze', category: 'reinforcement-learning', path: 'games/maze/', writeup: 'games/maze/how-it-works/', shot: 'games/maze/shot.jpg', youtube: null, demo: null });
    for (const f of FIELDS) expect(g[f].length, f).toBeGreaterThan(0);
    expect(g.lesson).toMatch(/Teaches reward, value, the discount and exploring\.$/);
    expect(CATEGORIES.map(c => c.id)).toContain(g.category);
  });
  it('its category page model lists the maze, and the home hero stays Balance', () => {
    const m = categoryModel(CATEGORIES, GAMES, 'reinforcement-learning');
    expect(m).not.toBeNull();
    expect(m.games.map(g => g.id)).toContain('maze');
    expect(homeModel(CATEGORIES, GAMES).hero.id).toBe('balance');
  });
});
