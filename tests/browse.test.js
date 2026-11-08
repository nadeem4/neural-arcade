import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseQuery, toQuery, rowHtml, chipsHtml, pagerHtml } from '../assets/browse.js';

describe('browse url state', () => {
  it('has defaults', () => {
    expect(parseQuery('')).toEqual({ q: '', category: '', sort: 'newest', page: 1 });
  });
  it('reads every field', () => {
    expect(parseQuery('?q=reward&c=how-ai-learns&sort=az&page=3'))
      .toEqual({ q: 'reward', category: 'how-ai-learns', sort: 'az', page: 3 });
  });
  it('falls back to newest for an invalid sort', () => {
    expect(parseQuery('?sort=zzz').sort).toBe('newest');
  });
  it('falls back to page 1 for 0 or abc', () => {
    expect(parseQuery('?page=0').page).toBe(1);
    expect(parseQuery('?page=abc').page).toBe(1);
  });
  it('omits defaults from the query', () => {
    expect(toQuery({ q: '', category: '', sort: 'newest', page: 1 })).toBe('');
    expect(toQuery({ q: 'a b', category: '', sort: 'az', page: 1 })).toBe('?q=a+b&sort=az');
  });
  it('round trips', () => {
    const s = '?q=a+b&c=x&sort=az&page=2';
    expect(toQuery(parseQuery(s))).toBe(s);
  });
});

const page = readFileSync(new URL('../games/index.html', import.meta.url), 'utf8');
const g = { id: 'x', title: 'X <Game>', lesson: 'Teaches x.', category: 'c', shot: 'games/x/shot.jpg', path: 'games/x/', youtube: null };
const cats = [{ id: 'c', title: 'Cat C' }];

describe('browse page markup', () => {
  it('has the search, sort, chips, results, pager and empty state with a Clear button', () => {
    for (const id of ['q', 'sort', 'chips', 'list', 'pager', 'empty', 'clear']) expect(page, id).toContain(`id="${id}"`);
    expect(page).toMatch(/<input[^>]*id="q"/);
    expect(page).toMatch(/<select[^>]*id="sort"/);
    expect(page).toMatch(/<button[^>]*id="clear"/);
    expect(page).toContain('data-site="games"');
  });
  it('has no status labels', () => {
    expect(page).not.toMatch(/Coming soon|Playable|Videos/);
  });
});

describe('browse renderers', () => {
  it('renders a row with escaped title, category label and link under the base', () => {
    const h = rowHtml(g, cats, '../');
    expect(h).toContain('X &lt;Game&gt;');
    expect(h).toContain('Cat C');
    expect(h).toContain('href="../games/x/"');
    expect(h).toContain('src="../games/x/shot.jpg"');
  });
  it('shows a video badge only when youtube is set', () => {
    expect(rowHtml(g, cats, '')).not.toMatch(/video/i);
    expect(rowHtml({ ...g, youtube: 'abc' }, cats, '')).toMatch(/Video/);
  });
  it('renders chips with the active one pressed', () => {
    const h = chipsHtml(cats, 'c');
    expect(h).toMatch(/data-c=""[^>]*aria-pressed="false"[^>]*>All/);
    expect(h).toMatch(/data-c="c"[^>]*aria-pressed="true"[^>]*>Cat C/);
  });
  it('renders a pager only when there is more than one page', () => {
    expect(pagerHtml(1, 1)).toBe('');
    const h = pagerHtml(2, 3);
    expect(h).toContain('data-page="1"');
    expect(h).toContain('data-page="3"');
    expect(h).toContain('aria-current="page"');
  });
});
