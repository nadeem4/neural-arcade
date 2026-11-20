import { describe, it, expect } from 'vitest';
import { pageHtml, shareTagsHtml, esc, SITE_URL } from '../assets/tracks/shell.js';

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
  it('body and main attributes', () => {
    const html = pageHtml({ ...args, bodyAttrs: 'data-track="x"', mainAttrs: 'id="track" class="wrap"' });
    expect(html).toContain('<body data-track="x">');
    expect(html).toContain('<main id="track" class="wrap">');
  });
});
