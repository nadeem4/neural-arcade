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

// "In the wild": what other games show of this lesson. The lesson's own game is the caption under the stage instead.
export function wildListHtml(lesson, games = GAMES, base = '') {
  const items = (lesson.wild ?? []).filter(w => w.game !== lesson.game).map(w => {
    const g = games.find(x => x.id === w.game);
    return `<li><a href="${base}games/${esc(w.game)}/">${esc(g?.title ?? w.game)}</a><span>${esc(w.says)}</span></li>`;
  });
  return items.length ? `<h2>In the wild</h2><ul class="wild-list">${items.join('')}</ul>` : '';
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

export const markDoneHtml = done =>
  `<button class="btn" id="markDone" type="button" aria-pressed="${done}">${done ? 'Done<span class="sr"> (undo)</span>' : 'Mark as done'}</button>`;

// The inside of <main> for one lesson: everything from config baked in, the level mounted by lesson-page.js.
export function lessonBodyHtml(lesson, { games = GAMES, base, writeupHtml }) {
  const wild = wildListHtml(lesson, games, base);
  return `<section class="lhead">
  <div class="crumb">${crumbHtml(lesson, base)}</div>
  <h1>${esc(lessonLabel(lesson))}</h1>
  <p class="lead">${esc(lesson.says)}</p>
</section>

<section class="play" id="play" aria-label="Play this lesson">
  <div id="levelRoot" data-level="${lesson.level}"></div>
  <noscript><p>Turn on JavaScript to play this level.</p></noscript>
</section>
${ownLineHtml(lesson)}
<p class="done-row">${markDoneHtml(false)}</p>

<div class="side">
  <section id="watch" aria-label="Watch">${videoSlotHtml(lesson, games)}</section>
  ${wild ? `<section class="wild">${wild}</section>` : ''}
</div>

<div id="read">
${writeupHtml}
</div>
${neighboursHtml(lesson, base)}`;
}
