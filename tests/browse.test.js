import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseQuery, toQuery, rowHtml, chipsHtml, pagerHtml } from '../assets/browse.js';
import { TRACKS } from '../assets/tracks/index.js';
import { gameById } from '../assets/games.js';

describe('browse url state', () => {
  it('has defaults', () => {
    expect(parseQuery('')).toEqual({ q: '', track: '', sort: 'newest', page: 1 });
  });
  it('reads every field, the track from t', () => {
    expect(parseQuery('?q=reward&t=physical-ai&sort=az&page=3'))
      .toEqual({ q: 'reward', track: 'physical-ai', sort: 'az', page: 3 });
    expect(parseQuery('?t=physical-ai&q=pole')).toMatchObject({ track: 'physical-ai', q: 'pole' });
  });
  it('keeps t only when it is a real track id', () => {
    expect(parseQuery('?t=nope').track).toBe('');
    expect(parseQuery('?t=physical-ai').track).toBe('physical-ai');
  });
  it('ignores the old c key', () => {
    expect(parseQuery('?c=physical-ai').track).toBe('');
  });
  it('falls back to newest for an invalid sort', () => {
    expect(parseQuery('?sort=zzz').sort).toBe('newest');
  });
  it('falls back to page 1 for 0 or abc', () => {
    expect(parseQuery('?page=0').page).toBe(1);
    expect(parseQuery('?page=abc').page).toBe(1);
  });
  it('omits defaults from the query', () => {
    expect(toQuery({ q: '', track: '', sort: 'newest', page: 1 })).toBe('');
    expect(toQuery({ q: '', track: 'physical-ai', sort: 'newest', page: 1 })).toBe('?t=physical-ai');
    expect(toQuery({ q: 'a b', track: '', sort: 'az', page: 1 })).toBe('?q=a+b&sort=az');
  });
  it('round trips', () => {
    const s = '?q=a+b&t=physical-ai&sort=az&page=2';
    expect(toQuery(parseQuery(s))).toBe(s);
  });
});

const page = readFileSync(new URL('../games/index.html', import.meta.url), 'utf8');
const g = { id: 'x', title: 'X <Game>', lesson: 'Teaches x.', shot: 'games/x/shot.jpg', path: 'games/x/', youtube: null };
const tracks = [{ id: 'c', title: 'Track C', parts: [{ title: 'p', lessons: [{ id: 'l', title: 'L', game: 'x', status: 'live' }] }] }];

describe('browse page markup', () => {
  it('has the search, sort, chips, results, pager and empty state with a Clear button', () => {
    for (const id of ['q', 'sort', 'chips', 'list', 'pager', 'empty', 'clear']) expect(page, id).toContain(`id="${id}"`);
    expect(page).toMatch(/<input[^>]*id="q"/);
    expect(page).toMatch(/<select[^>]*id="sort"/);
    expect(page).toMatch(/<button[^>]*id="clear"/);
    expect(page).toContain('data-site="games"');
  });
  it('is titled All games', () => {
    expect(page).toContain('<title>All games · Neural Arcade</title>');
    expect(page).toContain('<h1 id="bh">All games</h1>');
    expect(page).not.toContain('Every game');
    expect(page).toContain('aria-label="Track"');
  });
  it('has no status labels', () => {
    expect(page).not.toMatch(/Coming soon|Playable|Videos/);
  });
});

describe('browse renderers', () => {
  it('renders a row with escaped title, track title and link under the base', () => {
    const h = rowHtml(g, tracks, '../');
    expect(h).toContain('X &lt;Game&gt;');
    expect(h).toContain('Track C');
    expect(h).toContain('href="../games/x/"');
    expect(h).toContain('src="../games/x/shot.jpg"');
  });
  it('lists every track that names the game', () => {
    expect(rowHtml(gameById('balance'), TRACKS, '')).toContain('Physical AI');
  });
  it('shows a video badge only when youtube is set', () => {
    expect(rowHtml(g, tracks, '')).not.toMatch(/video/i);
    expect(rowHtml({ ...g, youtube: 'abc' }, tracks, '')).toMatch(/Video/);
  });
  it('renders All and one chip per track, the active one pressed', () => {
    const h = chipsHtml(tracks, 'c');
    expect(h).toMatch(/data-t=""[^>]*aria-pressed="false"[^>]*>All/);
    expect(h).toMatch(/data-t="c"[^>]*aria-pressed="true"[^>]*>Track C/);
    expect(chipsHtml(TRACKS, '').match(/data-t=/g)).toHaveLength(4);
  });
  it('renders a pager only when there is more than one page', () => {
    expect(pagerHtml(1, 1)).toBe('');
    const h = pagerHtml(2, 3);
    expect(h).toContain('data-page="1"');
    expect(h).toContain('data-page="3"');
    expect(h).toContain('aria-current="page"');
  });
});

const levels = html => [...html.matchAll(/<h([1-6])[\s>]/g)].map(m => +m[1]);
const noSkips = ls => ls.every((l, i) => i === 0 || l <= ls[i - 1] + 1);

describe('accessibility', () => {
  it('browse page headings go h1 then h2 with no skips, rows included', () => {
    const ls = levels(page + rowHtml(g, tracks, ''));
    expect(ls[0]).toBe(1);
    expect(noSkips(ls)).toBe(true);
    expect(levels(rowHtml(g, tracks, ''))).toEqual([2]);
  });
  it('labels the search input and keeps aria-live off the whole results section', () => {
    expect(page).toMatch(/<label class="search"[^>]*>.*<span class="sr">Search games<\/span>/);
    expect(page).not.toMatch(/<section[^>]*aria-live/);
    expect(page).toMatch(/id="status"[^>]*aria-live="polite"/);
  });
});
