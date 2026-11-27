import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lessonById } from '../assets/tracks/model.js';
import { GAMES } from '../assets/games.js';
import { crumbHtml, videoSlotHtml, wildListHtml, ownLineHtml, neighboursHtml, markDoneHtml, lessonBodyHtml, bannerStageHtml, readHtml } from '../assets/tracks/lesson-view.js';

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
  it('page order: lead, stage, write-up, video, other games, Mark as done, neighbours', () => {
    const html = lessonBodyHtml(l, args);
    const at = ['class="lead"', 'id="play"', 'id="writeup"', 'id="watch"', 'class="wild"', 'id="markDone"', 'class="neighbours"'].map(s => html.indexOf(s));
    expect(at).not.toContain(-1);
    expect(at).toEqual([...at].sort((a, b) => a - b));
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
    expect(w).toContain('<h2>Same idea in other games</h2><p class="wild-lead">');
    expect(w).toContain('Treasure Maze');
    expect(w).toContain('Reward City');
    expect(w).not.toContain('Treasure Room');
    expect(wildListHtml({ ...l, wild: [] }, GAMES, B)).toBe('');
    expect(wildListHtml(lessonById('mdp'), GAMES, B)).toBe('');
  });
  it('own line is the own-game entry', () => {
    expect(ownLineHtml(l)).toContain('<p class="own">In this game: ');
    expect(ownLineHtml(l)).toContain('three routes');
    expect(ownLineHtml({ ...l, wild: [] })).toBe('');
  });
  it('neighbours are numbered labels and a missing side is omitted', () => {
    expect(neighboursHtml(lessonById('agent'), B)).not.toContain('Previous');
    expect(neighboursHtml(lessonById('agent'), B)).toContain('Lesson 2: State, action, reward');
    const mid = neighboursHtml(l, B);
    expect(mid).toContain('href="../../concepts/state-action-reward/"');
    expect(mid).toContain('Lesson 4: Policy');
    expect(neighboursHtml(lessonById('mdp'), B)).toContain('Lesson 19: Reward design');
  });
  it('mark done button carries its state', () => {
    expect(markDoneHtml(false)).toContain('aria-pressed="false"');
    expect(markDoneHtml(false)).toContain('Mark as done');
    expect(markDoneHtml(true)).toContain('aria-pressed="true"');
    expect(markDoneHtml(true)).toContain('Done');
  });
});

describe('whole-game lessons', () => {
  const pid = lessonById('pid');
  it('pid: banner and Play to the game, no level, the lesson video', () => {
    const html = lessonBodyHtml(pid, args);
    expect(html).toContain('href="../../games/balance/"');
    expect(html).not.toContain('id="levelRoot"');
    expect(html).toContain('data-youtube="drtqgVse4jo"');
    expect(html).toContain('<section id="writeup">W</section>');
    expect(bannerStageHtml(pid, GAMES, B)).toContain('src="../../games/balance/share.png"');
    expect(bannerStageHtml(pid, GAMES, B)).toContain('alt="Balance: PID control"');
    expect(bannerStageHtml(pid, GAMES, B)).toContain('Play Balance');
  });
  it('a basics lesson reads in the game how-it-works and falls back to the game video', () => {
    const basics = lessonById('learning-from-examples');
    const teach = lessonBodyHtml(basics, { games: GAMES, base: B, writeupHtml: '' });
    expect(teach).toContain('href="../../games/teach/how-it-works/"');
    expect(teach).toContain('data-youtube="qfzRiq3DoJo"');
    expect(teach).not.toContain('id="writeup"');
    expect(readHtml(basics, GAMES, B, '')).toContain('Read how ');
  });
  it('reward design: Reward City banner, no video yet, wild list and own line', () => {
    const rd = lessonById('reward-design');
    const html = lessonBodyHtml(rd, args);
    expect(html).toContain('Video coming soon');
    expect(html).toContain('href="../../games/city/"');
    expect(wildListHtml(rd, GAMES, B)).toContain('Coin Runner');
    expect(ownLineHtml(rd)).toContain('The rate card is the reward design');
  });
  it('level lessons keep the level stage', () => {
    expect(lessonBodyHtml(l, args)).not.toContain('class="banner"');
  });
  it('lesson.css styles the banner with a 44px primary button', () => {
    const css = readFileSync(new URL('../assets/lesson.css', import.meta.url), 'utf8');
    expect(css).toContain('.banner');
    expect(css).toMatch(/\.banner-play \.btn[^{]*\{[^}]*min-height: 44px/);
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
  it('guards the concept playground against game.css and treasure-room.css, and keeps the level text unclipped', () => {
    for (const rule of ['#playground .sum', '#playground .dial ', '#playground .dial input', '#playground {']) expect(css).toContain(rule);
    expect(css).toContain('.lesson-page .play p { max-width: none; }');
  });
  it('the In code fold has a 44px summary and a focus ring', () => {
    expect(css).toMatch(/\.incode summary \{[^}]*min-height: (4[4-9]|[5-9]\d)px/);
    expect(css).toMatch(/\.incode summary:focus-visible \{[^}]*outline: 2px/);
  });
  it('the In this game caption has no side border, and a lone video takes the full row', () => {
    expect(css.match(/^\.own \{[^}]*\}/m)[0]).not.toContain('border');
    expect(css).toContain('.side:has(.wild)');
  });
});
