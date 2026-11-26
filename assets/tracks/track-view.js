// Track page HTML builders. Pure strings; the generator and the page runtime both use them.
import { GAMES, gameById } from '../games.js';
import { TRACKS } from './index.js';
import { flatLessons, lessonLabel, lessonHref, lessonVideo, trackHref } from './model.js';
import { trackProgress, nextLesson } from './progress.js';
import { esc } from './shell.js';

// Phosphor icons (MIT), as in game-page.js.
const icon = d => `<svg aria-hidden="true" focusable="false" viewBox="0 0 256 256" fill="currentColor"><path d="${d}"/></svg>`;
const ICONS = {
  play: icon('M232.4,114.49,88.32,26.35a16,16,0,0,0-16.2-.3A15.86,15.86,0,0,0,64,39.87V216.13A15.94,15.94,0,0,0,80,232a16.07,16.07,0,0,0,8.36-2.35L232.4,141.51a15.81,15.81,0,0,0,0-27ZM80,215.94V40l143.83,88Z'),
  read: icon('M224,48H160a40,40,0,0,0-32,16A40,40,0,0,0,96,48H32A16,16,0,0,0,16,64V192a16,16,0,0,0,16,16H96a24,24,0,0,1,24,24,8,8,0,0,0,16,0,24,24,0,0,1,24-24h64a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM96,192H32V64H96a24,24,0,0,1,24,24V200A39.81,39.81,0,0,0,96,192Zm128,0H160a39.81,39.81,0,0,0-24,8V88a24,24,0,0,1,24-24h64Z'),
  check: icon('M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z'),
  arrow: icon('M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm45.66-93.66a8,8,0,0,1,0,11.32l-32,32a8,8,0,0,1-11.32-11.32L148.69,136H88a8,8,0,0,1,0-16h60.69l-18.35-18.34a8,8,0,0,1,11.32-11.32Z'),
  watch: icon('M208,40H48A24,24,0,0,0,24,64V176a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V64A24,24,0,0,0,208,40Zm8,136a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V64a8,8,0,0,1,8-8H208a8,8,0,0,1,8,8Zm-48,48a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,224ZM157,113.34l-40-24A8,8,0,0,0,105,96v48a8,8,0,0,0,12,6.86l40-24a8,8,0,0,0,0-13.72ZM121,129.87V110.13L137.45,120Z'),
};

const stateHtml = {
  done: `<span class="st" title="Done">${ICONS.check}<span class="sr">Done</span></span>`,
  next: `<span class="st" title="Up next">${ICONS.arrow}<span class="sr">Up next</span></span>`,
  soon: '<span class="st">Coming soon</span>',
  '': '<span class="st"></span>',
};

export function lessonRowHtml(lesson, { state = '', base = '../', games = GAMES } = {}) {
  const live = lesson.status === 'live';
  const href = lessonHref(lesson, base);
  const label = lessonLabel(lesson);
  const link = (hash, text) => `<a href="${href}#${hash}" aria-label="${text} ${esc(label)}" title="${text}">${ICONS[hash]}</a>`;
  const actions = live
    ? `<span class="do">${link('play', 'Play')}${link('read', 'Read')}${lessonVideo(lesson, games) ? link('watch', 'Watch') : ''}</span>`
    : '';
  return `<li class="row" data-lesson="${esc(lesson.id)}" data-state="${state}">
  <span class="num">${lesson.n}</span>
  <span class="what"><b>${esc(lesson.title)}</b><span class="says">${esc(lesson.says ?? '')}</span></span>
  ${actions}
  ${stateHtml[state]}
</li>`;
}

export function wildRowHtml(entry, base = '../', games = GAMES) {
  const game = games.find(g => g.id === entry.game);
  return `<li class="wild"><a href="${base}games/${esc(entry.game)}/">Also in ${esc(game?.title ?? entry.game)}</a><span class="says">${esc(entry.says)}</span></li>`;
}

const plural = (n, one, many) => (n === 1 ? one : many);

// The progress bar both the track page and the home rows use; `prog` is trackProgress().
export function barHtml(prog, label) {
  const pct = prog.live ? Math.round((prog.done / prog.live) * 100) : 0;
  return `<div class="bar" role="img" aria-label="${label}"><i style="width:${pct}%"></i></div>`;
}

// The inside of <main> for one track, with the saved progress applied.
export function trackBodyHtml(track, { done = [], base = '../', games = GAMES } = {}) {
  const lessons = flatLessons([track]);
  const prog = trackProgress(done, track);
  const next = nextLesson(done, track);
  const label = `${prog.done} of ${prog.live} ${plural(prog.live, 'lesson', 'lessons')} done`;
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
    ? `<a class="btn primary" href="${lessonHref(next, base)}">${ICONS.play}${startText}: ${esc(lessonLabel(lessons.find(l => l.id === next.id), ', '))}</a>`
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
    <div class="prog"><span class="count">${label}</span>${barHtml(prog, label)}</div>
    ${game ? `<p>Played in ${esc(game.title)}</p>` : ''}
    ${needs}
    ${button}
  </div>
</div>
${parts}`;
}
