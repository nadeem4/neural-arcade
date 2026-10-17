// "How it works" for Teach by Driving: every figure is drawn from one seeded lesson (track 2), recorded by
// story-data.js, so the pictures match the words on every visit. Animated figures only run while on screen.
import { mulberry32 } from '../../../engine/rng.js';
import { drawBrain } from '../../../engine/brain-panel.js';
import { drawLine } from '../../../engine/curve.js';
import { createActs, forward } from '../../../engine/tinynet.js';
import { trainEpoch, datasetLoss } from '../../../engine/train.js';
import { readTheme, wireLamp } from '../../../assets/theme.js';
import { WORLD_W, WORLD_H, TRACK_W, IN_LABELS, describeInput, describeOutput } from '../../racer/sim.js';
import { drawTrack, sizeCanvas } from '../../racer/track-view.js';
import { TEACH_SIZES, newCar, stepTeach, autopilot } from '../sim.js';
import { recordLesson, lossCurve, rollDown, bestHill } from '../story-data.js';

const L = recordLesson(2);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
const laps = pct => `${Math.round(pct) / 100} laps`;
const fmt = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2);
let theme = readTheme();

// ---------- Figure plumbing ----------
const figs = [], visible = new Set();
const io = new IntersectionObserver(entries => entries.forEach(e => {
  const fig = figs.find(f => f.el === e.target);
  if (e.isIntersecting) { visible.add(fig); fig.enter?.(); } else visible.delete(fig);
}), { rootMargin: '80px' });
function addFigure(fig) { figs.push(fig); io.observe(fig.el); }

// ---------- Fig. 1: the teaching laps, live ----------
{
  const canvas = $('figLap'), ctx = canvas.getContext('2d');
  let car = newCar(L.track), frame = 0, view = {};
  if (reduce) for (; frame < 200; frame++) stepTeach(car, L.track, { want: autopilot(car), frame });
  addFigure({
    el: canvas,
    resize() { const t = sizeCanvas(canvas, WORLD_H / WORLD_W); view = { dpr: t.dpr, scale: t.w / WORLD_W }; },
    step() {
      if (reduce) return;
      stepTeach(car, L.track, { want: autopilot(car), frame: frame++ });
      if (!car.alive) { car = newCar(L.track); frame = 0; }
    },
    draw() { drawTrack(ctx, { track: L.track, cars: [car] }, car, theme, view); },
  });
}

// ---------- Fig. 2: a few examples ----------
{
  const picks = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85].map(f => L.examples[Math.floor(f * L.examples.length)]);
  const heads = ['Left 60°', 'Left 30°', 'Ahead', 'Right 30°', 'Right 60°', 'Speed'];
  $('figExamples').innerHTML = `<thead><tr><th scope="colgroup" colspan="6">What the car sensed</th><th scope="col" class="ans">How you steered</th></tr>
    <tr>${heads.map(h => `<th scope="col">${h}</th>`).join('')}<th scope="col" class="ans"></th></tr></thead>
    <tbody>${picks.map(ex => `<tr>${[...ex.input].map(v => `<td>${v.toFixed(2)}</td>`).join('')}<td class="ans">${fmt(ex.target[0])} <span>${describeOutput(0, ex.target[0])}</span></td></tr>`).join('')}</tbody>`;
  $('exCount').textContent = L.examples.length.toLocaleString('en');
}

