// Shared by every game page: reads <body data-game="id"> and fills the header, footer, crumb, video, write-up link and "More from".
// Adding a youtube id to the game in games.js is all it takes for the video (and the Watch tab) to appear.
import { CATEGORIES, GAMES, gameById, videoOf, moreFrom } from './games.js';
import { headerHtml, footerHtml } from './site.js';
import { initVideos } from './video.js';

const PLAY = '<svg class="ic" aria-hidden="true" focusable="false" viewBox="0 0 256 256" fill="currentColor"><path d="M232.4,114.49,88.32,26.35a16,16,0,0,0-16.2-.3A15.86,15.86,0,0,0,64,39.87V216.13A15.94,15.94,0,0,0,80,232a16.07,16.07,0,0,0,8.36-2.35L232.4,141.51a15.81,15.81,0,0,0,0-27ZM80,215.94V40l143.83,88Z"/></svg>';

export function videoHtml(game) {
  const v = videoOf(game);
  if (!v) return '';
  return `<div class="video" id="watch" data-youtube="${v.id}" data-title="${game.title}: how it learns">
  <button class="video-play" type="button"><img src="${v.thumb}" width="480" height="360" loading="lazy" alt=""><span class="video-label">${PLAY}Watch: how it learns</span></button>
</div>`;
}

export const writeupHref = (game, base) => base + game.writeup;

export function crumbHtml(game, categories, base) {
  const c = categories.find(c => c.id === game.category);
  return (c ? `<a href="${base}category/?c=${c.id}">${c.title}</a> / ` : '') + game.title;
}

export function moreFromHtml(games, base) {
  return games.map(g => `<a class="tile" href="${base}${g.path}"><div class="thumb"><img src="${base}${g.shot}" alt="" loading="lazy"></div><b>${g.title}</b><span>${g.learnsBy}</span></a>`).join('');
}

export function mountGamePage(base = '../../') {
  const game = gameById(document.body.dataset.game);
  if (!game) return;
  // The page's own script (main.js) wires the theme button, so only the markup is mounted here.
  const header = document.querySelector('header[data-site]'), footer = document.querySelector('footer[data-site]');
  if (header) header.innerHTML = headerHtml(base, header.dataset.site);
  if (footer) footer.innerHTML = footerHtml();
  const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  set('crumb', crumbHtml(game, CATEGORIES, base));

  const video = videoHtml(game);
  if (video) {
    set('watchBox', video);
    document.getElementById('watchCol').hidden = false;
    document.getElementById('switchWatch').hidden = false;
    initVideos(document.getElementById('watchCol'));
  }
  const writeup = document.getElementById('writeup');
  if (writeup) writeup.href = writeupHref(game, base);

  const others = moreFrom(game, GAMES);
  if (others.length) {
    const category = CATEGORIES.find(c => c.id === game.category);
    set('moreTitle', `More from ${category ? category.title : 'the arcade'}`);
    set('moreTiles', moreFromHtml(others, base));
    document.getElementById('moreFrom').hidden = false;
  }

  const tabs = document.querySelectorAll('.switch a');
  tabs.forEach(a => a.addEventListener('click', () => tabs.forEach(x => x.setAttribute('aria-current', String(x === a)))));
}

if (typeof document !== 'undefined' && document.body?.dataset.game) mountGamePage();
