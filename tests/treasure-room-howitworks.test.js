import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { LEVELS } from '../games/treasure-room/levels.js';
import { GAMES } from '../assets/games.js';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = read('games/treasure-room/how-it-works/index.html');
const story = read('games/treasure-room/how-it-works/story.js');
const css = read('games/treasure-room/how-it-works/story.css');
const URL_ = 'https://arcade.codewithnk.com/games/treasure-room/';
const sections = html.split('<section class="step"').slice(1).slice(0, 6);

describe('treasure room how it works page', () => {
  it('links the shared styles and its own', () => {
    expect(html).toContain('href="../../../assets/studio.css"');
    expect(html).toContain('href="../../../assets/story.css"');
    expect(html).toContain('href="story.css"');
    expect(existsSync(new URL('../games/treasure-room/how-it-works/story.css', import.meta.url))).toBe(true);
  });

  it('has one h1', () => {
    expect(html.match(/<h1[ >]/g).length).toBe(1);
  });

  it('has six figures fig1 to fig6 in order', () => {
    expect([...html.matchAll(/<figure[^>]*id="(fig\d)"/g)].map(m => m[1])).toEqual(['fig1', 'fig2', 'fig3', 'fig4', 'fig5', 'fig6']);
  });

  it('gives each level its own step, ending in that level\'s exact lesson', () => {
    expect(sections.length).toBe(6);
    sections.forEach((s, i) => {
      expect(s, `step ${i + 1}`).toContain(`id="fig${i + 1}"`);
      const lesson = s.match(/<p class="lesson"><small>The lesson<\/small>([^<]*)<\/p>/);
      expect(lesson?.[1], `step ${i + 1}`).toBe(LEVELS[i].lesson);
    });
  });

  it('links each step to its concept page', () => {
    sections.forEach((s, i) => expect(s).toContain(`../../../concepts/${LEVELS[i].id}/`));
  });

  it('links each step to play its level', () => {
    sections.forEach((s, i) => expect(s).toContain(`href="../?level=${LEVELS[i].id}"`));
  });

  it('has a Try it live link to the game and no status words', () => {
    expect(html).toContain('<a class="btn primary go" href="../">');
    expect(html).toMatch(/<a href="\.\.\/">Try it live/);
    expect(html).not.toMatch(/coming soon|TBD/i);
  });

  it('pins the finale lesson', () => {
    const finale = html.split('<section class="step finale">')[1];
    expect(finale).toContain(`<p>${LEVELS[0].lesson}</p>`);
  });

  it('carries its share tags', () => {
    expect(html).toContain(`<link rel="canonical" href="${URL_}how-it-works/">`);
    expect(html).toContain(`<meta property="og:url" content="${URL_}how-it-works/">`);
    expect(html).toContain(`<meta property="og:image" content="${URL_}share.png">`);
    expect(html).toContain(`<meta name="twitter:image" content="${URL_}share.png">`);
  });

  it('shows eight still images from the 3D room, each with its size and alt text', () => {
    expect(html).not.toMatch(/<canvas/);
    for (let n = 1; n <= 8; n++) {
      expect(html).toMatch(new RegExp(`<img[^>]+src="fig-${n}\\.webp"[^>]+width="1280"[^>]+height="800"[^>]+alt="[^"]{12,}"`));
      expect(html.match(new RegExp(`<img[^>]+src="fig-${n}\\.webp"[^>]*>`))[0].includes('loading="lazy"')).toBe(n > 1);
      const f = new URL(`../games/treasure-room/how-it-works/fig-${n}.webp`, import.meta.url);
      expect(existsSync(f)).toBe(true);
      expect(statSync(f).size).toBeLessThanOrEqual(120 * 1024);
    }
    expect(existsSync(new URL('../games/treasure-room/share.png', import.meta.url))).toBe(true);
  });

  it('story.js draws no canvases and imports no 2D room drawing', () => {
    expect(story).not.toMatch(/canvas|drawRoom|room-view|sizeCanvas/i);
  });

  it('nothing imports room-view.js, and the file is gone', () => {
    expect(existsSync(new URL('../games/treasure-room/room-view.js', import.meta.url))).toBe(false);
    for (const f of readdirSync(new URL('../games/treasure-room/', import.meta.url)).filter(x => x.endsWith('.js'))) {
      expect(read('games/treasure-room/' + f), f).not.toMatch(/room-view/);
    }
  });

  it('story.js reads the recorded run for the sweep numbers', () => {
    expect(story).toContain("fetch('../story.json')");
    expect(story).toContain('value.snapshots');
  });

  it('uses theme tokens only, no hard-coded colours', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  it('is linked from the game config, so the game page link resolves', () => {
    const g = GAMES.find(x => x.id === 'treasure-room');
    expect(existsSync(new URL('../' + g.writeup + 'index.html', import.meta.url))).toBe(true);
  });
});
