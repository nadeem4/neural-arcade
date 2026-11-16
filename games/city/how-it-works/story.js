// "How it works" for Reward City: every figure comes from story.json, one seeded run recorded by story-data.js,
// turned into draw lists by story-model.js. The figures are still, so they only redraw on resize and theme change.
import { readTheme, wireLamp } from '../../../assets/theme.js';
import { sizeCanvas } from '../../racer/track-view.js';
import { figureModel } from '../story-model.js';
import { PRESETS } from '../presets.js';

const $ = id => document.getElementById(id);
let theme = readTheme();
const S = await (await fetch('../story.json')).json();
const M = figureModel(S);
const nameOf = id => PRESETS.find(p => p.id === id)?.name ?? id;

const GREEN = '#2E5E3E', BLUE = '#2F5E8A';
const ARROW = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

// Fill colour per tile kind, taken from the theme so both modes read well.
const fillOf = k => ({
  r: theme.road, b: theme.edge, f: theme.muted, p: GREEN, w: BLUE, x: theme.ink,
})[k];

// Draw the whole map: tiles by kind, one-way arrows, lights, then the pickup and drop-off. `dim` fades it behind a route or heat.
function drawMap(canvas, fig, { dim = 1, route, heat } = {}) {
  const { cols, rows } = fig;
  const { dpr, w } = sizeCanvas(canvas, rows / cols), t = w / cols, ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, w * rows / cols);
  ctx.fillStyle = theme.tray; ctx.fillRect(0, 0, w, w * rows / cols);
  ctx.globalAlpha = dim;
  for (const { kind, cells } of fig.tiles) {
    ctx.fillStyle = fillOf(kind);
    for (const [c, r] of cells) ctx.fillRect(c * t, r * t, t + 0.5, t + 0.5);
  }
  if (!heat) {
    ctx.strokeStyle = theme.ground; ctx.lineWidth = Math.max(1, t * 0.3); ctx.lineCap = 'round';
    for (const { cell: [c, r], dir } of fig.oneway) {
      const [dx, dy] = ARROW[dir], cx = (c + 0.5) * t, cy = (r + 0.5) * t;
      ctx.beginPath(); ctx.moveTo(cx - dx * t * 0.4, cy - dy * t * 0.4); ctx.lineTo(cx + dx * t * 0.4, cy + dy * t * 0.4); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  if (heat) {
    heat.forEach((row, r) => [...row].forEach((d, c) => {
      if (d === '0') return;
      ctx.globalAlpha = 0.25 + 0.75 * (Number(d) / 9); ctx.fillStyle = theme.amber; ctx.fillRect(c * t, r * t, t + 0.5, t + 0.5);
    }));
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = theme.red;
    for (const [c, r] of fig.signals) ctx.fillRect(c * t - t * 0.25, r * t - t * 0.25, t * 1.5, t * 1.5);
  }
  if (route) {
    const pts = route.map(([c, r]) => [(c + 0.5) * t, (r + 0.5) * t]);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [style, lw] of [[theme.ground, Math.max(4, t * 1.3)], [theme.amber, Math.max(2, t * 0.7)]]) {
      ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.beginPath();
      pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.stroke();
    }
  }
  const dot = ([c, r], fill) => {
    ctx.fillStyle = theme.ground; ctx.beginPath(); ctx.arc((c + 0.5) * t, (r + 0.5) * t, Math.max(5, t * 1.6), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = fill; ctx.beginPath(); ctx.arc((c + 0.5) * t, (r + 0.5) * t, Math.max(3.5, t * 1.1), 0, Math.PI * 2); ctx.fill();
  };
  dot(fig.pickup, theme.ink); dot(fig.dropoff, theme.red);
}

const draws = [];
const add = fn => { draws.push(fn); fn(); };
const mk = (parent, label, cap) => {
  const d = document.createElement('div');
  d.className = 'mini';
  d.innerHTML = `<canvas class="map" role="img" aria-label="${label}"></canvas><p class="mini-cap">${cap}</p>`;
  parent.append(d);
  return d.querySelector('canvas');
};

// ---------- Fig. 1: the map ----------
add(() => drawMap($('canvasMap'), M.fig1));

// ---------- Fig. 2: where the taxi has been ----------
for (const sn of M.fig2.snapshots) {
  const n = sn.episode.toLocaleString('en');
  const cv = mk($('learnGrids'), `Map shaded by how often the taxi visited each square after ${n} trips`, `After ${n} trip${sn.episode === 1 ? '' : 's'}`);
  add(() => drawMap(cv, { ...M.fig1 }, { dim: 0.45, heat: sn.digits }));
}

// ---------- Fig. 3: the first three loopholes ----------
const caption = c => `<b>${nameOf(c.id)}</b><br>Pay: ${c.receipt.total}. ${c.verdict}`;
for (const c of M.fig3) {
  const cv = mk($('loopholes'), `The route after the pay slip "${nameOf(c.id)}". ${c.verdict}`, caption(c));
  add(() => drawMap(cv, M.fig1, { dim: 0.55, route: c.polyline }));
}

// ---------- Fig. 4: legal against paid by the mile ----------
for (const c of [M.fig4.legal, M.fig4.loop]) {
  const cv = mk($('endings'), `The route after the pay slip "${nameOf(c.id)}". ${c.verdict}`, caption(c));
  add(() => drawMap(cv, M.fig1, { dim: 0.55, route: c.polyline }));
}

$('seed').textContent = S.seed;

// ---------- Redraw on resize and theme change ----------
const redraw = () => draws.forEach(fn => fn());
new ResizeObserver(redraw).observe(document.body);
wireLamp($('lamp'), () => { theme = readTheme(); redraw(); });
