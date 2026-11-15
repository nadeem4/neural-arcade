// The Concepts page: renders every concept from CONCEPTS in assets/games.js, with its click-to-play video (if it has a youtube id)
// and the games that use it. Each section's id is the concept id, so game pages link to concepts/#<id>.
import { CONCEPTS, GAMES, conceptHref } from './games.js';
import { initVideos } from './video.js';
import { videoHtml, esc } from './concept-page.js';

export function conceptHtml(concept, games, base) {
  const video = videoHtml(concept);
  const title = concept.page ? `<a href="${conceptHref(concept, base)}">${esc(concept.title)}</a>` : concept.title;
  const used = games.length
    ? `<p class="used">Used in ${games.map(g => `<a href="${base}${g.path}">${g.title}</a>`).join(', ')}</p>`
    : '';
  return `<section class="concept" id="${concept.id}"><h2>${title}</h2><p>${concept.definition}</p>${video}${used}</section>`;
}

const list = typeof document !== 'undefined' && document.getElementById('concepts');
if (list) {
  list.innerHTML = CONCEPTS.map(c => conceptHtml(c, GAMES.filter(g => g.uses?.includes(c.id)), '../')).join('');
  initVideos(list);
}
