// Treasure Room page: picks a level from the URL, draws the room, and mounts that level's view into the shared stage and panel.
import { wireLamp } from '../../assets/theme.js';
import { sizeCanvas } from '../racer/track-view.js';
import { ROOM } from './sim.js';
import { levelByN, levelFromUrl, navModel } from './levels.js';
import { INFO } from './words.js';
import { drawRoom, cellAt } from './room-view.js';
import * as levelAgent from './level-agent.js';
import * as levelTriples from './level-triples.js';
import * as levelReturn from './level-return.js';
import * as levelPolicy from './level-policy.js';
import * as levelValue from './level-value.js';
import * as levelMdp from './level-mdp.js';

const $ = id => document.getElementById(id);
const canvas = $('stage'), ctx = canvas.getContext('2d');
const arrows = [$('arrowOut'), $('arrowBack')];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const views = { 1: levelAgent, 2: levelTriples, 3: levelReturn, 4: levelPolicy, 5: levelValue, 6: levelMdp }; // the levels built so far; the nav lists only these
const built = Object.keys(views).map(Number);
let view = null, size = { dpr: 1, w: 0 };

const ui = {
  canvas, room: ROOM, panel: $('levelPanel'), tiles: $('tiles'),
  draw(opts) {
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.w);
    drawRoom(ctx, ROOM, { cell: size.w / ROOM.w, ...opts });
  },
  cellAt(e) {
    const r = canvas.getBoundingClientRect();
    return cellAt(r.width, ROOM, e.clientX - r.left, e.clientY - r.top);
  },
  say: t => { $('say').textContent = t; },
  readout(steps, score) { $('steps').textContent = steps; $('score').textContent = score; },
  sees: t => { $('sees').textContent = t; },
  setLog(lines) {
    $('log').replaceChildren(...lines.map(l => Object.assign(document.createElement('li'), { textContent: l })));
  },
  flash() { // the two arrows light for a moment on every step; with reduced motion they stay dark
    if (reduceMotion.matches) return;
    for (const a of arrows) { a.classList.add('lit'); setTimeout(() => a.classList.remove('lit'), 300); }
  },
};

function mountLevel(n) {
  view?.destroy();
  const nav = navModel(built, n);
  n = nav.find(x => x.current).n;
  const level = levelByN(n);
  $('levels').innerHTML = nav.map(x => `<a href="${x.href}"${x.current ? ' aria-current="true"' : ''}><b>${x.n}</b> ${x.title}</a>`).join('');
  document.querySelectorAll('[data-levels]').forEach(el => { el.hidden = !el.dataset.levels.split(' ').includes(String(n)); });
  $('levelTitle').textContent = `Level ${n}: ${level.title}`;
  $('levelBrief').textContent = level.brief;
  $('status').textContent = level.lesson;
  ui.say('');
  ui.setLog([]);
  view = views[n].mount(ui);
}

$('levels').addEventListener('click', e => {
  const a = e.target.closest('a');
  if (!a) return;
  e.preventDefault();
  history.replaceState(null, '', a.getAttribute('href'));
  mountLevel(levelFromUrl(location.search, location.hash));
});

document.querySelectorAll('.info-text[data-info]').forEach(p => { p.textContent = INFO[p.dataset.info]; });
document.querySelectorAll('.info').forEach(btn => btn.addEventListener('click', () => {
  const open = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', String(open));
  $(btn.getAttribute('aria-controls')).hidden = !open;
}));
wireLamp($('lamp'), () => view?.redraw());
new ResizeObserver(() => { size = sizeCanvas(canvas, 1); view?.redraw(); }).observe(document.body);

size = sizeCanvas(canvas, 1);
mountLevel(levelFromUrl(location.search, location.hash));
