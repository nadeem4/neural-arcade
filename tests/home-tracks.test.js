import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { continueHtml, trackRowHtml, flowHtml } from '../assets/home-view.js';
import { continueTarget } from '../assets/tracks/progress.js';
import { trackById } from '../assets/tracks/index.js';
import { heroOf, GAMES } from '../assets/games.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

describe('continue panel', () => {
  it('first visit says Start for lesson 1', () => {
    const h = continueHtml(continueTarget([]));
    expect(h).toContain('Start here');
    expect(h).toContain('Start: Lesson 1, Learning from examples');
    expect(h).toContain('href="concepts/learning-from-examples/"');
  });
  it('after progress says Continue with the lesson number', () => {
    const h = continueHtml(continueTarget(['learning-from-examples', 'learning-by-selection', 'agent', 'state-action-reward']));
    expect(h).toContain('Continue: Lesson 3, Return');
    expect(h).toContain('href="concepts/return/"');
    expect(h.match(/class="btn primary"/g)).toHaveLength(1);
  });
  it('prefixes links with base', () => {
    expect(continueHtml(continueTarget([]), '../')).toContain('href="../concepts/learning-from-examples/"');
  });
  it('says so when every lesson is done, with a plain link to All games', () => {
    const h = continueHtml(null, '../');
    expect(h).toContain('finished every lesson');
    expect(h).toContain('<a class="textlink" href="../games/">All games</a>');
    expect(h).not.toContain('primary');
  });
});

describe('track rows', () => {
  it('shows number, live and coming soon counts, progress and a link to the track', () => {
    const row = trackRowHtml(trackById('reinforcement-learning'), ['agent']);
    expect(row).toContain('>2<');
    expect(row).toContain('1 of 7 done');
    expect(row).toContain('12 coming soon');
    expect(row).toContain('href="reinforcement-learning/"');
    expect(row).toContain('Continue');
  });
  it('offers Start with no progress and omits coming soon when there is none', () => {
    const row = trackRowHtml(trackById('neural-networks'), []);
    expect(row).toContain('Start');
    expect(row).toContain('2 lessons');
    expect(row).not.toContain('coming soon');
  });
  it('ignores a stale saved id', () => expect(trackRowHtml(trackById('neural-networks'), ['gone'])).toContain('0 of 2 done'));
});

describe('flow line', () => {
  it('names Play, Read, Watch in order', () => expect(flowHtml()).toMatch(/Play[\s\S]*Read[\s\S]*Watch/));
});

describe('home page', () => {
  const html = read('index.html');
  it('has the mounts and one h1, and none of the old shelf', () => {
    for (const id of ['hero-actions', 'continue', 'tracks', 'flow']) expect(html).toContain(`id="${id}"`);
    for (const id of ['categories', 'chips']) expect(html).not.toContain(`id="${id}"`);
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).not.toContain('Pick what you want to understand');
  });
  it('picks the hero game without categories', () => expect(heroOf(GAMES).id).toBe('balance'));
});

describe('home css', () => {
  const css = read('assets/studio.css');
  it('track rows wrap on a phone and the header nav wraps under the logo', () => {
    expect(css).toMatch(/@media \(max-width: 640px\)[\s\S]*\.trow/);
    expect(css).toMatch(/\.top \{[^}]*flex-wrap: wrap/);
  });
  it('drops the category and tile shelf rules', () => {
    for (const s of ['.category {', '.cats {', '.seeall', '.sec-h', '.concepts {']) expect(css).not.toContain(s);
  });
});
