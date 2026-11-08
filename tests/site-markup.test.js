import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { headerHtml, footerHtml } from '../assets/site.js';
import { GAMES } from '../assets/games.js';
import { videoHtml, crumbHtml, moreFromHtml, writeupHref } from '../assets/game-page.js';
import { heroActionsHtml, categoryHtml, chipsHtml } from '../assets/home-view.js';

const css = readFileSync(new URL('../assets/studio.css', import.meta.url), 'utf8');
const themeJs = readFileSync(new URL('../assets/theme.js', import.meta.url), 'utf8');

const names = block => new Set([...block.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
const light = names(css.match(/:root\s*\{([^}]*)\}/)[1]);
const darkMedia = names(css.match(/@media not \(prefers-color-scheme:\s*light\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/)[1]);
const darkAttr = names(css.match(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/)[1]);

const LIGHT = ['bg', 'surface', 'ink', 'ink-2', 'line', 'track', 'stage', 'stage-2', 'stage-ink', 'stage-dim',
  'signal', 'signal-text', 'signal-ink', 'ghost', 'sans', 'mono', 'wrap'];
const DARK = ['bg', 'surface', 'ink', 'ink-2', 'line', 'track', 'stage', 'stage-2', 'signal-text'];

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
  it('every game with a youtube id gets a video box with id="watch"', () => {
    for (const g of GAMES.filter(g => g.youtube)) expect(videoHtml(g), g.id).toContain('id="watch"');
  });
  it('about has three paragraphs and no counts', () => {
    const main = read('about/index.html').match(/<main[\s\S]*<\/main>/)[0];
    expect(main.match(/<p>/g)).toHaveLength(3);
    expect(main.replace(/<[^>]*>/g, '')).not.toMatch(/\d/);
  });
  it('category blocks are sections', () => {
    expect(categoryHtml({ category: cat, big: game(), rest: [], bigIsNew: false })).toMatch(/^<section class="category"/);
  });
  it('demo canvas stays pixelated and the stage title is static', () => {
    expect(css).toMatch(/\.scene canvas\s*\{[^}]*image-rendering:\s*pixelated/);
    expect(read('assets/home.js')).not.toContain('stage-title');
  });
});

describe('tile layout', () => {
  it('small tiles stack from the top', () => {
    expect(css).toMatch(/\.tile\s*\{[^}]*align-content:\s*start/);
    expect(css).toMatch(/\.tile\s*\{[^}]*align-self:\s*start/);
  });
});

