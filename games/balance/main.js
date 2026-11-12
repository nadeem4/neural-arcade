// Balance page: you, a PID controller, a PID tuned by evolution or a tiny evolving network keep a pole up; both evolutions train unseen in every mode.
import { createActs } from '../../engine/tinynet.js';
import { drawBrain } from '../../engine/brain-panel.js';
import { drawBars } from '../../engine/curve.js';
import { makeTicker } from '../../engine/ticker.js';
import { readTheme, wireLamp } from '../../assets/theme.js';
import { sizeCanvas } from '../racer/track-view.js';
import { startTry, advance, pushTry, seconds, keyDir, KEY_MAP, pidAct, PID_RANGES, HUMAN_POWER, WIND_FORCE, LIMIT } from './sim.js';
import { SIZES, IN_LABELS, OUT_LABELS, aiAct, createTrainer } from './ai.js';
import { createTuner } from './tune.js';
import { describeInput, describeOutput, tryNote, pidHint, DIAL_INFO, aiNote, modeLine, tunedHint, tunedNote, modeSay, freshSay, formulaLine, formulaLive } from './words.js';
import { layout, drawStage } from './render.js';
import { createKeys, pressKey, releaseKey, endTryKeys, clearKeys, keyUp, owedAfter, toggleWind, dialHtml } from './state.js';

const $ = id => document.getElementById(id);
const stageCanvas = $('stage'), brainCanvas = $('brain'), chartCanvas = $('chart');
const sctx = stageCanvas.getContext('2d'), bctx = brainCanvas.getContext('2d'), cctx = chartCanvas.getContext('2d');
const wrap = document.querySelector('.stage-body');
let theme = readTheme(), view = {};

// HOLD: how long (60 Hz steps) a finished try stays up with its result. BUDGET: most ms per frame for unseen training.
const HOLD = 60, BUDGET = 6;
const WHO = { you: 'You', pid: 'PID', tuned: 'Tuned PID', ai: 'AI' };
const PLATE = { you: 'You are balancing', pid: 'PID is balancing', tuned: 'Tuned PID is balancing', ai: 'AI is balancing' };

const s = {
  mode: 'ai', trainer: null, tuner: null, run: null, rate: 2, owed: 0, hold: 0, wind: false, started: false, force: 0, pushSide: 1,
  dials: Object.fromEntries(Object.entries(PID_RANGES).map(([k, r]) => [k, r.def])),
  best: { you: 0, pid: 0, tuned: 0, ai: 0 },
};
const keys = createKeys();
const seed = () => (Math.random() * 2 ** 32) >>> 0;
function newTrainers() { s.trainer = createTrainer(seed()); s.tuner = createTuner(seed()); }
function caption(t) { $('captionText').textContent = t; }
function say(t) { $('log').textContent = t; }

// A new try always starts with a fresh PID memory (startTry makes one). You wait for the first key.
function newTry() {
  s.run = startTry(); s.hold = 0; s.force = 0; s.started = s.mode !== 'you';
  caption(s.mode === 'you' ? 'Press ← or → to start' : `${WHO[s.mode]} is balancing`);
}
function freshBrain() {
  newTrainers(); s.owed = 0; s.best.ai = s.best.tuned = 0; drawChart(); say(freshSay(s.mode));
  if (s.mode === 'ai' || s.mode === 'tuned') { newTry(); caption(freshSay(s.mode)); }
}

