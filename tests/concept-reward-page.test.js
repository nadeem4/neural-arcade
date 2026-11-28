import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { lessonById } from '../assets/tracks/model.js';

const read = f => readFileSync(new URL(`../concepts/reward-design/${f}`, import.meta.url), 'utf8');
const html = read('index.html');
const writeup = read('writeup.html');
const lesson = lessonById('reward-design');

describe('reward design lesson page', () => {
  it('links the shared styles and none of the game ones', () => {
    expect(html).toContain('../../assets/studio.css');
    expect(html).toContain('../../assets/concept.css');
    expect(html).toContain('../../assets/lesson.css');
    expect(html).not.toContain('game.css');
    expect(html).not.toContain('treasure-room');
  });
  it('carries canonical, og and twitter tags with its share image', () => {
    const url = 'https://arcade.codewithnk.com/concepts/reward-design/';
    expect(html).toContain(`<link rel="canonical" href="${url}">`);
    expect(html).toContain(`<meta property="og:url" content="${url}">`);
    expect(html).toContain(`content="${url}share.png"`);
    expect(html).toContain('name="twitter:image"');
    expect(existsSync(new URL('../concepts/reward-design/share.png', import.meta.url))).toBe(true);
  });
  it('has one h1, the numbered title and the lesson line as description and lead', () => {
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain('<h1>Lesson 25: Reward design</h1>');
    expect(html.match(/<meta name="description" content="([^"]*)"/)[1]).toBe(lesson.says);
    expect(html.match(/<p class="lead">([\s\S]*?)<\/p>/)[1]).toBe(lesson.says);
  });
  it('shows the Reward City banner with Play, no video yet, and the games in the wild', () => {
    expect(html).toContain('href="../../games/city/"');
    expect(html).toContain('src="../../games/city/share.png"');
    expect(html).toContain('Video coming soon');
    expect(html).toContain('Coin Runner');
  });
  it('has the mount points the page script fills', () => {
    expect(writeup).toContain('id="playground"');
    expect(writeup).toContain('id="tries"');
    expect(html).toContain('src="./page.js"');
  });
  it('names the three loopholes and the mile-paid loop', () => {
    for (const w of ['park', 'red light', 'wrong way', 'mile']) expect(writeup.toLowerCase()).toContain(w);
    expect(writeup).toContain('What to try');
  });
  it('wires the playground and the tries', () => {
    const js = read('page.js');
    expect(js).toContain("from './play.js'");
    expect(js).toContain('triesHtml(presets)');
    expect(js).toContain('mountPlayground');
  });
  for (const f of ['fig-lawn', 'fig-loop']) {
    it(`${f}.webp exists, under 150 KB and an img with alt, width and height`, () => {
      expect(statSync(new URL(`../concepts/reward-design/${f}.webp`, import.meta.url)).size).toBeLessThan(150000);
      const img = writeup.match(new RegExp(`<img[^>]*src="${f}\.webp"[^>]*>`))?.[0];
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