describe('signal-text contrast', () => {
  const lum = hex => {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
  const val = n => css.match(/:root\s*\{([^}]*)\}/)[1].match(new RegExp(n + '\\s*:\\s*(#[0-9A-Fa-f]{6})'))[1];
  it('reaches 4.5:1 on the light bg and surface', () => {
    expect(ratio(val('--signal-text'), val('--bg'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(val('--signal-text'), val('--surface'))).toBeGreaterThanOrEqual(4.5);
  });
  it('filled orange buttons and badges reach 4.5:1 with white text', () => {
    expect(ratio(val('--signal-fill'), val('--signal-ink'))).toBeGreaterThanOrEqual(4.5);
    expect(css).toMatch(/\.btn\.primary\s*\{[^}]*background:\s*var\(--signal-fill\)/);
    expect(css).toMatch(/\.tile \.badge\s*\{[^}]*background:\s*var\(--signal-fill\)/);
  });
  it('is used for the small orange text', () => {
    expect(css).toMatch(/\.facts dd\.warn\s*\{[^}]*var\(--signal-text\)/);
    expect(css).toMatch(/\.row \.meta b\s*\{[^}]*var\(--signal-text\)/);
  });
});

const PAGES = ['runner', 'racer', 'teach'];
describe.each(PAGES)('game page contract (%s)', id => {
  const html = read(`games/${id}/index.html`);
  const entry = GAMES.find(g => g.id === id);
  const everywhere = html + headerHtml('../../', 'games') + footerHtml() + videoHtml(entry);
  it('has every id that main.js looks up', () => {
    const js = read(`games/${id}/main.js`);
    const ids = [...js.matchAll(/(?:\$|getElementById)\('([\w-]+)'\)/g)].map(m => m[1]);
    expect(ids.length).toBeGreaterThan(10);
    for (const i of ids) expect(everywhere, i).toContain(`id="${i}"`);
  });
  it('labels sections by a heading span, never a heading holding the (i) button', () => {
    for (const m of html.matchAll(/aria-labelledby="([\w-]+)"/g)) {
      if (m[1] === 'moreTitle') continue;
      const tag = html.match(new RegExp('<(\\w+) id="' + m[1] + '"[^>]*>([\\s\\S]*?)</\\1>'));
      expect(tag, m[1]).not.toBeNull();
      expect(tag[2], m[1]).not.toContain('<button');
    }
  });
  it('keeps body text at line-height 1.5 or more', () => {
    for (const m of html.matchAll(/line-height:\s*([\d.]+)/g)) expect(+m[1]).toBeGreaterThanOrEqual(1.5);
  });
  it('has the Play / Watch / How it works switch', () => {
    const nav = html.match(/<nav class="switch"[\s\S]*?<\/nav>/)[0];
    for (const a of ['#play', '#watch', '#how']) expect(nav, a).toContain(`href="${a}"`);
    for (const i of ['play', 'how']) expect(html, i).toContain(`id="${i}"`);
  });
  it('has the three-part brief', () => {
    for (const t of ['The setup', 'The rule', 'Watch for']) expect(html, t).toContain(`<dt>${t}</dt>`);
  });
  it('is driven by data-game, with no video of its own', () => {
    expect(html).toContain(`<body data-game="${id}">`);
    expect(html).not.toContain('data-youtube');
    expect(html).not.toContain('video-thumb');
  });
  it('hides the Watch item and column until game-page.js finds a video', () => {
    expect(html).toMatch(/<a [^>]*href="#watch"[^>]*hidden/);
    expect(html).toMatch(/id="watchCol"[^>]*hidden/);
  });
  it('points every aria-controls at an existing id', () => {
    for (const m of html.matchAll(/aria-controls="([\w-]+)"/g)) expect(html, m[1]).toContain(`id="${m[1]}"`);
  });
  it('shows the lesson from games.js, and the lesson band links to the write-up', () => {
    expect(html.match(/class="lead lesson">([^<]*)</)[1]).toBe(entry.lesson);
    expect(html).toMatch(/class="moral"[\s\S]*href="#how"/);
  });
  it('keeps heading levels in order and has no status words', () => {
    const levels = [...html.matchAll(/<h([1-6])[ >]/g)].map(m => +m[1]);
    levels.forEach((l, i) => expect(l - (levels[i - 1] ?? 0), 'h' + l).toBeLessThanOrEqual(1));
    for (const w of ['Coming soon', 'Playable']) expect(html).not.toContain(w);
  });
  it('loads the studio look, the shared game css, game-page.js and only its own css', () => {
    expect(html).toContain('assets/studio.css');
    expect(html).toContain('assets/game.css');
    expect(html).toContain('assets/game-page.js');
    expect(html).toContain(`href="${id}.css"`);
    expect(html).not.toContain('arcade.css');
    for (const o of PAGES.filter(o => o !== id)) expect(html, o).not.toContain(`${o}.css`);
  });
  it('uses no coloured side stripes in its css', () => {
    for (const f of ['assets/game.css', `games/${id}/${id}.css`]) {
      expect(read(f), f).not.toMatch(/border-(left|right):\s*\d+px solid var\(--(signal|amber|ok|coin|red)/);
    }
  });
});

describe('game page specifics', () => {
  it('runner: every play panel has an info button, and the preset and speed buttons are there', () => {
    const html = read('games/runner/index.html');
    const top = html.split('class="moral"')[0].split('<main')[1];
    const headings = [...top.matchAll(/<h2[\s\S]*?<\/h2>/g)].map(m => m[0]);
    expect(headings.length).toBe(4);
    for (const h of headings) expect(h).toContain('class="info"');
    expect(html.match(/data-preset="/g)).toHaveLength(3);
    expect(html.match(/data-rate="/g)).toHaveLength(3);
  });
  it('racer: speed and population buttons, family tree, last round card', () => {
    const html = read('games/racer/index.html');
    expect(html.match(/data-speed="/g)).toHaveLength(3);
    expect(html.match(/data-pop="/g)).toHaveLength(4);
    for (const i of ['pedigree', 'round', 'roundBody', 'pause', 'follow', 'ghost']) expect(html, i).toContain(`id="${i}"`);
  });
  it('teach: steering buttons, three steps, loss chart', () => {
    const html = read('games/teach/index.html');
    for (const i of ['left', 'right', 'phTeach', 'phTrain', 'phTest', 'chart', 'lr']) expect(html, i).toContain(`id="${i}"`);
  });
  it('amber-ink text meets contrast on the light surface', () => {
    expect(css).toMatch(/--amber-ink:\s*var\(--signal-text\)/);
  });
  it('no stylesheet uses a custom property that nothing defines', () => {
    const files = ['assets/studio.css', 'assets/game.css', ...PAGES.map(i => `games/${i}/${i}.css`)];
    const all = files.map(read).join('\n');
    const defined = new Set([...all.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
    defined.add('--row-gap'); // set inline on the family tree svg
    const used = [...all.matchAll(/var\((--[\w-]+)/g)].map(m => m[1]);
    for (const u of used) expect(defined.has(u), u).toBe(true);
  });
});


describe('game page rendering', () => {
  const g = { id: 'g', title: 'Gee', youtube: 'abcdefghijk', writeup: 'games/g/how-it-works/' };
  it('builds no video box without a youtube id', () => expect(videoHtml({ ...g, youtube: null })).toBe(''));
  it('builds the click-to-play box from the youtube id alone', () => {
    const v = videoHtml(g);
    expect(v).toContain('id="watch"');
    expect(v).toContain('data-youtube="abcdefghijk"');
    expect(v).toContain('data-title="Gee: how it learns"');
    expect(v).toContain('src="https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg"');
    expect(v).toContain('Watch: how it learns');
    expect(v).toContain('class="video-play"');
  });
  it('links the write-up and the category crumb from the site root', () => {
    expect(writeupHref(g, '../../')).toBe('../../games/g/how-it-works/');
    const c = crumbHtml({ title: 'Gee', category: 'c' }, [{ id: 'c', title: 'Cee' }], '../../');
    expect(c).toContain('<a href="../../category/?c=c">Cee</a>');
    expect(c).toContain('Gee');
  });
  it('renders More from tiles, and nothing when alone', () => {
    const t = moreFromHtml([{ title: 'Aitch', path: 'games/h/', shot: 'games/h/shot.jpg', learnsBy: 'Things' }], '../../');
    expect(t).toContain('href="../../games/h/"');
    expect(t).toContain('src="../../games/h/shot.jpg"');
    expect(t).toContain('Aitch');
    expect(moreFromHtml([], '../../')).toBe('');
  });
});

describe('game styles', () => {
  const game = read('assets/game.css'), runnerCss = read('games/runner/runner.css');
  it('game.css holds the shared game page components', () => {
    for (const sel of ['.switch', '.brief', '.panel', '.seg', '.dial', '.info', '.readouts', '.card', '.moral', '.video-play', '.more-from']) {
      expect(game, sel).toContain(sel + ' ');
    }
  });
  it('runner.css keeps only runner rules', () => {
    expect(runnerCss).toContain('image-rendering: pixelated');
    expect(runnerCss).not.toMatch(/racer|\.runner |\.controls|\.readout\b/);
  });
});

describe.each(PAGES)('how it works page (%s)', id => {
  const html = read(`games/${id}/how-it-works/index.html`);
  it('links studio.css, not the old styles, and mounts the shared header', () => {
    expect(html).toContain('assets/studio.css');
    expect(html).not.toContain('arcade.css');
    expect(html).toContain('<header data-site="games">');
    expect(html).toContain('<footer data-site>');
    expect(html).toContain('assets/story-page.js');
  });
  it('uses the shared story.css and a styled finale button', () => {
    expect(html).toContain('assets/story.css');
    expect(html).not.toContain('btn solid');
    expect(html).toMatch(/class="btn primary go"/);
  });
  it('uses no old colour aliases in story css', () => {
    for (const f of ['assets/story.css', `games/${id}/how-it-works/story.css`].filter(f => existsSync(new URL('../' + f, import.meta.url)))) {
      expect(read(f), f).not.toMatch(/--amber-ink|--muted/);
    }
  });
  it('links back to its game page', () => {
    expect(html).toMatch(/href="\.\.\/"/);
  });
  it('uses only tokens that exist', () => {
    const files = ['assets/studio.css', 'assets/story.css', `games/${id}/how-it-works/story.css`].filter(f => existsSync(new URL('../' + f, import.meta.url)));
    const all = files.map(read).join('\n');
    const defined = new Set([...all.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
    defined.add('--k'); // set inline on each weight square
    for (const u of [...all.matchAll(/var\((--[\w-]+)/g)].map(m => m[1])) expect(defined.has(u), u).toBe(true);
    expect(all).not.toContain('--display');
  });
  it('keeps heading levels in order', () => {
    const levels = [...html.matchAll(/<h([1-6])[ >]/g)].map(m => +m[1]);
    levels.forEach((l, i) => expect(l - (levels[i - 1] ?? 0), 'h' + l).toBeLessThanOrEqual(1));
  });
});

describe('no dead css or shelf wording', () => {
  it('studio.css has no .status, .chip .count, --ok, --bad or --coin', () => {
    expect(css).not.toMatch(/\.status\b|\.chip \.count|--ok\b|--bad\b|--coin\b/);
  });
  it('the home category block is called category', () => {
    expect(css).not.toContain('.shelf');
  });
});

describe('old styles and fonts are gone', () => {
  const skip = ['node_modules', 'docs', 'videos', '.git', '.claude', '.impeccable', 'tests'];
  const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e =>
    skip.includes(e.name) ? [] : e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
  const files = walk(fileURLToPath(new URL('../', import.meta.url)));
  it('has no arcade.css, home.css or old font files', () => {
    for (const f of files) expect(f, f).not.toMatch(/arcade\.css$|home\.css$|public-sans|saira/);
  });
  it('no page, script or style refers to them', () => {
    for (const f of files.filter(f => /\.(html|js|css)$/.test(f))) {
      const text = readFileSync(f, 'utf8');
      expect(text, f).not.toMatch(/arcade\.css|home\.css|public-sans|saira-condensed|Public Sans|Saira Condensed/);
      if (f.endsWith('.html')) expect(text, f).not.toMatch(/Coming soon|Playable/);
    }
  });
});