// ---------- Fig. 3: one guess and its gap ----------
{
  const acts = createActs(TEACH_SIZES);
  // The example where the untrained brain is most wrong, so the gap is easy to see.
  let ex = L.examples[0], worst = -1;
  for (const e of L.examples) {
    const d = Math.abs(forward(L.start, TEACH_SIZES, e.input, acts)[0] - e.target[0]);
    if (d > worst) { worst = d; ex = e; }
  }
  const guess = forward(L.start, TEACH_SIZES, ex.input, acts)[0], answer = ex.target[0], gap = guess - answer;
  const pos = v => `${((v + 1) / 2) * 100}%`;
  $('figGap').innerHTML = `
    <div class="scale"><span>−1 full left</span><span>0</span><span>+1 full right</span></div>
    <div class="axis">
      <i class="span" style="left:${pos(Math.min(guess, answer))};width:${(Math.abs(gap) / 2) * 100}%"></i>
      <i class="mark you" style="left:${pos(answer)}"></i><i class="mark guess" style="left:${pos(guess)}"></i>
    </div>
    <dl class="gap-nums">
      <div><dt>You steered</dt><dd>${fmt(answer)} · ${describeOutput(0, answer)}</dd></div>
      <div><dt>It guessed</dt><dd>${fmt(guess)} · ${describeOutput(0, guess)}</dd></div>
      <div><dt>Gap</dt><dd>${Math.abs(gap).toFixed(2)}</dd></div>
      <div><dt>½ × gap²</dt><dd>${(0.5 * gap * gap).toFixed(3)}</dd></div>
    </dl>`;
  $('lossStart').textContent = L.losses[0].toFixed(3);
}

// ---------- Fig. 4: one weight, one hill, a ball rolling down ----------
{
  const canvas = $('figHill'), ctx = canvas.getContext('2d');
  const hill = bestHill(L.trained, L.examples), curve = lossCurve(L.trained, L.examples, hill.index, { span: 3, steps: 80 });
  const ball = rollDown(L.trained, L.examples, hill.index, hill.from, { steps: 24 });
  const from = hill.index - TEACH_SIZES[0] * TEACH_SIZES[1] - TEACH_SIZES[1];
  $('hillCaption').textContent = `The loss as one of the 65 numbers (${from < TEACH_SIZES[1] ? `hidden neuron ${from + 1} to steering` : 'steering’s bias'}) slides, with the other 64 held still. The ball starts at ${ball[0].loss.toFixed(2)} and takes ${ball.length - 1} steps downhill to ${ball.at(-1).loss.toFixed(3)}.`;
  let size = {}, start = null;
  const maxL = Math.max(...curve.map(p => p.loss)), w0 = curve[0].w, w1 = curve.at(-1).w;
  addFigure({
    el: canvas,
    enter() { start ??= reduce ? -Infinity : performance.now(); },
    resize() { size = sizeCanvas(canvas); ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0); },
    draw(now) {
      const { w, h } = size, pad = 28, x = v => pad + ((v - w0) / (w1 - w0)) * (w - pad * 2), y = l => h - pad - (l / maxL) * (h - pad * 2);
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = theme.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad, h - pad + 0.5); ctx.lineTo(w - pad, h - pad + 0.5); ctx.stroke();
      ctx.fillStyle = theme.muted; ctx.font = `400 13px ${theme.body}`; ctx.textBaseline = 'middle';
      ctx.textAlign = 'left'; ctx.fillText('loss', pad, 10);
      ctx.textAlign = 'right'; ctx.fillText('the weight’s value →', w - pad, h - 10);
      ctx.strokeStyle = theme.ink; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.beginPath(); curve.forEach((p, i) => (i ? ctx.lineTo(x(p.w), y(p.loss)) : ctx.moveTo(x(p.w), y(p.loss)))); ctx.stroke();
      // One step every 450ms once on screen; earlier positions stay as faint dots.
      const k = start === null ? 0 : Math.min(ball.length - 1, Math.floor((now - start) / 450));
      ctx.fillStyle = theme.muted;
      for (let i = 0; i < k; i++) { ctx.beginPath(); ctx.arc(x(ball[i].w), y(ball[i].loss), 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = theme.amber;
      ctx.beginPath(); ctx.arc(x(ball[k].w), y(ball[k].loss) - 7, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = theme.ink; ctx.textAlign = 'center';
      ctx.fillText(`step ${k}`, x(ball[k].w), y(ball[k].loss) - 26);
    },
  });
}

// ---------- Fig. 5: the loss falling, and the brain before and after ----------
{
  const canvas = $('figLoss'), ctx = canvas.getContext('2d'), passes = L.losses.length - 1;
  $('passes').textContent = passes;
  $('afterLabel').textContent = `After ${passes} passes`;
  let size = {};
  addFigure({
    el: canvas,
    resize() { size = sizeCanvas(canvas); ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0); },
    draw() { drawLine(ctx, L.losses, { width: size.w, height: size.h, theme, empty: '', last: n => `${n} passes` }); },
  });
  const ex = L.examples[Math.floor(L.examples.length * 0.4)];
  for (const [id, genome] of [['brainBefore', L.start], ['brainAfter', L.trained]]) {
    const c = $(id), cx = c.getContext('2d'), acts = createActs(TEACH_SIZES);
    forward(genome, TEACH_SIZES, ex.input, acts);
    let size2 = {};
    addFigure({
      el: c,
      resize() { size2 = sizeCanvas(c); cx.setTransform(size2.dpr, 0, 0, size2.dpr, 0, 0); },
      draw() {
        drawBrain(cx, { sizes: TEACH_SIZES, genome, acts, inLabels: IN_LABELS, outLabels: ['Steer'], inWords: describeInput, outWords: describeOutput, theme, width: size2.w, height: size2.h });
      },
    });
  }
}

