// The browse page (games/): URL state and pure renderers, tested on their own; the page wiring at the bottom only runs in a browser.
import { GAMES, browse } from './games.js';
import { TRACKS } from './tracks/index.js';
import { tracksOfGame } from './tracks/model.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const PAGE_SIZE = 24;

export function parseQuery(search) {
  const p = new URLSearchParams(search);
  const page = parseInt(p.get('page'), 10);
  return {
    q: p.get('q') ?? '',
    track: p.get('t') ?? '',
    sort: p.get('sort') === 'az' ? 'az' : 'newest',
    page: page >= 1 ? page : 1,
  };
}

export function toQuery({ q, track, sort, page }) {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (track) p.set('t', track);
  if (sort !== 'newest') p.set('sort', sort);
  if (page > 1) p.set('page', page);
  const s = p.toString();
  return s ? '?' + s : '';
}

export const rowHtml = (g, tracks, base) =>
  `<li class="row"><a class="thumb" href="${base}${g.path}" tabindex="-1" aria-hidden="true"><img src="${base}${g.shot}" alt="" loading="lazy"></a>
  <div><h2>${esc(g.title)}</h2><p>${esc(g.lesson)}</p></div>
  <div class="meta"><span>${esc(tracksOfGame(g.id, tracks).map(t => t.title).join(', '))}</span>${g.youtube ? '<b>Video explainer</b>' : ''}</div>
  <div class="go"><a class="btn primary" href="${base}${g.path}">Play<span class="sr"> ${esc(g.title)}</span></a></div></li>`;

export const chipsHtml = (tracks, active) =>
  [{ id: '', title: 'All' }, ...tracks].map(c =>
    `<button class="chip" type="button" data-t="${c.id}" aria-pressed="${c.id === active}">${esc(c.title)}</button>`).join('');

export function pagerHtml(page, pages) {
  if (pages <= 1) return '';
  return Array.from({ length: pages }, (_, i) => i + 1).map(n =>
    `<button class="chip" type="button" data-page="${n}"${n === page ? ' aria-current="page"' : ''}>${n}</button>`).join('');
}

if (typeof document !== 'undefined') {
  const { mountSite } = await import('./site.js');
  mountSite('../');
  const $ = id => document.getElementById(id);
  let state = parseQuery(location.search);

  const render = focusSel => {
    const r = browse(GAMES, TRACKS, { ...state, pageSize: PAGE_SIZE });
    state.page = r.page;
    $('chips').innerHTML = chipsHtml(TRACKS, state.track);
    $('list').innerHTML = r.items.map(g => rowHtml(g, TRACKS, '../')).join('');
    $('list').hidden = !r.total;
    $('empty').hidden = !!r.total;
    $('pager').innerHTML = pagerHtml(r.page, r.pages);
    $('status').textContent = r.total ? '' : 'No games match. Clear the search and filters to see them all.';
    history.replaceState(null, '', location.pathname + toQuery(state));
    if (focusSel) document.querySelector(focusSel)?.focus();
  };

  $('q').value = state.q;
  $('sort').value = state.sort;
  $('q').addEventListener('input', e => { state = { ...state, q: e.target.value, page: 1 }; render(); });
  $('sort').addEventListener('change', e => { state = { ...state, sort: e.target.value, page: 1 }; render(); });
  $('chips').addEventListener('click', e => {
    const b = e.target.closest('[data-t]');
    if (b) { state = { ...state, track: b.dataset.t, page: 1 }; render(`[data-t="${b.dataset.t}"]`); }
  });
  $('pager').addEventListener('click', e => {
    const b = e.target.closest('[data-page]');
    if (b) { state = { ...state, page: +b.dataset.page }; render(`[data-page="${b.dataset.page}"]`); scrollTo(0, 0); }
  });
  $('clear').addEventListener('click', () => {
    state = { q: '', track: '', sort: state.sort, page: 1 };
    $('q').value = '';
    render();
  });
  render();
}
