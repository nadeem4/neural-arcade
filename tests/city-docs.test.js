import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const claude = readFileSync(new URL('CLAUDE.md', root), 'utf8');
const line = claude.split('\n').find(l => l.startsWith('- games/city/ ('));
const gameFiles = line.slice(0, line.indexOf('scripts/city/:'));

describe('CLAUDE.md Layout for games/city/', () => {
  it('lists every game file that exists', () => {
    const files = readdirSync(new URL('games/city/', root)).filter(f => /\.(js|css|html)$/.test(f));
    for (const f of files) expect(gameFiles, f).toContain(f);
  });
  it('names no game file that is gone', () => {
    const names = [...gameFiles.matchAll(/\b([a-z][a-z0-9-]*\.(?:js|json|css|html|png|jpg))\b/g)].map(m => m[1]);
    for (const n of names) {
      if (n === 'three.js') continue;
      const there = existsSync(new URL('games/city/' + n, root)) || existsSync(new URL('games/city/vendor/' + n, root));
      expect(there, n).toBe(true);
    }
  });
});
