// Pure page generator: config in, { published path: HTML } out. scripts/build-pages.mjs writes or checks the files.
import { TRACKS } from './index.js';
import { GAMES } from '../games.js';
import { pageHtml } from './shell.js';
import { trackBodyHtml } from './track-view.js';
import { lessonBodyHtml } from './lesson-view.js';
import { flatLessons, lessonLabel } from './model.js';

const SITE_ALT = 'Neural Arcade: small browser games where tiny neural networks learn in front of you';

// The (i) icon the mounted Treasure Room level uses; a host page defines it once.
const INFO_ICON = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="i" viewBox="0 0 256 256"><path fill="currentColor" d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z"/></symbol></svg>';

export function trackPageHtml(track, games) {
  return pageHtml({
    title: `${track.title} · Neural Arcade`,
    description: track.blurb,
    path: `${track.id}/`,
    depth: 1,
    styles: ['assets/track.css'],
    siteKey: track.id,
    bodyAttrs: `data-track="${track.id}"`,
    mainAttrs: 'id="track" class="wrap"',
    mainHtml: trackBodyHtml(track, { done: [], base: '../', games }),
    scripts: ['assets/track-page.js'],
    imageAlt: SITE_ALT,
  });
}

// A live lesson: the shell plus concepts/<id>/writeup.html, with page.js beside it when there is one.
// A level lesson needs its write-up and mounts the Treasure Room level; a whole-game lesson shows the game's banner
// instead, loads no game CSS, and may have no write-up (its Read link goes to the game's How it works).
export function lessonPageHtml(lesson, games, files) {
  const whole = lesson.whole;
  const writeup = files.read(`concepts/${lesson.id}/writeup.html`);
  if (writeup == null && !whole) throw new Error(`concepts/${lesson.id}/writeup.html is missing`);
  const writeupHtml = (writeup ?? '').replace(/\s+$/, '');
  const own = files.exists(`concepts/${lesson.id}/share.png`);
  const image = own ? `concepts/${lesson.id}/share.png` : whole ? `games/${lesson.game}/share.png` : 'assets/share.png';
  const body = lessonBodyHtml(lesson, { games, base: '../../', writeupHtml });
  return pageHtml({
    title: `${lessonLabel(lesson)} · Neural Arcade`,
    description: lesson.says,
    path: `concepts/${lesson.id}/`,
    depth: 2,
    styles: whole ? ['assets/concept.css', 'assets/lesson.css']
      : ['assets/game.css', 'games/treasure-room/treasure-room.css', 'assets/concept.css', 'assets/lesson.css'],
    siteKey: lesson.trackId,
    bodyAttrs: `data-lesson="${lesson.id}"`,
    mainAttrs: 'class="wrap concept-page lesson-page"',
    mainHtml: whole ? body : INFO_ICON + '\n' + body,
    scripts: ['assets/lesson-page.js', ...(files.exists(`concepts/${lesson.id}/page.js`) ? ['./page.js'] : [])],
    image,
    imageAlt: lesson.shareAlt ?? (own || whole ? `${lessonLabel(lesson)}, a Neural Arcade lesson` : SITE_ALT),
  });
}

// `files` (read, exists) looks at the hand-made files beside the generated pages.
export function buildPages({ tracks = TRACKS, games = GAMES, files = { read: () => null, exists: () => false } } = {}) {
  const out = {};
  for (const track of tracks) out[`${track.id}/index.html`] = trackPageHtml(track, games);
  for (const lesson of flatLessons(tracks)) {
    if (lesson.status === 'live') out[`concepts/${lesson.id}/index.html`] = lessonPageHtml(lesson, games, files);
  }
  return out;
}
