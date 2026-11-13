import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { LESSON } from '../games/maze/words.js';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = read('games/maze/how-it-works/index.html');
const story = read('games/maze/how-it-works/story.js');
const URL_ = 'https://arcade.codewithnk.com/games/maze/';

describe('maze how it works page', () => {
  it('links the shared styles', () => {
    expect(html).toContain('href="../../../assets/studio.css"');
    expect(html).toContain('href="../../../assets/story.css"');
  });
  it('states the lesson verbatim and has one h1', () => {
    expect(html).toContain(LESSON);
    expect(html.match(/<h1[ >]/g).length).toBe(1);
  });
  it('has four figures fig1 to fig4', () => {
    expect([...html.matchAll(/<figure[^>]*id="(fig\d)"/g)].map(m => m[1])).toEqual(['fig1', 'fig2', 'fig3', 'fig4']);
  });
  it('carries its share tags', () => {
    expect(html).toContain(`<link rel="canonical" href="${URL_}how-it-works/">`);
    expect(html).toContain(`<meta property="og:image" content="${URL_}share.png">`);
    expect(html).toContain(`<meta name="twitter:image" content="${URL_}share.png">`);
  });
  it('story.js reads the recorded run', () => {
    expect(story).toContain("fetch('../story.json')");
  });
});
