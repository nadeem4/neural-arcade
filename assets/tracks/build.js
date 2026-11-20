// Pure page generator: config in, { published path: HTML } out. scripts/build-pages.mjs writes or checks the files.
import { TRACKS } from './index.js';
import { GAMES } from '../games.js';
import { pageHtml } from './shell.js';
import { trackBodyHtml } from './track-view.js';

const SITE_ALT = 'Neural Arcade: small browser games where tiny neural networks learn in front of you';

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

// `files` (read, exists) is for later slices that look at files already on disk; the track pages do not need it.
export function buildPages({ tracks = TRACKS, games = GAMES, files = { read: () => null, exists: () => false } } = {}) {
  void files;
  const out = {};
  for (const track of tracks) out[`${track.id}/index.html`] = trackPageHtml(track, games);
  return out;
}
