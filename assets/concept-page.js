// Shared builders for the concept pages (concepts/<id>/) and the video facade used by the Concepts list.
import { GAMES, conceptById, conceptHref } from './games.js';
import { initVideos } from './video.js';

export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PLAY = '<svg class="ic" aria-hidden="true" focusable="false" viewBox="0 0 256 256" fill="currentColor"><path d="M232.4,114.49,88.32,26.35a16,16,0,0,0-16.2-.3A15.86,15.86,0,0,0,64,39.87V216.13A15.94,15.94,0,0,0,80,232a16.07,16.07,0,0,0,8.36-2.35L232.4,141.51a15.81,15.81,0,0,0,0-27ZM80,215.94V40l143.83,88Z"/></svg>';

export const videoHtml = concept => concept.youtube
  ? `<div class="video" data-youtube="${esc(concept.youtube)}" data-title="${esc(concept.title)}"><button class="video-play" type="button"><img src="https://i.ytimg.com/vi/${esc(concept.youtube)}/hqdefault.jpg" width="480" height="360" loading="lazy" alt=""><span class="video-label">${PLAY}Watch: ${esc(concept.title)}</span></button></div>`
  : '';

// "Play this level": a link to the first game that has a level teaching this concept (games.js `levels`).
export const playLevelHtml = (concept, games, base) => {
  const g = games.find(x => x.levels?.[concept.id]);
  if (!g) return '';
  const n = g.levels[concept.id];
  return `<p class="play-level"><a class="btn" href="${base}${g.path}?level=${n}">Play this level: ${esc(g.title)}, level ${n}</a></p>`;
};

export const gamesHtml = (concept, games, base) => games.length
  ? '<h2>See it in the games</h2>' + playLevelHtml(concept, games, base) + '<div class="games">' + games.map(g =>
    `<a class="game" href="${base}${g.path}"><h3>${esc(g.title)}</h3><p>${esc(g.lesson ?? '')}</p>${g.where?.[concept.id] ? `<p class="where">${esc(g.where[concept.id])}</p>` : ''}</a>`).join('') + '</div>'
  : '';

export const relatedHtml = (concept, base) => {
  const chips = (concept.related ?? []).map(conceptById).filter(Boolean)
    .map(c => `<a class="chip" href="${conceptHref(c, base)}">${esc(c.title)}</a>`).join('');
  return chips ? `<h2>Where it fits</h2><div class="chips">${chips}</div>` : '';
};

export const triesHtml = presets => presets.map((p, i) =>
  `<li><button type="button" data-preset="${i}">${esc(p.label)}</button> ${esc(p.text)}</li>`).join('');

export function mountConceptPage(id, base, doc = document) {
  const concept = conceptById(id);
  if (!concept) return;
  const games = GAMES.filter(g => g.uses?.includes(id));
  const fill = (elId, html) => {
    const el = doc.getElementById(elId);
    if (!el) return;
    el.innerHTML = html;
    el.hidden = !html;
  };
  const video0 = videoHtml(concept);
  fill('video', video0 && `<h2>Watch it explained</h2>${video0}`);
  fill('games', gamesHtml(concept, games, base));
  fill('related', relatedHtml(concept, base));
  const video = doc.getElementById('video');
  if (video) initVideos(video);
}

export function wireTries(root, presets, apply) {
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-preset]');
    if (b) apply(presets[Number(b.dataset.preset)].state);
  });
}
