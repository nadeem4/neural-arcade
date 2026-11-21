import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const v = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const cc = src => v.headers.find(h => h.source === src)?.headers.find(x => x.key === 'Cache-Control')?.value;

describe('vercel.json cache headers', () => {
  it('caches models and the vendored three.js for a week, not immutable', () => {
    const week = 'public, max-age=604800, stale-while-revalidate=86400';
    expect(cc('/games/treasure-room/models/(.*)')).toBe(week);
    expect(cc('/assets/vendor/(.*)')).toBe(week);
    expect(cc('/games/treasure-room/models/(.*)')).not.toMatch(/immutable/);
  });
  it('keeps the font entry', () => {
    expect(v.headers.some(h => /fonts/.test(h.source))).toBe(true);
  });
});
