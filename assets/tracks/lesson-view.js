// Lesson page HTML builders. Pure strings; the generator uses them and the page runtime updates only Mark as done.
// `lesson` is a flat lesson from model.js (flatLessons / lessonById).
import { GAMES } from '../games.js';
import { videoHtml } from '../concept-page.js';
import { lessonLabel, lessonHref, lessonVideo, neighbours, trackHref } from './model.js';
import { esc } from './shell.js';

export const crumbHtml = (lesson, base) =>
  `<a href="${trackHref(lesson.trackId, base)}">${esc(lesson.trackTitle)}</a> / ${esc(lesson.partTitle)} / Lesson ${lesson.n} of ${lesson.total}`;

export function videoSlotHtml(lesson, games = GAMES) {
  const id = lessonVideo(lesson, games);
  return id
    ? videoHtml({ youtube: id, title: lessonLabel(lesson) })
    : '<p class="video-soon">Video coming soon</p>';
}

// "Same idea in other games": what other games show of this lesson. The lesson's own game is the caption under the stage instead.
export function wildListHtml(lesson, games = GAMES, base = '') {
  const items = (lesson.wild ?? []).filter(w => w.game !== lesson.game).map(w => {
    const g = games.find(x => x.id === w.game);
    return `<li><a href="${base}games/${esc(w.game)}/">${esc(g?.title ?? w.game)}</a><span>${esc(w.says)}</span></li>`;
  });
  return items.length ? `<h2>Same idea in other games</h2><p class="wild-lead">Each of these games shows this idea in a different world.</p><ul class="wild-list">${items.join('')}</ul>` : '';
}

export function ownLineHtml(lesson) {
  const own = (lesson.wild ?? []).find(w => w.game === lesson.game);
  return own ? `<p class="own">In this game: ${esc(own.says)}</p>` : '';
}

export function neighboursHtml(lesson, base) {
  const { prev, next } = neighbours(lesson.id);
  const link = (l, cls, dir) => `<a class="${cls}" href="${lessonHref(l, base)}"><small>${dir}</small>${esc(lessonLabel(l))}</a>`;
  return `<nav class="neighbours" aria-label="Lessons">${prev ? link(prev, 'prev', 'Previous') : ''}${next ? link(next, 'next', 'Next') : ''}</nav>`;
}

export const markDoneLabel = done => (done ? 'Done<span class="sr"> (undo)</span>' : 'Mark as done');

export const markDoneHtml = done =>
  `<button class="btn" id="markDone" type="button" aria-pressed="${done}">${markDoneLabel(done)}</button>`;

// A whole-game lesson's stage: the game's banner as a link, and the way into the game.
export function bannerStageHtml(lesson, games = GAMES, base = '') {
  const title = games.find(g => g.id === lesson.game)?.title ?? lesson.game;
  const href = `${base}games/${esc(lesson.game)}/`;
  return `<a class="banner" href="${href}"><img src="${base}games/${esc(lesson.game)}/share.png" width="1280" height="720" alt="${esc(title)}: ${esc(lesson.title)}"></a>
  <p class="banner-play"><a class="btn primary" href="${href}">Play ${esc(title)}</a></p>`;
}

// Read: the lesson's write-up when it has one, else a link to the game's How it works.
export function readHtml(lesson, games, base, writeupHtml) {
  if (writeupHtml) return `<div id="read">
${writeupHtml}
</div>`;
  const g = games.find(x => x.id === lesson.game);
  return `<div id="read"><p><a href="${base}${esc(g?.writeup ?? '')}">Read how ${esc(g?.title ?? lesson.game)} works</a></p></div>`;
}

// The inside of <main> for one lesson: everything from config baked in, the level mounted by lesson-page.js.
export function lessonBodyHtml(lesson, { games = GAMES, base, writeupHtml }) {
  const wild = wildListHtml(lesson, games, base);
  const stage = lesson.whole
    ? `<section class="play banner-stage" id="play" aria-label="Play this lesson">
  ${bannerStageHtml(lesson, games, base)}
</section>`
    : `<section class="play" id="play" aria-label="Play this lesson">
  <div id="levelRoot" data-level="${lesson.level}"></div>
  <noscript><p>Turn on JavaScript to play this level.</p></noscript>
</section>`;
  return `<section class="lhead">
  <div class="crumb">${crumbHtml(lesson, base)}</div>
  <h1>${esc(lessonLabel(lesson))}</h1>
  <p class="lead">${esc(lesson.says)}</p>
</section>

${stage}
${ownLineHtml(lesson)}

${readHtml(lesson, games, base, writeupHtml)}

<div class="side">
  <section id="watch" aria-label="Watch">${videoSlotHtml(lesson, games)}</section>
  ${wild ? `<section class="wild">${wild}</section>` : ''}
</div>

<p class="done-row">${markDoneHtml(false)}</p>
${neighboursHtml(lesson, base)}`;
}
