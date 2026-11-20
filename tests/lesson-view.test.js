import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lessonById } from '../assets/tracks/model.js';
import { GAMES } from '../assets/games.js';
import { crumbHtml, videoSlotHtml, wildListHtml, ownLineHtml, neighboursHtml, markDoneHtml, lessonBodyHtml } from '../assets/tracks/lesson-view.js';

const B = '../../';
const l = lessonById('return');
const args = { games: GAMES, base: B, writeupHtml: '<section id="writeup">W</section>' };

describe('lesson view builders', () => {
  it('body has the number in the h1 and the three anchors the track rows link to', () => {
    const html = lessonBodyHtml(l, args);
    expect(html).toContain('<h1>Lesson 3: Return</h1>');
    for (const id of ['play', 'watch', 'read']) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('<div id="levelRoot" data-level="3"></div>');
    expect(html).toContain('<noscript>');
    expect(html).toContain('<section id="writeup">W</section>');
    expect(html).toContain(l.says);
  });
  it('crumb links the track and counts the lesson', () => {
    expect(crumbHtml(l, B)).toContain('<a href="../../reinforcement-learning/">Reinforcement learning</a> / The problem / Lesson 3 of 19');
  });
  it('video slot: own video, game video, or coming soon', () => {
    expect(videoSlotHtml(l, GAMES, B)).toContain('Video coming soon');
    expect(videoSlotHtml(l, GAMES, B)).not.toContain('data-youtube=');
    const whole = { ...l, whole: true, game: 'maze', video: null };
    expect(videoSlotHtml(whole, GAMES, B)).toContain(`data-youtube="${GAMES.find(g => g.id === 'maze').youtube}"`);
    expect(videoSlotHtml({ ...l, video: 'drtqgVse4jo' }, GAMES, B)).toContain('data-youtube="drtqgVse4jo"');
  });
  it('wild list leaves out the own game and is empty without other entries', () => {
    const w = wildListHtml(l, GAMES, B);
    expect(w).toContain('Treasure Maze');
    expect(w).toContain('Reward City');
    expect(w).not.toContain('Treasure Room');
    expect(wildListHtml({ ...l, wild: [] }, GAMES, B)).toBe('');
    expect(wildListHtml(lessonById('mdp'), GAMES, B)).toBe('');
  });
  it('own line is the own-game entry', () => {
    expect(ownLineHtml(l)).toContain('<p class="own">In this game: ');
    expect(ownLineHtml(l)).toContain('lower the discount');
    expect(ownLineHtml({ ...l, wild: [] })).toBe('');
  });
  it('neighbours are numbered labels and a missing side is omitted', () => {
    expect(neighboursHtml(lessonById('agent'), B)).not.toContain('Previous');
    expect(neighboursHtml(lessonById('agent'), B)).toContain('Lesson 2: State, action, reward');
    const mid = neighboursHtml(l, B);
    expect(mid).toContain('href="../../concepts/state-action-reward/"');
    expect(mid).toContain('Lesson 4: Policy');
  });
  it('mark done button carries its state', () => {
    expect(markDoneHtml(false)).toContain('aria-pressed="false"');
    expect(markDoneHtml(false)).toContain('Mark as done');
    expect(markDoneHtml(true)).toContain('aria-pressed="true"');
    expect(markDoneHtml(true)).toContain('Done');
  });
});

describe('lesson.css', () => {
  const css = readFileSync(new URL('../assets/lesson.css', import.meta.url), 'utf8');
  it('uses tokens only, 44px targets, a phone block and reduced motion', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).toMatch(/#markDone[^{]*\{[^}]*min-height: 44px/);
    expect(css).toMatch(/@media \(max-width: 480px\)/);
    expect(css).toContain('prefers-reduced-motion');
  });
});
