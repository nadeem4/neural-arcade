import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { pageHtml, shareTagsHtml, esc, SITE_URL } from '../assets/tracks/shell.js';
import { buildPages } from '../assets/tracks/build.js';
import { flatLessons } from '../assets/tracks/model.js';

const args = { title: 'Neural networks · Neural Arcade', description: 'd', path: 'neural-networks/', depth: 1,
  styles: ['assets/track.css'], siteKey: 'neural-networks', mainHtml: '<h1>x</h1>', scripts: ['assets/track-page.js'], imageAlt: 'a' };

describe('page shell', () => {
  it('writes canonical, share tags, styles and scripts', () => {
    const html = pageHtml(args);
    expect(SITE_URL).toBe('https://arcade.codewithnk.com/');
    expect(html).toContain('<link rel="canonical" href="https://arcade.codewithnk.com/neural-networks/">');
    expect(html).toContain('<meta property="og:image" content="https://arcade.codewithnk.com/assets/share.png">');
    expect(html).toContain('<meta name="twitter:image" content="https://arcade.codewithnk.com/assets/share.png">');
    expect(html).toContain('href="../assets/studio.css"');
    expect(html).toContain('href="../assets/track.css"');
    expect(html).toContain('<script type="module" src="../assets/track-page.js"></script>');
    expect(html).toContain('<header data-site="neural-networks"></header>');
    expect(html).toContain('<footer data-site></footer>');
    expect(html).toContain("localStorage.getItem('na-theme')");
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });
  it('escapes text', () => {
    expect(pageHtml({ ...args, title: 'A "b" <c>' })).toContain('A &quot;b&quot; &lt;c&gt;');
    expect(esc('a&b')).toBe('a&amp;b');
  });
  it('share tags use the page path and image', () => {
    const t = shareTagsHtml({ title: 'T', description: 'D', path: 'x/', image: 'games/x/share.png', imageAlt: 'alt' });
    expect(t).toContain('og:url" content="https://arcade.codewithnk.com/x/"');
    expect(t).toContain('content="https://arcade.codewithnk.com/games/x/share.png"');
    expect(t).toContain('og:image:alt" content="alt"');
  });
  it('leaves ./ scripts alone and prefixes the rest', () => {
    const html = pageHtml({ ...args, depth: 2, scripts: ['./page.js', 'assets/x.js'] });
    expect(html).toContain('<script type="module" src="./page.js"></script>');
    expect(html).toContain('<script type="module" src="../../assets/x.js"></script>');
  });
  it('body and main attributes', () => {
    const html = pageHtml({ ...args, bodyAttrs: 'data-track="x"', mainAttrs: 'id="track" class="wrap"' });
    expect(html).toContain('<body data-track="x">');
    expect(html).toContain('<main id="track" class="wrap">');
  });
});

describe('buildPages', () => {
  const disk = p => new URL('../' + p, import.meta.url);
  const files = { read: p => (existsSync(disk(p)) ? readFileSync(disk(p), 'utf8') : null), exists: p => existsSync(disk(p)) };
  const out = buildPages({ files });
  const LESSONS = ['agent', 'state-action-reward', 'return', 'policy', 'value', 'mdp'];
  const NO_GRID = ['agent', 'state-action-reward', 'return', 'policy', 'value'];
  it('emits the three track pages and a page for every live lesson', () => {
    const live = flatLessons().filter(l => l.status === 'live').map(l => l.id);
    expect(Object.keys(out).filter(p => p.startsWith('concepts/')).map(p => p.split('/')[1]).sort()).toEqual([...live].sort());
    expect(Object.keys(out).filter(p => !p.startsWith('concepts/'))).toEqual(['neural-networks/index.html', 'reinforcement-learning/index.html', 'physical-ai/index.html']);
    expect(out['physical-ai/index.html']).toContain('<title>Physical AI · Neural Arcade</title>');
    expect(out['reinforcement-learning/index.html']).toContain('data-track="reinforcement-learning"');
  });
  it('lesson pages carry the shell, the write-up and the runtime', () => {
    for (const id of LESSONS) {
      const html = out[`concepts/${id}/index.html`];
      expect(html, id).toContain(`<link rel="canonical" href="https://arcade.codewithnk.com/concepts/${id}/">`);
      if (!NO_GRID.includes(id)) expect(html, id).toContain('id="playground"');
      expect(html, id).toContain('id="writeup"');
      expect(html, id).toContain(`<body data-lesson="${id}">`);
      expect(html, id).toContain('src="../../assets/lesson-page.js"');
      expect(html.includes('src="./page.js"'), id).toBe(existsSync(disk(`concepts/${id}/page.js`)));
      for (const css of ['studio', 'game', 'concept', 'lesson']) expect(html, id).toContain(`href="../../assets/${css}.css"`);
      expect(html, id).toContain('href="../../games/treasure-room/treasure-room.css"');
      expect(html, id).toContain('<symbol id="i"');
    }
    expect(out['concepts/return/index.html']).toContain('<title>Lesson 3: Return · Neural Arcade</title>');
  });
  it('share image is the lesson own file when it exists', () => {
    const own = buildPages({ files: { read: () => '<section id="writeup"></section>', exists: p => p === 'concepts/agent/share.png' } });
    expect(own['concepts/agent/index.html']).toContain('content="https://arcade.codewithnk.com/concepts/agent/share.png"');
    expect(own['concepts/return/index.html']).toContain('content="https://arcade.codewithnk.com/assets/share.png"');
  });
  it('whole-game lesson pages: banner shell, no Treasure Room CSS, own or game share image', () => {
    expect(out['concepts/pid/index.html']).toContain('<title>Lesson 1: PID control · Neural Arcade</title>');
    expect(out['concepts/pid/index.html']).toContain('concepts/pid/share.png');
    expect(out['concepts/pid/index.html']).toContain('src="./page.js"');
    expect(out['concepts/learning-by-selection/index.html']).toContain('games/racer/share.png');
    expect(out['concepts/learning-from-examples/index.html']).toContain('games/teach/share.png');
    for (const id of ['pid', 'reward-design', 'learning-from-examples', 'learning-by-selection']) {
      const html = out[`concepts/${id}/index.html`];
      expect(html, id).toContain('src="../../assets/lesson-page.js"');
      expect(html, id).toContain('href="../../assets/lesson.css"');
      expect(html, id).not.toContain('game.css');
      expect(html, id).not.toContain('treasure-room');
      expect(html, id).not.toContain('id="levelRoot"');
    }
    expect(out['concepts/learning-by-selection/index.html']).not.toContain('src="./page.js"');
  });
  it('writes no page for a soon lesson', () => {
    for (const soon of ['bellman-equation', 'sarsa', 'ppo']) expect(out).not.toHaveProperty(`concepts/${soon}/index.html`);
  });
  it('committed files match the config (run npm run pages)', () => {
    for (const [path, html] of Object.entries(out)) {
      const disk = readFileSync(new URL('../' + path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
      expect(disk, path).toBe(html);
    }
  });
  it('writes no page for any soon lesson', () => {
    const soon = flatLessons().filter(l => l.status === 'soon').map(l => l.id);
    for (const path of Object.keys(out)) for (const id of soon) expect(path).not.toContain(`concepts/${id}/`);
  });
  it('fails loudly when a write-up is missing', () => {
    expect(() => buildPages({})).toThrow(/writeup\.html/);
  });
});
