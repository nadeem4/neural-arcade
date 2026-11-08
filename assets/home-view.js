// Pure renderers for the home page: data in, HTML out. home.js mounts them.
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>';

export const heroActionsHtml = g =>
  `<a class="btn primary" href="${g.path}">Play ${esc(g.title)} ${PLAY}</a>` +
  (g.youtube ? `<a class="btn" href="${g.path}#watch">Watch the explainer</a>` : '');

const tileHtml = (g, { feature = false, isNew = false } = {}) =>
  `<a class="tile${feature ? ' feature' : ''}" href="${g.path}"><div class="thumb"><img src="${g.shot}" alt="" loading="lazy">${isNew ? '<span class="badge">New</span>' : ''}</div><b>${esc(g.title)}</b><span>${esc(g.learnsBy)}</span></a>`;

export const categoryHtml = ({ category, big, rest, bigIsNew }) =>
  `<section class="category" aria-labelledby="cat-${category.id}">
  <div class="category-info"><h3 id="cat-${category.id}">${esc(category.title)}</h3><p>${esc(category.lead)}</p>
    <a class="seeall" href="category/?c=${category.id}">See every ${esc(category.title)} game</a>${big.youtube ? `<a class="seeall" href="${big.path}#watch">Watch the explainer</a>` : ''}</div>
  <div class="tiles">${tileHtml(big, { feature: true, isNew: bigIsNew })}${rest.map(g => tileHtml(g)).join('')}</div>
</section>`;

export const chipsHtml = chips =>
  '<span class="lbl">All categories</span>' +
  chips.map(c => `<a class="chip" href="category/?c=${c.id}">${esc(c.title)}</a>`).join('') +
  '<a class="chip" href="games/">Browse every game</a>';
