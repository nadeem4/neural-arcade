// Track page HTML builders. Pure strings; the generator and the page runtime both use them.
import { GAMES, gameById } from '../games.js';
import { TRACKS } from './index.js';
import { flatLessons, lessonLabel, lessonHref, lessonVideo, trackHref } from './model.js';
import { trackProgress, nextLesson } from './progress.js';
import { esc } from './shell.js';

const STATE_TEXT = { done: 'Done', next: 'Up next', soon: 'Coming soon', '': '' };

export function lessonRowHtml(lesson, { state = '', base = '../', games = GAMES } = {}) {
  const live = lesson.status === 'live';
  const href = lessonHref(lesson, base);
  const label = lessonLabel(lesson);
  const link = (hash, text) => `<a href="${href}#${hash}" aria-label="${text} ${esc(label)}">${text}</a>`;
  const actions = live
    ? `<span class="do">${link('play', 'Play')}${link('read', 'Read')}${lessonVideo(lesson, games) ? link('watch', 'Watch') : ''}</span>`
    : '';
  return `<li class="row" data-lesson="${esc(lesson.id)}" data-state="${state}">
  <span class="num">${lesson.n}</span>
  <span class="what"><b>${esc(lesson.title)}</b><span class="says">${esc(lesson.says ?? '')}</span></span>
  ${actions}
  <span class="st">${STATE_TEXT[state]}</span>
</li>`;
}

export function wildRowHtml(entry, base = '../', games = GAMES) {
  const game = games.find(g => g.id === entry.game);
  return `<li class="wild"><a href="${base}games/${esc(entry.game)}/">Also in ${esc(game?.title ?? entry.game)}</a><span class="says">${esc(entry.says)}</span></li>`;
}

const plural = (n, one, many) => (n === 1 ? one : many);

// The inside of <main> for one track, with the saved progress applied.
export function trackBodyHtml(track, { done = [], base = '../', games = GAMES } = {}) {
  const lessons = flatLessons([track]);
  const prog = trackProgress(done, track);
  const next = nextLesson(done, track);
  const label = `${prog.done} of ${prog.live} ${plural(prog.live, 'lesson', 'lessons')} done`;
  const pct = prog.live ? Math.round((prog.done / prog.live) * 100) : 0;
  const game = track.game ? games.find(g => g.id === track.game) : null;

  const needs = (track.needs ?? []).map(n => {
    const before = lessons.find(l => l.id === n.before);
    const other = TRACKS.find(t => t.id === n.track);
    return before && other
      ? `<p class="needs">Before ${esc(lessonLabel(before))}, you will want <a href="${trackHref(other.id, base)}">${esc(other.title)}</a>.</p>`
      : '';
  }).join('');

  const startText = prog.done === 0 ? 'Start' : 'Continue';
  const button = next
    ? `<a class="btn primary" href="${lessonHref(next, base)}">${startText}: ${esc(lessonLabel(lessons.find(l => l.id === next.id), ', '))}</a>`
    : '';

  const parts = track.parts.map((part, i) => {
    const rows = lessons.filter(l => l.partIndex === i).map(l => {
      const state = l.status === 'soon' ? 'soon' : done.includes(l.id) ? 'done' : next?.id === l.id ? 'next' : '';
      const wild = (l.wild ?? []).filter(w => w.show && w.game !== l.game).map(w => wildRowHtml(w, base, games)).join('\n');
      return lessonRowHtml(l, { state, base, games }) + (wild ? '\n' + wild : '');
    }).join('\n');
    return `<section class="part">
  <h2><span class="num">Part ${i + 1}</span> ${esc(part.title)}</h2>
  <ol class="rows">
${rows}
  </ol>
</section>`;
  }).join('\n');

  return `<div class="thead">
  <h1>${esc(track.title)}</h1>
  <p class="lead">${esc(track.blurb)}</p>
  <div class="facts">
    <div class="prog"><span class="count">${label}</span><div class="bar" role="img" aria-label="${label}"><i style="width:${pct}%"></i></div></div>
    ${game ? `<p>Played in ${esc(game.title)}</p>` : ''}
    ${needs}
    ${button}
  </div>
</div>
${parts}`;
}
