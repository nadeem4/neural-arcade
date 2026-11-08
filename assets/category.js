// The category page (category/?c=<id>): pure renderers, tested on their own; the page wiring at the bottom only runs in a browser.
import { CATEGORIES, GAMES, categoryModel } from './games.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const stepHtml = (g, base) =>
  `<li class="step"><a class="shot" href="${base}${g.path}" tabindex="-1" aria-hidden="true"><img src="${base}${g.shot}" alt="" loading="lazy"></a>
  <div><h3>${esc(g.title)}</h3><p>${esc(g.lesson)}</p>
    <dl class="facts"><dt>Learns by</dt><dd>${esc(g.learnsBy)}</dd><dt>Goes wrong when</dt><dd class="warn">${esc(g.goesWrongWhen)}</dd></dl>
    <div class="acts"><a class="btn primary" href="${base}${g.path}">Play<span class="sr"> ${esc(g.title)}</span></a>${g.youtube ? `<a class="btn" href="${base}${g.path}#watch">Watch explainer</a>` : ''}<a class="textlink" href="${base}${g.writeup}">How it works</a></div></div></li>`;

export const otherChipsHtml = others =>
  others.map(c => `<a class="chip" href="?c=${c.id}">${esc(c.title)}</a>`).join('') +
  '<a class="chip" href="../games/">Every game</a>';

export const unknownHtml = () =>
  '<h1>We have no such category</h1><p class="lead">That link does not match any category. <a href="../games/">See every game</a>.</p>';

if (typeof document !== 'undefined') {
  const { mountSite } = await import('./site.js');
  mountSite('../');
  const $ = id => document.getElementById(id);
  const m = categoryModel(CATEGORIES, GAMES, new URLSearchParams(location.search).get('c'));
  if (!m) {
    $('found').hidden = true;
    $('missing').innerHTML = unknownHtml();
    $('missing').hidden = false;
    document.title = 'Category not found · Neural Arcade';
  } else {
    document.title = `${m.category.title} · Neural Arcade`;
    $('title').textContent = m.category.title;
    $('lead').textContent = m.category.lead;
    $('crumb').innerHTML = `<a href="../games/">Every game</a> / ${esc(m.category.title)}`;
    if (m.first) {
      $('start').textContent = `Start with ${m.first.title}`;
      $('start').href = `../${m.first.path}`;
    } else $('start').hidden = true;
    $('steps').innerHTML = m.games.map(g => stepHtml(g, '../')).join('');
    $('others').innerHTML = otherChipsHtml(m.others);
  }
}
