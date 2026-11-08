import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { headerHtml, footerHtml } from '../assets/site.js';
import { GAMES } from '../assets/games.js';
import { heroActionsHtml, categoryHtml, chipsHtml } from '../assets/home-view.js';

const css = readFileSync(new URL('../assets/studio.css', import.meta.url), 'utf8');
const themeJs = readFileSync(new URL('../assets/theme.js', import.meta.url), 'utf8');

const names = block => new Set([...block.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
const light = names(css.match(/:root\s*\{([^}]*)\}/)[1]);
const darkMedia = names(css.match(/@media not \(prefers-color-scheme:\s*light\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/)[1]);
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
  it('logo links to ./ when base is empty', () => expect(headerHtml('', '')).toContain('class="logo" href="./"'));
  it('has the lamp button', () => expect(headerHtml('', '')).toContain('id="lamp"'));
  it('footer keeps the credit and the codewithnk link', () => {
    const f = footerHtml();
    expect(f).toContain('Built by Nadeem.');
    expect(f).toContain('<a href="https://www.codewithnk.com">codewithnk.com</a>');
  });
});

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const game = (o = {}) => ({ id: 'g', title: 'Gee', learnsBy: 'Things', shot: 'games/g/shot.jpg', path: 'games/g/', youtube: null, ...o });
const cat = { id: 'c', title: 'Cee', lead: 'Lead text.' };

describe('home page', () => {
  const html = read('index.html');
  it('has no status words', () => {
    for (const w of ['Coming soon', 'Playable', 'Videos']) expect(html).not.toContain(w);
  });
  it('loads home.js and links to browse every game', () => {
    expect(html).toContain('src="assets/home.js"');
    expect(html).toMatch(/<a [^>]*href="games\/"[^>]*>Browse every game</);
  });
  it('keeps heading levels in order and the recorded-run dot still', () => {
    const levels = [...html.matchAll(/<h([1-6])[ >]/g)].map(m => +m[1]);
    levels.forEach((l, i) => expect(l - (levels[i - 1] ?? 0), 'h' + l).toBeLessThanOrEqual(1));
    expect(css).not.toContain('pulse');
  });
  it('about page uses the shared header and footer', () => {
    const about = read('about/index.html');
    expect(about).toContain('<header data-site="about">');
    expect(about).toContain('<footer data-site>');
    expect(about).toContain('studio.css');
  });
});

describe('home rendering', () => {
  it('hero shows Watch the explainer only when the game has a video', () => {
    expect(heroActionsHtml(game())).not.toContain('Watch');
    const h = heroActionsHtml(game({ youtube: 'abc' }));
    expect(h).toContain('href="games/g/#watch"');
    expect(h).toContain('Play Gee');
  });
  it('category block links tiles by path, badges only the new big tile, and gates the explainer link', () => {
    const plain = categoryHtml({ category: cat, big: game(), rest: [game({ id: 'h', title: 'Aitch', path: 'games/h/' })], bigIsNew: false });
    expect(plain).toContain('href="games/h/"');
    expect(plain).not.toContain('badge');
    expect(plain).not.toContain('Watch');
    const fresh = categoryHtml({ category: cat, big: game({ youtube: 'abc' }), rest: [], bigIsNew: true });
    expect(fresh).toContain('badge');
    expect(fresh).toContain('href="category/?c=c"');
    expect(fresh).toContain('href="games/g/#watch"');
  });
  it('chips link each category and end with Browse every game', () => {
    const c = chipsHtml([cat]);
    expect(c).toContain('Cee');
    expect(c).toContain('href="category/?c=c"');
    expect(c).not.toContain('games/?category');
    expect(c).toContain('Browse every game');
  });
});

describe('review fixes', () => {
  it('every game with a youtube id has id="watch" on its page', () => {
    for (const g of GAMES.filter(g => g.youtube)) expect(read(g.path + 'index.html'), g.id).toContain('id="watch"');
  });
  it('about has three paragraphs and no counts', () => {
    const main = read('about/index.html').match(/<main[\s\S]*<\/main>/)[0];
    expect(main.match(/<p>/g)).toHaveLength(3);
    expect(main.replace(/<[^>]*>/g, '')).not.toMatch(/\d/);
  });
  it('category blocks are sections', () => {
    expect(categoryHtml({ category: cat, big: game(), rest: [], bigIsNew: false })).toMatch(/^<section class="shelf"/);
  });
  it('demo canvas stays pixelated and the stage title is static', () => {
    expect(css).toMatch(/\.scene canvas\s*\{[^}]*image-rendering:\s*pixelated/);
    expect(read('assets/home.js')).not.toContain('stage-title');
  });
});
