// The browse page (games/): URL state and pure renderers, tested on their own; the page wiring at the bottom only runs in a browser.
import { CATEGORIES, GAMES, browse, categoriesWithGames } from './games.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const PAGE_SIZE = 24;

export function parseQuery(search) {
  const p = new URLSearchParams(search);
  const page = parseInt(p.get('page'), 10);
  return {
    q: p.get('q') ?? '',
    category: p.get('c') ?? '',
    sort: p.get('sort') === 'az' ? 'az' : 'newest',
    page: page >= 1 ? page : 1,
  };
}

export function toQuery({ q, category, sort, page }) {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (category) p.set('c', category);
  if (sort !== 'newest') p.set('sort', sort);
  if (page > 1) p.set('page', page);
  const s = p.toString();
  return s ? '?' + s : '';
}

export const rowHtml = (g, categories, base) =>
  `<li class="row"><a class="thumb" href="${base}${g.path}" tabindex="-1" aria-hidden="true"><img src="${base}${g.shot}" alt="" loading="lazy"></a>
  <div><h3>${esc(g.title)}</h3><p>${esc(g.lesson)}</p></div>
  <div class="meta"><span>${esc(categories.find(c => c.id === g.category)?.title ?? '')}</span>${g.youtube ? '<b>Video explainer</b>' : ''}</div>
  <div class="go"><a class="btn primary" href="${base}${g.path}">Play<span class="sr"> ${esc(g.title)}</span></a></div></li>`;

export const chipsHtml = (categories, active) =>
  [{ id: '', title: 'All' }, ...categories].map(c =>
    `<button class="chip" type="button" data-c="${c.id}" aria-pressed="${c.id === active}">${esc(c.title)}</button>`).join('');

export function pagerHtml(page, pages) {
  if (pages <= 1) return '';
  return Array.from({ length: pages }, (_, i) => i + 1).map(n =>
    `<button class="chip" type="button" data-page="${n}"${n === page ? ' aria-current="page"' : ''}>${n}</button>`).join('');
}

if (typeof document !== 'undefined') {
  const { mountSite } = await import('./site.js');
  mountSite('../');
  const $ = id => document.getElementById(id);
  const chips = categoriesWithGames(CATEGORIES, GAMES);
  let state = parseQuery(location.search);

  const render = () => {
    const r = browse(GAMES, CATEGORIES, { ...state, pageSize: PAGE_SIZE });
    state.page = r.page;
    $('chips').innerHTML = chipsHtml(chips, state.category);
    $('list').innerHTML = r.items.map(g => rowHtml(g, CATEGORIES, '../')).join('');
    $('list').hidden = !r.total;
    $('empty').hidden = !!r.total;
    $('pager').innerHTML = pagerHtml(r.page, r.pages);
    history.replaceState(null, '', location.pathname + toQuery(state));
  };

  $('q').value = state.q;
  $('sort').value = state.sort;
  $('q').addEventListener('input', e => { state = { ...state, q: e.target.value, page: 1 }; render(); });
  $('sort').addEventListener('change', e => { state = { ...state, sort: e.target.value, page: 1 }; render(); });
  $('chips').addEventListener('click', e => {
    const b = e.target.closest('[data-c]');
    if (b) { state = { ...state, category: b.dataset.c, page: 1 }; render(); }
  });
  $('pager').addEventListener('click', e => {
    const b = e.target.closest('[data-page]');
    if (b) { state = { ...state, page: +b.dataset.page }; render(); scrollTo(0, 0); }
  });
  $('clear').addEventListener('click', () => {
    state = { q: '', category: '', sort: state.sort, page: 1 };
    $('q').value = '';
    render();
  });
  render();
}