// ---------- Mode ----------
function setMode(mode) {
  s.mode = mode; clearKeys(keys); newTry();
  wrap.dataset.mode = mode;
  document.querySelectorAll('[data-mode]').forEach(b => { if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', String(b.dataset.mode === mode)); });
  document.querySelector('.insides').dataset.mode = mode;
  document.querySelectorAll('.dial').forEach(d => { // dials are yours in PID, evolution's in Tuned PID, and dim otherwise
    if (mode === 'pid' || mode === 'tuned') d.removeAttribute('data-off'); else d.setAttribute('data-off', '');
    d.querySelector('input').disabled = mode === 'tuned';
  });
  $('useDials').hidden = mode !== 'tuned';
  $('modeOut').textContent = modeLine(mode);
  showDials(); showHint(); drawChart();
  say(modeSay(mode));
}
document.querySelectorAll('button[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

// ---------- PID dials ----------
const dialsBox = $('dials');
for (const [key, r] of Object.entries(PID_RANGES)) {
  const label = document.createElement('div');
  label.innerHTML = dialHtml(key, r, DIAL_INFO[key]);
  label.firstElementChild.dataset.off = '';
  dialsBox.append(label.firstElementChild);
  dialsBox.lastElementChild.querySelector('input').addEventListener('input', e => { s.dials[key] = Number(e.target.value); $(`out-${key}`).textContent = s.dials[key]; showHint(); }); // the PID try keeps running
}
// The sliders show your dials in PID and evolution's best dials in Tuned PID.
function showDials() {
  const d = s.mode === 'tuned' ? s.tuner.bestDials : s.dials;
  for (const k of Object.keys(PID_RANGES)) { $(`pid-${k}`).value = d[k]; $(`out-${k}`).textContent = d[k]; }
}
function showHint() { $('pidOut').textContent = s.mode === 'tuned' ? tunedHint(s.tuner.bestDials, s.wind) : pidHint(s.dials, s.wind); }
$('useDials').addEventListener('click', () => { Object.assign(s.dials, s.tuner.bestDials); setMode('pid'); });

// ---------- Push and Wind ----------
$('push').addEventListener('click', () => {
  if (s.run.outcome) return;
  pushTry(s.run, s.pushSide); s.pushSide *= -1; s.started = true;
});
$('wind').addEventListener('click', e => { Object.assign(s, toggleWind(s)); e.currentTarget.setAttribute('aria-pressed', String(s.wind)); showHint(); });
$('fresh').addEventListener('click', freshBrain);
document.querySelectorAll('[data-rate]').forEach(b => b.addEventListener('click', () => {
  s.rate = Number(b.dataset.rate); s.owed = 0;
  document.querySelectorAll('[data-rate]').forEach(o => o.setAttribute('aria-pressed', String(o === b)));
  $('speedOut').textContent = s.rate ? `${s.rate} generations a second, unseen` : 'Training is paused';
}));

// ---------- Keys and touch (You only) ----------
const heldKey = e => (s.mode === 'you' && !e.ctrlKey && !e.metaKey && !e.altKey ? KEY_MAP[e.code] : undefined);
const typing = e => /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName);
window.addEventListener('keydown', e => {
  if (typing(e)) return;
  const k = heldKey(e);
  if (k) { e.preventDefault(); pressKey(keys, k, e.code); } // a guarded key (held when the last try ended) does nothing
});
window.addEventListener('keyup', e => {
  const k = heldKey(e);
  if (k) e.preventDefault();
  keyUp(keys, k, e.code);
});
window.addEventListener('blur', () => clearKeys(keys));
document.querySelectorAll('[data-hold]').forEach(b => {
  const k = b.dataset.hold, code = 'touch-' + k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); pressKey(keys, k, code); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => releaseKey(keys, k, code));
});

// ---------- Running ----------
const stepActs = createActs(SIZES), stepInput = new Float32Array(4);
function finish() {
  s.best[s.mode] = Math.max(s.best[s.mode], seconds(s.run));
  caption(tryNote(WHO[s.mode], s.run));
  if (s.mode === 'you') endTryKeys(keys); // a key still held must not start the next try
  s.hold = HOLD; s.force = 0;
}
function stepOnce() {
  if (s.hold > 0) { if (--s.hold === 0) newTry(); return; }
  const run = s.run;
  if (run.outcome) return;
  let u = 0;
  if (s.mode === 'you') {
    if (!s.started) { if (!keys.held.size) return; s.started = true; caption('You are balancing'); }
    u = keyDir({ left: keys.held.has('left'), right: keys.held.has('right') }) * HUMAN_POWER;
  } else if (s.mode === 'pid') u = pidAct(run.pid, run.g, s.dials);
  else if (s.mode === 'tuned') u = pidAct(run.pid, run.g, s.tuner.bestDials); // reads the live best dials, never writes them
  else u = aiAct(s.trainer.bestGenome, run.g, stepActs, stepInput); // reads the live best brain, never writes it
  s.force = u;
  advance(run, u, s.wind ? WIND_FORCE : 0);
  if (run.outcome) finish();
}
// Training runs in every mode, a few milliseconds per frame at most, so the page stays smooth on a phone.
function runUnseen(steps) {
  s.owed = owedAfter(s.owed, s.rate, steps);
  const t0 = performance.now();
  let ran = false;
  while (s.owed >= 1 && performance.now() - t0 < BUDGET) { s.trainer.runGeneration(); s.tuner.runGeneration(); s.owed--; ran = true; }
  if (ran) drawChart();
}

