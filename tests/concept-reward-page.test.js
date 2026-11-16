import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { conceptById } from '../assets/games.js';

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
  it('shows "Where you meet it" linking Reward City and Coin Runner', () => {
    expect(html).toContain('Where you meet it');
    expect(html).toContain('href="../../games/city/"');
    expect(html).toContain('href="../../games/runner/"');
    expect(html.match(/reward hacking/gi)?.length).toBeGreaterThanOrEqual(2);
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
