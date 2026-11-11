// "How it works" for Balance: the figures come from story.json, one seeded run recorded by story-data.js, so the
// pictures match the words on every visit. Only Fig. 1 plays live, replaying the trained brain on the real sim.
import { createActs } from '../../../engine/tinynet.js';
import { drawBars } from '../../../engine/curve.js';
import { drawBrain } from '../../../engine/brain-panel.js';
import { makeTicker } from '../../../engine/ticker.js';
import { readTheme, wireLamp } from '../../../assets/theme.js';
import { sizeCanvas } from '../../racer/track-view.js';
import { newGame, step, LIMIT, FAIL_ANGLE } from '../sim.js';
import { SIZES, IN_LABELS, OUT_LABELS, aiAct } from '../ai.js';
import { describeInput, describeOutput } from '../words.js';
import { layout, drawStage } from '../render.js';

const $ = id => document.getElementById(id);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let theme = readTheme();
const S = await (await fetch('../story.json')).json();
const DEG = 180 / Math.PI;

// ---------- Figure plumbing ----------
const figs = [], visible = new Set();
const io = new IntersectionObserver(entries => entries.forEach(e => {
  const fig = figs.find(f => f.el === e.target);
  if (e.isIntersecting) visible.add(fig); else visible.delete(fig);
}), { rootMargin: '80px' });
function addFigure(fig) { figs.push(fig); io.observe(fig.el); }

// A canvas that redraws itself at its own size: draw(ctx, w, h) is called on every resize and theme change.
function still(canvas, draw, ratio) {
  const ctx = canvas.getContext('2d');
  return {
    el: canvas,
    resize() { const v = sizeCanvas(canvas, ratio); ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0); this.w = v.w; this.h = v.h; },
    draw() { draw(ctx, this.w, this.h); },
  };
}

// A line chart over time. The time axis comes from the data (samples x S.every steps at 60 per second), so traces of
// different lengths sit on one chart. `limit` draws dashed lines at +/- that value; `end` marks where a try ended.
function lineChart(ctx, w, h, series, { unit, max, limit, every = S.every }) {
  ctx.clearRect(0, 0, w, h);
  const left = 44, top = 10, bottom = h - 22, right = w - 6;
  const tmax = Math.max(...series.map(s => s.v.length)) * every / 60;
  const x = t => left + (t / tmax) * (right - left), y = v => (top + bottom) / 2 - (v / max) * (bottom - top) / 2;
  ctx.font = `400 13px ${theme.body}`; ctx.textBaseline = 'middle';
  ctx.strokeStyle = theme.rule; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(left, y(0) + 0.5); ctx.lineTo(right, y(0) + 0.5); ctx.stroke();
  ctx.setLineDash([4, 4]);
  for (const v of limit ? [limit, -limit] : []) { ctx.beginPath(); ctx.moveTo(left, y(v)); ctx.lineTo(right, y(v)); ctx.stroke(); }
  ctx.setLineDash([]);
  ctx.fillStyle = theme.muted; ctx.textAlign = 'right';
  ctx.fillText('0', left - 6, y(0));
  ctx.fillText(`+${max}`, left - 6, top + 6); ctx.fillText(`-${max}`, left - 6, bottom - 6);
  ctx.textAlign = 'left'; ctx.fillText('0 s', left, h - 8);
  ctx.textAlign = 'right'; ctx.fillText(`${Math.round(tmax)} s`, right, h - 8);
  ctx.fillText(unit, right, top + 6);
  ctx.lineJoin = 'round'; ctx.lineWidth = 2;
  for (const s of series) {
    ctx.strokeStyle = s.color; ctx.beginPath();
    s.v.forEach((v, i) => (i ? ctx.lineTo(x(i * every / 60), y(v)) : ctx.moveTo(x(0), y(v))));
    ctx.stroke();
    if (s.fell) { ctx.fillStyle = theme.red; ctx.beginPath(); ctx.arc(x((s.v.length - 1) * every / 60), y(s.v.at(-1)), 4, 0, Math.PI * 2); ctx.fill(); }
  }
}
const deg = v => v.map(a => a * DEG);
const LIMIT_DEG = Math.round(FAIL_ANGLE * DEG * 10) / 10;
const angle = (canvas, lines) => addFigure(still(canvas, (ctx, w, h) => lineChart(ctx, w, h, lines(), { unit: 'degrees', max: 25, limit: LIMIT_DEG })));

