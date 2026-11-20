// Pure renderers for the home page: data in, HTML out. home.js mounts them.
import { TRACKS } from './tracks/index.js';
import { lessonById, lessonLabel, lessonHref, trackHref, trackCounts } from './tracks/model.js';
import { trackProgress } from './tracks/progress.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>';

// The demo's actions sit under the stage; the one primary button on the page is the Continue panel's.
export const heroActionsHtml = g =>
  `<a class="btn" href="${g.path}">Play ${esc(g.title)} ${PLAY}</a>` +
  (g.youtube ? `<a class="btn" href="${g.path}#watch">Watch the explainer</a>` : '');

// The stage head under the hero: the game's title and the demo's words, all from config.
export const stageHeadHtml = g =>
  `<span class="live"><i></i><b>Recorded run</b></span><span>${esc(g.title)}</span><span>${esc(g.demo.net)}</span><span class="sp">${esc(g.demo.learns)}</span>`;

// `target` is continueTarget(done), or null when every live lesson is done.
export function continueHtml(target, base = '') {
  if (!target) return '<p class="eyebrow">Continue</p><p class="cont-line">You have finished every lesson.</p>';
  const lesson = lessonById(target.lesson.id);
  const verb = target.first ? 'Start' : 'Continue';
  return `<p class="eyebrow">${target.first ? 'Start here' : 'Continue'}</p>
<h2 class="cont-line">${verb}: ${esc(lessonLabel(lesson, ', '))}</h2>
<p class="cont-says">${esc(lesson.says ?? '')}</p>
<a class="btn primary" href="${lessonHref(lesson, base)}">${verb}</a>`;
}

export function trackRowHtml(track, done, base = '') {
  const n = TRACKS.findIndex(t => t.id === track.id) + 1;
  const { live, soon } = trackCounts(track);
  const prog = trackProgress(done, track);
  const label = `${prog.done} of ${prog.live} done`;
  const pct = prog.live ? Math.round((prog.done / prog.live) * 100) : 0;
  const verb = prog.done === 0 ? 'Start' : 'Continue';
  return `<li class="trow">
  <span class="num">${n}</span>
  <div class="what"><h2>${esc(track.title)}</h2><p>${esc(track.blurb)}</p></div>
  <div class="prog"><span>${live} ${live === 1 ? 'lesson' : 'lessons'}${soon ? ` · ${soon} coming soon` : ''}</span><div class="pbar" role="img" aria-label="${label}"><i style="width:${pct}%"></i></div><span class="num">${label}</span></div>
  <a class="btn" href="${trackHref(track.id, base)}" aria-label="${verb} ${esc(track.title)}">${verb}</a>
</li>`;
}

export const flowHtml = () =>
  '<li><b>Play</b><span>A level built to show one idea. Try it, then watch the AI try.</span></li>' +
  '<li><b>Read</b><span>A short illustrated page with a playground for the same idea.</span></li>' +
  '<li><b>Watch</b><span>A narrated video of the idea, a few minutes long.</span></li>';
