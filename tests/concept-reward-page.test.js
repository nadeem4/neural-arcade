import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { GAMES, conceptById, gameById } from '../assets/games.js';

const html = readFileSync(new URL('../concepts/reward-design/index.html', import.meta.url), 'utf8');
const c = conceptById('reward-design');

describe('reward design page shell', () => {
  it('links the shared styles', () => {
    expect(html).toContain('../../assets/studio.css');
    expect(html).toContain('../../assets/concept.css');
  });
  it('carries canonical, og and twitter tags with its share image', () => {
    const url = 'https://arcade.codewithnk.com/concepts/reward-design/';
    expect(html).toContain(`<link rel="canonical" href="${url}">`);
    expect(html).toContain(`<meta property="og:url" content="${url}">`);
    expect(html).toContain(`content="${url}share.png"`);
    expect(html).toContain('name="twitter:image"');
    expect(existsSync(new URL('../concepts/reward-design/share.png', import.meta.url))).toBe(true);
  });
  it('has one h1 and the concept definition', () => {
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html.match(/<meta name="description" content="([^"]*)"/)[1]).toBe(c.definition);
  });
  it('has the mount point RC8 fills', () => {
    expect(html).toContain('id="playground"');
  });
  it('names the three loopholes and the mile-paid loop', () => {
    for (const w of ['park', 'red light', 'wrong way', 'mile']) expect(html.toLowerCase()).toContain(w);
    expect(html).toContain('What to try');
  });
  it('fills the games section from the config, not a static list', () => {
    expect(html).not.toContain('Where you meet it');
    expect(html).toContain('id="games"');
    const users = GAMES.filter(g => g.uses?.includes('reward-design')).map(g => g.id);
    expect(users).toContain('runner');
    for (const id of users) expect(gameById(id).where['reward-design'].length).toBeGreaterThan(20);
  });
  it('wires the playground and the tries', () => {
    expect(html).toContain("from './play.js'");
    expect(html).toContain('triesHtml(presets)');
    expect(html).toContain('mountPlayground');
  });
  for (const f of ['fig-lawn', 'fig-loop']) {
    it(`${f}.webp exists, under 150 KB and an img with alt, width and height`, () => {
      expect(statSync(new URL(`../concepts/reward-design/${f}.webp`, import.meta.url)).size).toBeLessThan(150000);
      const img = html.match(new RegExp(`<img[^>]*src="${f}\.webp"[^>]*>`))?.[0];
      expect(img, f).toBeTruthy();
      for (const a of ['alt', 'width', 'height']) expect(img).toMatch(new RegExp(` ${a}="[^"]+"`));
    });
  }
  it('share.png is 1280x720', () => {
    const b = readFileSync(new URL('../concepts/reward-design/share.png', import.meta.url));
    expect(b.readUInt32BE(16)).toBe(1280);
    expect(b.readUInt32BE(20)).toBe(720);
  });
});

describe('reward design page lead', () => {
  it('leads with the definition from the config', () => {
    expect(html.match(/<p class="lead">([\s\S]*?)<\/p>/)[1].replace(/<[^>]+>/g, '')).toBe(c.definition);
  });
  it('mounts the page', () => {
    expect(html).toContain("mountConceptPage('reward-design', '../../')");
    expect(html).toContain('<header data-site');
  });
});
