import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { categoryTarget, conceptsTarget } from '../assets/redirects.js';

describe('old page redirects', () => {
  it('category targets the matching track, else All games', () => {
    expect(categoryTarget('?c=how-ai-learns')).toBe('neural-networks/');
    expect(categoryTarget('?c=physical-ai')).toBe('physical-ai/');
    expect(categoryTarget('?c=reinforcement-learning')).toBe('reinforcement-learning/');
    expect(categoryTarget('?c=nope')).toBe('games/');
    expect(categoryTarget('')).toBe('games/');
  });
  it('concepts targets a live lesson page, else home', () => {
    expect(conceptsTarget('#pid')).toBe('concepts/pid/');
    expect(conceptsTarget('#sarsa')).toBe('');
    expect(conceptsTarget('#nonsense')).toBe('');
    expect(conceptsTarget('')).toBe('');
  });
  it('both stubs refresh, are noindex and point their canonical at the home page', () => {
    for (const f of ['category/index.html', 'concepts/index.html']) {
      const html = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
      expect(html, f).toContain('http-equiv="refresh"');
      expect(html, f).toContain('noindex');
      expect(html, f).toContain('<link rel="canonical" href="https://arcade.codewithnk.com/">');
      expect(html, f).toContain('redirects.js');
    }
  });
});
