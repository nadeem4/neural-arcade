import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { GAMES } from '../assets/games.js';

const SITE = 'https://arcade.codewithnk.com/';
const root = new URL('../', import.meta.url);

const pages = [
  ['index.html', 'assets/share.png'],
  ['about/index.html', 'assets/share.png'],
  ['games/index.html', 'assets/share.png'],
  ['category/index.html', 'assets/share.png'],
  ...GAMES.flatMap(g => [
    [`${g.path}index.html`, `games/${g.id}/share.png`],
    [`${g.writeup}index.html`, `games/${g.id}/share.png`],
  ]),
];

const attr = (html, tag, key, name) =>
  html.match(new RegExp(`<${tag}[^>]* ${key}="${name}"[^>]*>`))?.[0];
const meta = (html, key, name) => attr(html, 'meta', key, name)?.match(/content="([^"]*)"/)?.[1];

describe('share and SEO tags', () => {
  it('covers every page, including each game and its write-up', () => {
    expect(pages.length).toBe(4 + GAMES.length * 2);
  });

  for (const [file, defaultImage] of pages) {
    describe(file, () => {
      const html = readFileSync(new URL(file, root), 'utf8');
      const url = SITE + file.replace(/index\.html$/, '');
      const desc = meta(html, 'name', 'description');

      it('has a canonical link and og:url that match', () => {
        expect(attr(html, 'link', 'rel', 'canonical')).toContain(`href="${url}"`);
        expect(meta(html, 'property', 'og:url')).toBe(url);
      });
      it('has og basics, with og:description equal to the meta description', () => {
        expect(desc).toBeTruthy();
        expect(meta(html, 'property', 'og:type')).toBe('website');
        expect(meta(html, 'property', 'og:site_name')).toBe('Neural Arcade');
        expect(meta(html, 'property', 'og:title')).toBeTruthy();
        expect(meta(html, 'property', 'og:description')).toBe(desc);
      });
      it('has a twitter large-image card', () => {
        expect(meta(html, 'name', 'twitter:card')).toBe('summary_large_image');
        expect(meta(html, 'name', 'twitter:title')).toBe(meta(html, 'property', 'og:title'));
        expect(meta(html, 'name', 'twitter:description')).toBe(desc);
      });
      it('points og:image and twitter:image at an existing banner', () => {
        const img = meta(html, 'property', 'og:image');
        expect(img.startsWith(SITE)).toBe(true);
        expect(meta(html, 'name', 'twitter:image')).toBe(img);
        expect(meta(html, 'property', 'og:image:width')).toBe('1280');
        expect(meta(html, 'property', 'og:image:height')).toBe('720');
        expect(meta(html, 'property', 'og:image:alt')).toBeTruthy();
        const path = img.slice(SITE.length);
        const gameDir = defaultImage.startsWith('games/') ? defaultImage.replace(/share\.png$/, '') : null;
        // a game without a video may use its shot.jpg instead of share.png
        const allowed = gameDir ? [defaultImage, gameDir + 'shot.jpg'] : [defaultImage];
        expect(allowed).toContain(path);
        expect(existsSync(new URL(path, root)), path).toBe(true);
      });
    });
  }

  it('gives every game a banner (share.png, or shot.jpg when it has no video)', () => {
    for (const g of GAMES) {
      const banner = existsSync(new URL(`games/${g.id}/share.png`, root)) || (!g.youtube && existsSync(new URL(`games/${g.id}/shot.jpg`, root)));
      expect(banner, g.id).toBe(true);
    }
  });
});
