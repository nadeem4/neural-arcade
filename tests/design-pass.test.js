import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TRACKS } from '../assets/tracks/index.js';
import { flatLessons } from '../assets/tracks/model.js';
import { GAMES } from '../assets/games.js';
import { continueTarget } from '../assets/tracks/progress.js';
import { trackBodyHtml } from '../assets/tracks/track-view.js';
import { lessonBodyHtml } from '../assets/tracks/lesson-view.js';
import { continueHtml, trackRowHtml } from '../assets/home-view.js';
import { lessonChipsHtml } from '../assets/game-page.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
// Declarations of every rule whose selector list is exactly sel (media blocks included).
const rulesOf = (css, sel) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => m[1].trim() === sel).map(m => m[2]).join(' ');
const studio = read('assets/studio.css');
const game = read('assets/game.css');
const concept = read('assets/concept.css');
const lessonCss = read('assets/lesson.css');
const tracksCss = read('assets/track.css');
const S44 = /(?:min-)?height:\s*44px/;

describe('44px targets, shared header and chips', () => {
  it('logo and About link', () => {
    expect(rulesOf(studio, '.logo')).toMatch(/min-height:\s*44px/);
    expect(rulesOf(studio, '.top nav a')).toMatch(/min-width:\s*44px/);
  });
  it('link and button chips are 44px; plain chips are untouched', () => {
    expect(rulesOf(studio, 'a.chip, button.chip')).toMatch(/min-height:\s*44px/);
    expect(rulesOf(studio, '.chip')).toMatch(/height:\s*38px/);
  });
  it('Reward City chips are paragraphs, so the chip rule cannot reach them', () => {
    const city = read('games/city/index.html');
    expect(city).not.toMatch(/<(a|button)[^>]*class="[^"]*\bchip\b/);
    expect(city).toMatch(/<p class="chip/);
  });
  it('browse search input and sort select', () => {
    expect(rulesOf(studio, '.search input')).toMatch(/min-height:\s*44px/);
    expect(rulesOf(studio, '.sort select')).toMatch(S44);
  });
  it('crumb links get a 44px hit height without changing the line', () => {
    expect(rulesOf(studio, '.crumb a')).toMatch(/padding-block:\s*14px/);
  });
  it('(i) buttons stay 28px drawn with a 44px hit area', () => {
    expect(rulesOf(game, '.info')).toMatch(/width:\s*28px/);
    expect(rulesOf(game, '.info')).toMatch(/position:\s*relative/);
    expect(rulesOf(game, '.info::after')).toMatch(/inset:\s*-8px -6px/);
  });
  it('step buttons, try buttons and dial ranges', () => {
    expect(rulesOf(concept, '.sbtn')).toMatch(S44);
    expect(rulesOf(concept, '.tries button')).toMatch(S44);
    expect(rulesOf(concept, '.dial input[type=range]')).toMatch(S44);
    expect(rulesOf(lessonCss, '#playground .dial input')).not.toMatch(/height/);
  });
  it('game page switch links', () => {
    expect(rulesOf(game, '.switch a')).toMatch(S44);
  });
});

describe('Reward City keeps its own hit areas', () => {
  const city = read('games/city/city.css');
  it('resets the shared (i) ring and crumb padding', () => {
    expect(rulesOf(city, '.info::after')).toMatch(/content:\s*none/);
    expect(rulesOf(city, '.crumb a')).toMatch(/padding-block:\s*0/);
  });
});

describe('home share text', () => {
  const html = read('index.html');
  it('hero line admits not every lesson has a video', () => {
    const hero = html.match(/<p>Three tracks, from[^<]*<\/p>/)[0];
    expect(hero).toContain('where there is one');
    expect(hero).not.toContain('a video you watch');
  });
  const get = re => html.match(re)[1];
  it('describes tracks, levels, a short page and a video, in all three tags', () => {
    const d = get(/<meta name="description" content="([^"]*)"/);
    expect(d).toMatch(/three tracks/i);
    expect(d).toMatch(/level/i);
    expect(d).toMatch(/video/i);
    expect(d).not.toMatch(/shelf|one machine learning idea per game/i);
    expect(get(/property="og:description" content="([^"]*)"/)).toBe(d);
    expect(get(/name="twitter:description" content="([^"]*)"/)).toBe(d);
  });
});

describe('track and lesson page guards', () => {
  const h1s = html => (html.match(/<h1[\s>]/g) || []).length;
  const lessons = flatLessons();
  it('tokens only and a reduced-motion block where they animate', () => {
    for (const css of [tracksCss, lessonCss]) {
      expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      if (/transition|animation|scroll-behavior/.test(css)) expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    }
  });
  it('one h1 in every track and lesson body; lesson h1 is "Lesson N: Title"', () => {
    for (const t of TRACKS) expect(h1s(trackBodyHtml(t, { done: [], base: '../' })), t.id).toBe(1);
    for (const l of lessons) {
      const html = lessonBodyHtml(l, { games: GAMES, base: '../../', writeupHtml: '' });
      expect(h1s(html), l.id).toBe(1);
      expect(html, l.id).toContain(`<h1>Lesson ${l.n}: ${l.title}</h1>`);
    }
  });
  it('no lesson title is shown as a bare label without its number', () => {
    const says = new Set(lessons.map(l => l.says));
    const pages = [
      ...TRACKS.map(t => trackBodyHtml(t, { done: [], base: '../' })),
      ...TRACKS.map(t => trackRowHtml(t, [], '')),
      ...lessons.map(l => lessonBodyHtml(l, { games: GAMES, base: '../../', writeupHtml: '' })),
      continueHtml(continueTarget([])),
      continueHtml(continueTarget(['learning-from-examples', 'agent'])),
      ...GAMES.map(g => lessonChipsHtml(g, '../../')),
    ];
    for (const page of pages) {
      // a track row prints the number in its own cell right before the title
      const html = page.replace(/<span class="num">\d+<\/span>\s*<span class="what"><b>[^<]*<\/b>/g, '');
      const bare = [];
      for (const m of html.matchAll(/>([^<>]+)</g)) {
        // a lesson's own description sentence is prose, not a label
        if (says.has(m[1].trim().replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&'))) continue;
        // drop every numbered label first, so "Lesson 8: Policy iteration" does not count as a bare "Policy"
        let text = m[1];
        for (const k of lessons) text = text.split(`Lesson ${k.n}: ${k.title}`).join('').split(`Lesson ${k.n}, ${k.title}`).join('');
        for (const l of lessons) {
          const esc = l.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const re = new RegExp('(^|[^\\w-])' + esc + '(?![\\w-])');
          if (re.test(text) && !text.includes(`Lesson ${l.n}`)) bare.push(m[1].trim());
        }
      }
      expect(bare).toEqual([]);
    }
  });
});
