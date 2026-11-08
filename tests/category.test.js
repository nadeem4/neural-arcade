import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { stepHtml, otherChipsHtml, unknownHtml } from '../assets/category.js';

const page = readFileSync(new URL('../category/index.html', import.meta.url), 'utf8');
const g = {
  id: 'x', title: 'X <Game>', lesson: 'Teaches x.', learnsBy: 'Loss', goesWrongWhen: 'It breaks',
  shot: 'games/x/shot.jpg', path: 'games/x/', writeup: 'games/x/how-it-works/', youtube: null,
};

describe('category page markup', () => {
  it('has mounts for the crumb, heading, lead, start button, rows and other categories', () => {
    for (const id of ['crumb', 'title', 'lead', 'start', 'steps', 'others', 'missing']) expect(page, id).toContain(`id="${id}"`);
    expect(page).toContain('data-site="games"');
    expect(page).toContain('src="../assets/category.js"');
  });
  it('says category, never shelf', () => expect(page.toLowerCase()).not.toContain('shelf'));
});

describe('category renderers', () => {
  it('renders a large row with escaped title, facts and links under the base', () => {
    const h = stepHtml(g, '../');
    expect(h).toContain('X &lt;Game&gt;');
    expect(h).toContain('Loss');
    expect(h).toContain('It breaks');
    expect(h).toContain('href="../games/x/"');
    expect(h).toContain('href="../games/x/how-it-works/"');
  });
  it('offers the explainer only when youtube is set', () => {
    expect(stepHtml(g, '')).not.toMatch(/Watch/);
    expect(stepHtml({ ...g, youtube: 'abc' }, '')).toContain('href="games/x/#watch"');
  });
  it('renders other categories as links to their pages, plus every game', () => {
    const h = otherChipsHtml([{ id: 'y', title: 'Y' }]);
    expect(h).toContain('href="?c=y"');
    expect(h).toContain('href="../games/"');
  });
  it('renders a plain message with a link to Games for an unknown category', () => {
    expect(unknownHtml()).toContain('href="../games/"');
  });
});
