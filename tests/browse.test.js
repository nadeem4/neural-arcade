import { describe, it, expect } from 'vitest';
import { parseQuery, toQuery } from '../assets/browse.js';

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
