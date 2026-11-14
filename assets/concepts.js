// The Concepts page: renders every concept from CONCEPTS in assets/games.js, with its click-to-play video (if it has a youtube id)
// and the games that use it. Each section's id is the concept id, so game pages link to concepts/#<id>.
import { CONCEPTS, GAMES } from './games.js';
import { initVideos } from './video.js';

const PLAY = '<svg class="ic" aria-hidden="true" focusable="false" viewBox="0 0 256 256" fill="currentColor"><path d="M232.4,114.49,88.32,26.35a16,16,0,0,0-16.2-.3A15.86,15.86,0,0,0,64,39.87V216.13A15.94,15.94,0,0,0,80,232a16.07,16.07,0,0,0,8.36-2.35L232.4,141.51a15.81,15.81,0,0,0,0-27ZM80,215.94V40l143.83,88Z"/></svg>';

export function conceptHtml(concept, games, base) {
  const video = concept.youtube
    ? `<div class="video" data-youtube="${concept.youtube}" data-title="${concept.title}"><button class="video-play" type="button"><img src="https://i.ytimg.com/vi/${concept.youtube}/hqdefault.jpg" width="480" height="360" loading="lazy" alt=""><span class="video-label">${PLAY}Watch: ${concept.title}</span></button></div>`
    : '';
  const used = games.length
    ? `<p class="used">Used in ${games.map(g => `<a href="${base}${g.path}">${g.title}</a>`).join(', ')}</p>`
    : '';
  return `<section class="concept" id="${concept.id}"><h2>${concept.title}</h2><p>${concept.definition}</p>${video}${used}</section>`;
}

const list = typeof document !== 'undefined' && document.getElementById('concepts');
if (list) {
  list.innerHTML = CONCEPTS.map(c => conceptHtml(c, GAMES.filter(g => g.uses?.includes(c.id)), '../')).join('');
  initVideos(list);
}