// ---------- Fig. 1: the trained brain, live ----------
{
  const canvas = $('figPlay'), ctx = canvas.getContext('2d');
  const genome = S.ai.late.genome, acts = createActs(SIZES), input = new Float32Array(4);
  let g = newGame(), u = 0, hold = 0, view = {};
  const draw = () => {
    const { dpr, w, h } = view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = theme.tray; ctx.fillRect(0, 0, w, h);
    drawStage(ctx, g, { lay: layout(w, h), theme, force: u });
  };
  addFigure({
    el: canvas,
    resize() { view = sizeCanvas(canvas, 5 / 8); draw(); },
    step() {
      if (reduce) return;
      if (hold > 0) { if (--hold === 0) { g = newGame(); u = 0; } return; }
      u = aiAct(genome, g, acts, input);
      if (step(g, u) || g.t >= LIMIT) hold = 90;
    },
    draw,
  });
}

// ---------- Figs. 2-4: the PID traces ----------
const ink = () => theme.ink, amber = () => theme.amber;
angle($('figP'), () => [{ v: deg(S.pid.pOnly.th), color: ink(), fell: S.pid.pOnly.fell }]);
angle($('figD'), () => [{ v: deg(S.pid.pOnly.th), color: ink(), fell: S.pid.pOnly.fell }, { v: deg(S.pid.pd.th), color: amber() }]);
addFigure(still($('figI'), (ctx, w, h) => lineChart(ctx, w, h,
  [{ v: S.pid.windNoI.x, color: ink() }, { v: S.pid.windI.x, color: amber() }], { unit: 'metres', max: 1.5 })));
$('xNoI').textContent = Math.abs(S.pid.windNoI.x.at(-1)).toFixed(1);
$('xI').textContent = Math.abs(S.pid.windI.x.at(-1)).toFixed(2);

// ---------- Fig. 5: generations ----------
addFigure(still($('figGens'), (ctx, w, h) => drawBars(ctx, S.ai.history, { width: w, height: h, max: LIMIT / 60, maxLabel: '20 s', theme, slots: S.ai.history.length })));
for (const id of ['nFull', 'nFull2']) $(id).textContent = S.ai.firstFull;
$('nLast').textContent = S.ai.history.length;

// ---------- Fig. 6: first versus last best brain ----------
for (const [name, rec] of [['Early', S.ai.early], ['Late', S.ai.late]]) {
  const acts = createActs(SIZES), input = new Float32Array(4), g = newGame(0.2);
  aiAct(rec.genome, g, acts, input);   // the network is drawn thinking about a clear lean to the right
  addFigure(still($(`brain${name}`), (ctx, w, h) => drawBrain(ctx, {
    sizes: SIZES, genome: rec.genome, acts, inLabels: IN_LABELS, outLabels: OUT_LABELS,
    heads: ['Senses', '6 hidden', 'Push'], inWords: describeInput, outWords: describeOutput, theme, width: w, height: h,
  })));
  angle($(`trace${name}`), () => [{ v: deg(rec.th), color: ink(), fell: rec.seconds < LIMIT / 60 }]);
}
$('seed').textContent = S.seed;

// ---------- Loop: only the live replay animates ----------
const ticker = makeTicker();
function frame(now) {
  for (let k = ticker(now); k > 0; k--) for (const fig of visible) fig.step?.();
  for (const fig of visible) if (fig.step) fig.draw();
  requestAnimationFrame(frame);
}
function resizeAll() { for (const fig of figs) { fig.resize(); fig.draw(); } }
new ResizeObserver(resizeAll).observe(document.body);
wireLamp($('lamp'), () => { theme = readTheme(); resizeAll(); });
requestAnimationFrame(frame);
