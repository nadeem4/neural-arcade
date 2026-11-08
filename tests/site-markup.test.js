import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { headerHtml, footerHtml } from '../assets/site.js';

const css = readFileSync(new URL('../assets/studio.css', import.meta.url), 'utf8');
const themeJs = readFileSync(new URL('../assets/theme.js', import.meta.url), 'utf8');

const names = block => new Set([...block.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
const light = names(css.match(/:root\s*\{([^}]*)\}/)[1]);
const darkMedia = names(css.match(/@media \(prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/)[1]);
const darkAttr = names(css.match(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/)[1]);

const LIGHT = ['bg', 'surface', 'ink', 'ink-2', 'line', 'track', 'stage', 'stage-2', 'stage-ink', 'stage-dim',
  'signal', 'signal-ink', 'ok', 'bad', 'coin', 'ghost', 'sans', 'mono', 'wrap'];
const DARK = ['bg', 'surface', 'ink', 'ink-2', 'line', 'track', 'stage', 'stage-2'];

describe('studio.css tokens', () => {
  it('defines every mockup token in the light root', () => {
    for (const t of LIGHT) expect(light.has('--' + t), t).toBe(true);
  });
  it('overrides the dark tokens in both dark blocks', () => {
    for (const t of DARK) {
      expect(darkMedia.has('--' + t), 'media ' + t).toBe(true);
      expect(darkAttr.has('--' + t), 'attr ' + t).toBe(true);
    }
  });
  it('defines every key theme.js reads, plus --body', () => {
    const keys = [...themeJs.match(/const KEYS = \[([^\]]*)\]/)[1].matchAll(/'([\w-]+)'/g)].map(m => m[1]);
    for (const k of [...keys, 'body']) expect(light.has('--' + k), k).toBe(true);
  });
  it('points each @font-face at a file that exists, with font-display swap', () => {
    const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(m => m[1]);
    expect(faces.length).toBeGreaterThan(0);
    for (const f of faces) {
      expect(f).toMatch(/font-display:\s*swap/);
      const file = f.match(/url\("([^"]+)"\)/)[1];
      expect(existsSync(new URL('../assets/' + file, import.meta.url)), file).toBe(true);
    }
  });
});

describe('shared header and footer', () => {
  it('header links Games and About, not Videos', () => {
    const h = headerHtml('', 'games');
    expect(h).toContain('>Games</a>');
    expect(h).toContain('>About</a>');
    expect(h).not.toContain('Videos');
  });
  it('marks the current page', () => {
    expect(headerHtml('', 'about')).toMatch(/aria-current="page"[^>]*>About</);
    expect(headerHtml('', '')).not.toContain('aria-current');
  });
  it('base prefixes every href', () => {
    const hrefs = [...headerHtml('../../', 'games').matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const h of hrefs) expect(h.startsWith('../../')).toBe(true);
  });
  it('has the lamp button', () => expect(headerHtml('', '')).toContain('id="lamp"'));
  it('footer keeps the credit and the codewithnk link', () => {
    const f = footerHtml();
    expect(f).toContain('Built by Nadeem.');
    expect(f).toContain('<a href="https://www.codewithnk.com">codewithnk.com</a>');
  });
});