// ---------- Drawing ----------
function resize() {
  view.stage = sizeCanvas(stageCanvas, 5 / 8);
  const b = sizeCanvas(brainCanvas); bctx.setTransform(b.dpr, 0, 0, b.dpr, 0, 0); view.brain = b;
  const c = sizeCanvas(chartCanvas); cctx.setTransform(c.dpr, 0, 0, c.dpr, 0, 0); view.chart = c;
  drawChart();
}
function drawChart() {
  if (!view.chart) return;
  const tuned = s.mode === 'tuned', history = tuned ? s.tuner.history : s.trainer.history;
  drawBars(cctx, history, { width: view.chart.w, height: view.chart.h, max: LIMIT / 60, maxLabel: '20 s', empty: 'Bars appear after the first generation.', theme });
  $('chartAsk').textContent = tuned ? 'How long have the best dials stayed up?' : 'How long has the best brain stayed up?';
  chartCanvas.setAttribute('aria-label', `Bar chart: seconds the best ${tuned ? 'dials' : 'brain'} of each generation stayed up`);
  $('chartNote').textContent = tuned ? tunedNote(history) : aiNote(history);
}
const brainActs = createActs(SIZES), brainInput = new Float32Array(4);
function drawBrainPanel() {
  // The panel always shows the best brain thinking about what is on screen.
  aiAct(s.trainer.bestGenome, s.run.g, brainActs, brainInput);
  drawBrain(bctx, {
    sizes: SIZES, genome: s.trainer.bestGenome, acts: brainActs, inLabels: IN_LABELS, outLabels: OUT_LABELS,
    heads: ['What it senses', '6 hidden', 'Its push'], inWords: describeInput, outWords: describeOutput,
    theme, width: view.brain.w, height: view.brain.h,
  });
}
function drawStageNow() {
  const { dpr, w, h } = view.stage;
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sctx.clearRect(0, 0, w, h);
  sctx.fillStyle = theme.tray; sctx.fillRect(0, 0, w, h);
  drawStage(sctx, s.run.g, { lay: layout(w, h), theme, wind: s.wind ? Math.sign(WIND_FORCE) : 0, force: s.force, fell: s.run.outcome === 'fell' });
}

const ticker = makeTicker();
function frame(now) {
  const steps = ticker(now);
  for (let k = steps; k > 0; k--) stepOnce();
  runUnseen(steps);
  drawStageNow();
  if (s.mode !== 'tuned') drawBrainPanel();
  $('plate').textContent = PLATE[s.mode];
  $('upFor').textContent = seconds(s.run).toFixed(1);
  $('bestUp').textContent = s.best[s.mode].toFixed(1);
  const tuned = s.mode === 'tuned';
  $('gens').textContent = tuned ? s.tuner.gen : s.trainer.gen;
  $('gensLabel').textContent = tuned ? 'Tuner generation' : 'AI generation';
  if (tuned) {
    showDials(); showHint();
    $('formula').textContent = `${formulaLine(s.tuner.bestDials)}
${formulaLive(s.run.pid.terms ?? { p: 0, i: 0, d: 0 })}`;
  }
  requestAnimationFrame(frame);
}

document.querySelectorAll('.info').forEach(btn => btn.addEventListener('click', e => {
  const open = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', String(open));
  $(btn.getAttribute('aria-controls')).hidden = !open;
}));
wireLamp($('lamp'), () => { theme = readTheme(); drawChart(); });
new ResizeObserver(resize).observe(document.body);

newTrainers();
setMode('ai');
resize();
requestAnimationFrame(frame);
