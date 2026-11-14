// "How it works" for Treasure Maze: every figure comes from story.json, one seeded run recorded by story-data.js, so
// the pictures match the words on every visit. The figures are still, so they only redraw on resize and theme change.
import { readTheme, wireLamp } from '../../../assets/theme.js';
import { sizeCanvas } from '../../racer/track-view.js';
import { shade } from '../render.js';

const $ = id => document.getElementById(id);
let theme = readTheme();
const S = await (await fetch('../story.json')).json();

const LABEL = { T: '+10', N: '+3', P: '-10' };

// Draw a square grid: shaded values, arrows for a policy, an outlined path, the explorer on the start tile.
function drawGrid(canvas, rows, { values, policy, path } = {}) {
  const { dpr, w } = sizeCanvas(canvas, 1), ctx = canvas.getContext('2d');
  const n = rows.length, cols = rows[0].length, t = w / cols;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, w);
  ctx.font = `600 ${Math.round(t * 0.34)}px ${theme.body}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let s = 0; s < n * cols; s++) {
    const c = rows[Math.floor(s / cols)][s % cols], x = (s % cols) * t, y = Math.floor(s / cols) * t;
    ctx.fillStyle = theme.tray; ctx.fillRect(x, y, t, t);
    if (c === '#') { ctx.fillStyle = theme.ink; ctx.fillRect(x, y, t, t); }
    else if (c === 'P') { ctx.fillStyle = theme.red; ctx.fillRect(x, y, t, t); }
    else if (c === 'T' || c === 'N') { ctx.globalAlpha = c === 'T' ? 1 : 0.5; ctx.fillStyle = theme.amber; ctx.fillRect(x, y, t, t); ctx.globalAlpha = 1; }
    else if (values) { ctx.globalAlpha = shade(values[s]); ctx.fillStyle = theme.amber; ctx.fillRect(x, y, t, t); ctx.globalAlpha = 1; }
    ctx.strokeStyle = theme.rule; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, t - 1, t - 1);
    if (LABEL[c]) { ctx.fillStyle = c === 'P' ? theme.ground : theme['amber-ink']; ctx.fillText(LABEL[c], x + t / 2, y + t / 2); }
    if (policy?.[s] != null) { ctx.fillStyle = theme.ink; ctx.fillText('↑↓←→'[policy[s]], x + t / 2, y + t / 2); }
    if (c === 'S') { ctx.fillStyle = theme.ink; ctx.beginPath(); ctx.arc(x + t / 2, y + t / 2, t * 0.18, 0, Math.PI * 2); ctx.fill(); }
  }
  if (path) {
    ctx.strokeStyle = theme.ink; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.beginPath();
    path.forEach((s, i) => { const x = (s % cols + 0.5) * t, y = (Math.floor(s / cols) + 0.5) * t; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
  }
}

const draws = [];
const add = fn => { draws.push(fn); fn(); };
const near = S.maps['near-or-far'], cliff = S.maps['cliff-edge'];

// ---------- Fig. 1: the world ----------
add(() => drawGrid($('canvasWorld'), near));

// ---------- Fig. 2: value spreads backward ----------
const snaps = S.spread.snapshots, minis = $('spreadGrids');
snaps.forEach(sn => {
  const d = document.createElement('div');
  d.className = 'mini';
  d.innerHTML = `<canvas class="grid" role="img" aria-label="Values after ${sn.episode} episodes"></canvas><p class="mini-cap">Episode ${sn.episode.toLocaleString('en')}</p>`;
  minis.append(d);
  add(() => drawGrid(d.querySelector('canvas'), near, { values: sn.values }));
});
let at = -1;
$('stepThrough').addEventListener('click', () => {
  at = (at + 1) % snaps.length;
  [...minis.children].forEach((d, i) => d.classList.toggle('on', i === at));
  const sn = snaps[at], learned = sn.values.filter(v => v > 0.5).length;
  $('stepNote').textContent = `After ${sn.episode.toLocaleString('en')} episode${sn.episode === 1 ? '' : 's'}: ${learned} tile${learned === 1 ? '' : 's'} worth more than 0.5.`;
});

// ---------- Fig. 3: the discount ----------
for (const [key, id, gid] of [['low', 'policyLow', 'gLow'], ['high', 'policyHigh', 'gHigh']]) {
  const d = S.discount[key];
  $(gid).textContent = d.gamma;
  $(id).setAttribute('aria-label', `Arrows for each tile at discount ${d.gamma}. The explorer ends at the ${d.outcome} treasure.`);
  add(() => drawGrid($(id), near, { policy: d.policy, path: d.path }));
}

// ---------- Fig. 4: exploring near a cliff ----------
add(() => drawGrid($('canvasCliff'), cliff));
for (const [k, key] of [['Low', 'low'], ['High', 'high']]) {
  const c = S.cliff[key];
  $(`c${k}E`).textContent = `${Math.round(c.epsilon * 100)}%`;
  $(`c${k}P`).textContent = c.pits;
  $(`c${k}R`).textContent = c.meanReward.toFixed(1);
}
document.querySelectorAll('.n-eps').forEach(el => { el.textContent = S.cliff.episodes; });
$('seed').textContent = S.seed;

// ---------- Redraw on resize and theme change ----------
const redraw = () => draws.forEach(fn => fn());
new ResizeObserver(redraw).observe(document.body);
wireLamp($('lamp'), () => { theme = readTheme(); redraw(); });
