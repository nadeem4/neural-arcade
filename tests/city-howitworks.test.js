import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { GOAL_SECONDS } from '../games/city/presets.js';
import { LESSON } from '../games/city/words.js';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = read('games/city/how-it-works/index.html');
const story = read('games/city/how-it-works/story.js');
const URL_ = 'https://arcade.codewithnk.com/games/city/';

describe('city how it works page', () => {
  it('links the reward design concept page', () => {
    expect(html).toContain('href="../../../concepts/reward-design/"');
  });
  it('links the shared styles', () => {
    expect(html).toContain('href="../../../assets/studio.css"');
    expect(html).toContain('href="../../../assets/story.css"');
  });
  it('states the lesson verbatim and has one h1', () => {
    expect(html).toContain(LESSON);
    expect(html.match(/<h1[ >]/g).length).toBe(1);
  });
  it('has five figures fig1 to fig5', () => {
    expect([...html.matchAll(/<figure[^>]*id="(fig\d)"/g)].map(m => m[1])).toEqual(['fig1', 'fig2', 'fig3', 'fig4', 'fig5']);
  });
  it('gives every figure canvas a label and a caption', () => {
    expect(html.match(/<canvas[^>]*aria-label="[^"]+"/g).length).toBe(html.match(/<canvas/g).length);
    expect(html.match(/<figcaption>/g).length).toBe(5);
  });
  it('carries its share tags', () => {
    expect(html).toContain(`<link rel="canonical" href="${URL_}how-it-works/">`);
    expect(html).toContain(`<meta property="og:image" content="${URL_}share.png">`);
    expect(html).toContain(`<meta name="twitter:image" content="${URL_}share.png">`);
  });
  it('credits OpenStreetMap contributors with a link', () => {
    expect(html).toContain('<a href="https://www.openstreetmap.org/copyright"');
    expect(html).toContain('© OpenStreetMap contributors');
  });
  it('story.js reads the recorded run', () => {
    expect(story).toContain("fetch('../story.json')");
  });
  it('has no tour, quiz or audio, and no GTA', () => {
    expect(html).not.toMatch(/<audio|<video|quiz|tour/i);
    expect(html + story).not.toMatch(/GTA|grand theft/i);
  });
  it('describes the finished game: the new trip, the city score, and what the taxi ignores', () => {
    const text = html.replace(/<[^>]+>/g, ' ');
    for (const w of ['Millennium Park', 'Van Buren', 'What the city wanted', 'people', 'traffic', 'honks']) expect(text, w).toContain(w);
    expect(text).toContain(`${GOAL_SECONDS} seconds`);
    expect(text).toMatch(/does not (pay|reward)|not in the reward|never in the reward/i);
  });
  it('has no stale phrases from the first version of the game', () => {
    expect(html).not.toMatch(/across the park|cut through the park|sprite|Kenney/i);
  });
  it('says reward and rate card, never pay slip', () => {
    expect(html + story).not.toMatch(/pay ?slip/i);
    expect(read('assets/games.js')).not.toMatch(/pay ?slip/i);
  });
});