// ---------- Figs. 6 and 7: paths on mini tracks ----------
const roadPath = (() => { const p = new Path2D(); L.track.pts.forEach((pt, i) => (i ? p.lineTo(pt.x, pt.y) : p.moveTo(pt.x, pt.y))); p.closePath(); return p; })();

function box(points, pad) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  let w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2;
  if (w / h > WORLD_W / WORLD_H) h = (w * WORLD_H) / WORLD_W; else w = (h * WORLD_W) / WORLD_H;
  return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w };
}
const FULL = { x: 0, y: 0, w: WORLD_W };

// layers: [{ path, upTo, style: 'dash' | 'line' | 'took' | 'done', taken? }], ends: [{ x, y, kind: 'crash' }]
function drawMini(ctx, size, b, layers, t, ends) {
  const k = size.w / b.w, px = 1 / k;
  ctx.setTransform(k * size.dpr, 0, 0, k * size.dpr, -b.x * k * size.dpr, -b.y * k * size.dpr);
  ctx.fillStyle = theme.tray; ctx.fillRect(b.x, b.y, b.w, b.w);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.lineWidth = TRACK_W; ctx.strokeStyle = theme.road; ctx.stroke(roadPath);
  for (const layer of layers) {
    const n = Math.max(2, Math.round(layer.path.length * (layer.still ? 1 : t)));
    const seg = (a, z, style) => {
      ctx.setLineDash(style === 'dash' ? [5 * px, 5 * px] : []);
      ctx.lineWidth = (style === 'took' ? 5 : 2.2) * px;
      ctx.strokeStyle = style === 'took' || style === 'done' ? theme.amber : style === 'dash' ? theme.muted : theme.ink;
      ctx.beginPath(); ctx.moveTo(...layer.path[a]);
      for (let i = a + 1; i < z; i++) ctx.lineTo(...layer.path[i]);
      ctx.stroke();
    };
    seg(0, n, layer.style);
    // Frames where the teacher had the wheel, drawn thick over the brain's own line.
    if (layer.taken) {
      const set = new Set(layer.taken);
      let i = 1;
      while (i < n) {
        if (!set.has(i)) { i++; continue; }
        let j = i; while (j < n && set.has(j)) j++;
        seg(i - 1, Math.min(n, j + 1), 'took'); i = j;
      }
    }
  }
  ctx.setLineDash([]);
  if (t >= 1) for (const e of ends) {
    const r = 7 * px;
    ctx.lineWidth = 2.6 * px; ctx.strokeStyle = theme.red;
    ctx.beginPath(); ctx.moveTo(e.x - r, e.y - r); ctx.lineTo(e.x + r, e.y + r); ctx.moveTo(e.x + r, e.y - r); ctx.lineTo(e.x - r, e.y + r); ctx.stroke();
  }
}

function minis(el, panels) {
  el.innerHTML = panels.map(p => `<figure class="mini"><canvas aria-label="${p.label}"></canvas><figcaption>${p.label}</figcaption></figure>`).join('');
  const canvases = [...el.querySelectorAll('canvas')], ctxs = canvases.map(c => c.getContext('2d'));
  let sizes = [], start = null;
  addFigure({
    el,
    enter() { start ??= reduce ? -Infinity : performance.now(); },
    resize() { sizes = canvases.map(c => sizeCanvas(c, WORLD_H / WORLD_W)); },
    draw(now) {
      const t = start === null ? 0 : Math.min(1, (now - start) / 2600);
      panels.forEach((p, i) => drawMini(ctxs[i], sizes[i], p.box, p.layers, t, p.ends ?? []));
    },
  });
}

{
  const firstPath = L.first.path, crash = firstPath.at(-1), crashEnd = [{ x: crash[0], y: crash[1] }];
  const nearCrash = firstPath.slice(-120).concat(L.teacherPath.filter(([x, y]) => Math.hypot(x - crash[0], y - crash[1]) < 110));
  const layers = [{ path: L.teacherPath, style: 'dash', still: true }, { path: firstPath, style: 'line' }];
  minis($('figFirst'), [
    { label: `The whole track: it crashed after ${laps(L.first.pct)}`, box: FULL, layers, ends: crashEnd },
    { label: 'Close-up: where it left the teacher’s line', box: box(nearCrash, 30), layers, ends: crashEnd },
  ]);
  $('firstCaption').textContent = `Trained on ${L.examples.length.toLocaleString('en')} examples to a loss of ${L.losses.at(-1).toFixed(3)}, the brain still crashed after ${laps(L.first.pct)} of 2.`;

  minis($('figFix'), [
    { label: `It drives; the teacher steers for ${L.corrected.added.length} moments`, box: FULL, layers: [{ path: L.corrected.path, style: 'line', taken: L.corrected.taken }] },
    { label: `Retrained on all ${L.all.length.toLocaleString('en')} examples: it drives two laps alone`, box: FULL, layers: [{ path: L.after.path, style: 'done' }] },
  ]);
  $('fixCaption').textContent = `Left: thick orange marks every moment the teacher steered, each one a new example from a place the brain actually went. Right: after retraining, the brain finishes both laps on its own.`;
  $('noteLossA').textContent = `lower loss (${L.losses.at(-1).toFixed(3)})`;
  $('noteLossB').textContent = L.relosses.at(-1).toFixed(3);
}

// ---------- Fig. 8: three learning rates ----------
{
  const runs = [[0.002, 'Too small: 0.002'], [0.05, 'About right: 0.05'], [3, 'Too big: 3']].map(([lr, label]) => {
    const g = L.start.slice(), rng = mulberry32(7), losses = [datasetLoss(g, TEACH_SIZES, L.examples)];
    for (let e = 0; e < 40; e++) losses.push(trainEpoch(g, TEACH_SIZES, L.examples, { lr, batch: 32, rng }));
    return { label, losses };
  });
  const shared = Math.max(...runs.flatMap(r => r.losses)), el = $('figRates');
  el.innerHTML = runs.map(r => `<figure class="mini"><canvas aria-label="${r.label}"></canvas><figcaption>${r.label}</figcaption></figure>`).join('');
  const canvases = [...el.querySelectorAll('canvas')];
  let sizes = [];
  addFigure({
    el,
    resize() { sizes = canvases.map(c => { const s = sizeCanvas(c); c.getContext('2d').setTransform(s.dpr, 0, 0, s.dpr, 0, 0); return s; }); },
    draw() { runs.forEach((r, i) => drawLine(canvases[i].getContext('2d'), r.losses, { width: sizes[i].w, height: sizes[i].h, theme, empty: '', max: shared, last: n => `${n} passes` })); },
  });
}

// ---------- Loop ----------
function frame(now) {
  for (const fig of visible) { fig.step?.(); fig.draw(now); }
  requestAnimationFrame(frame);
}
function resizeAll() { for (const fig of figs) { fig.resize(); fig.draw(performance.now()); } }
new ResizeObserver(resizeAll).observe(document.body);
wireLamp($('lamp'), () => { theme = readTheme(); resizeAll(); });
requestAnimationFrame(frame);
