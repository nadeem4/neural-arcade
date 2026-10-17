// Teach by Driving page: you drive, it learns by gradient descent, it drives, you correct it.
import { mulberry32 } from '../../engine/rng.js';
import { randomGenome } from '../../engine/evolve.js';
import { createActs, forward } from '../../engine/tinynet.js';
import { drawBrain } from '../../engine/brain-panel.js';
import { drawLine } from '../../engine/curve.js';
import { trainEpoch, datasetLoss } from '../../engine/train.js';
import { readTheme, wireLamp } from '../../assets/theme.js';
import { WORLD_H, WORLD_W, IN_LABELS, makeTrack, progressPct, describeInput, describeOutput, distanceLabel } from '../racer/sim.js';
import { drawTrack, sizeCanvas } from '../racer/track-view.js';
import { TEACH_SIZES, TEACH_GENOME, newCar, stepTeach, autopilot } from './sim.js';

const $ = id => document.getElementById(id);
const trackCanvas = $('track'), brainCanvas = $('brain'), chartCanvas = $('chart');
const tctx = trackCanvas.getContext('2d'), bctx = brainCanvas.getContext('2d'), cctx = chartCanvas.getContext('2d');
let theme = readTheme(), view = {};

// Learning rates on the slider, with what each one does to the loss.
const LRS = [[0.002, 'crawls'], [0.01, 'slow'], [0.05, 'steady'], [0.2, 'fast but noisy'], [1, 'jumpy'], [3, 'overshoots']];
const EPOCHS = 40, MORE_EPOCHS = 30, FRAMES_PER_EPOCH = 4, PAUSE = 75;
const rng = mulberry32(Date.now() >>> 0);
const freshBrain = () => Float64Array.from(randomGenome(TEACH_GENOME, rng), v => v * 0.5);

const s = {
  phase: 'teach', track: makeTrack(rng), car: null, frame: 0, genome: freshBrain(),
  examples: [], attempt: [], losses: [], passes: 0, crashes: [], corrections: 0,
  started: false, epochsLeft: 0, rest: 0, lr: LRS[2][0], solved: false,
};
s.car = newCar(s.track);

// ---------- Words ----------
function say(text) { $('log').textContent = text; }
function prompt(text) { $('prompt').hidden = !text; $('promptText').textContent = text || ''; }
const PHASES = { teach: ['phTeach', 'Step 1'], train: ['phTrain', 'Step 2'], test: ['phTest', 'Step 3'] };
function setPhase(p) {
  s.phase = p;
  for (const [k, [id]] of Object.entries(PHASES)) $(id).toggleAttribute('aria-current', k === p);
  $('phasePlate').textContent = PHASES[p][1];
  $('brainAsk').textContent = p === 'teach' ? 'What it would steer right now, next to what you steer.'
    : p === 'train' ? 'Its weights changing as it learns from your examples.' : 'How it is deciding, right now, this frame.';
}

// ---------- Steering input: hold buttons, arrow keys or A/D ----------
const held = new Set();
// ?autopilot lets the stand-in teacher drive the teaching laps (for testing the page end to end).
const AUTO = new URLSearchParams(location.search).has('autopilot');
const want = () => (AUTO && s.phase === 'teach' ? autopilot(s.car) : (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0));
for (const side of ['left', 'right']) {
  const b = $(side);
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); held.add(side); b.classList.add('down'); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => { held.delete(side); b.classList.remove('down'); });
  b.addEventListener('contextmenu', e => e.preventDefault());
}
const KEYS = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
addEventListener('keydown', e => { if (KEYS[e.key] && !e.target.closest?.('input')) { e.preventDefault(); held.add(KEYS[e.key]); } });
addEventListener('keyup', e => { if (KEYS[e.key]) held.delete(KEYS[e.key]); });
addEventListener('blur', () => held.clear());

// ---------- The three steps ----------
function resetCar() { s.car = newCar(s.track); s.frame = 0; }

function teachFrame() {
  if (!s.started) {
    if (!held.size && !AUTO) return;
    s.started = true; prompt('');
  }
  s.attempt.push(stepTeach(s.car, s.track, { genome: s.genome, want: want(), frame: s.frame++ }));
  if (s.car.finished) {
    s.examples.push(...s.attempt); s.attempt = [];
    startTraining(EPOCHS, `Two laps, ${s.examples.length} examples. Now it learns: every pass over your examples, each of its 65 numbers moves a little in the direction that makes its steering closer to yours. That is gradient descent.`);
  } else if (!s.car.alive) {
    s.crashes.push({ x: s.car.x, y: s.car.y });
    say(s.car.crashed
      ? 'Crashed. That attempt is thrown away, so the brain never learns to crash. Try again: hold ◀ or ▶ to start.'
      : 'The car stopped making progress. That attempt is thrown away. Hold ◀ or ▶ to start again.');
    s.attempt = []; s.started = false; resetCar(); prompt('Hold ◀ or ▶ to start again.');
  }
}

function startTraining(epochs, text) {
  setPhase('train'); s.epochsLeft = epochs; s.corrections = 0; updateRetrain();
  // The loss before this round of learning, so the chart shows the drop (and the bump that new corrections cause).
  s.losses.push(datasetLoss(s.genome, TEACH_SIZES, s.examples)); drawChart();
  resetCar(); prompt(''); say(text);
}

function trainFrame() {
  if (s.frame++ % FRAMES_PER_EPOCH) return;
  s.passes++;
  s.losses.push(trainEpoch(s.genome, TEACH_SIZES, s.examples, { lr: s.lr, batch: 32, rng }));
  drawChart();
  if (--s.epochsLeft === 0) startTest();
}

function startTest() {
  setPhase('test'); resetCar(); s.rest = 0;
  say(`Trained for ${s.passes} passes over your examples. Now it drives on its own. If it heads for trouble, hold ◀ or ▶ to take the wheel: whatever you do is added as new examples.`);
}

function testFrame() {
  if (s.rest > 0) { if (--s.rest === 0) resetCar(); return; }
  const w = held.size ? want() : null;
  const ex = stepTeach(s.car, s.track, { genome: s.genome, want: w, frame: s.frame++ });
  prompt(w === null ? '' : 'You have the wheel. Every moment is a new example.');
  if (ex) { s.examples.push(ex); s.corrections++; updateRetrain(); }
  if (s.car.alive) return;
  s.rest = PAUSE;
  if (s.car.finished) {
    if (!s.solved) say('It drove two laps by itself, copying you. Try New track: did it learn to drive, or only this track?');
    s.solved = true;
  } else {
    s.crashes.push({ x: s.car.x, y: s.car.y });
    say(s.car.crashed
      ? 'It crashed at the red cross. Your examples never showed it what to do there. When it gets close next time, hold ◀ or ▶ to steer it through, then press Retrain.'
      : 'It stopped making progress. Take the wheel when it hesitates, then press Retrain.');
  }
}

function updateRetrain() {
  $('retrain').disabled = !s.corrections;
  $('retrainText').textContent = s.corrections ? `Retrain (+${s.corrections})` : 'Retrain';
}

// ---------- Drawing ----------
function resize() {
  const t = sizeCanvas(trackCanvas, WORLD_H / WORLD_W);
  view = { dpr: t.dpr, scale: t.w / WORLD_W };
  const b = sizeCanvas(brainCanvas); bctx.setTransform(b.dpr, 0, 0, b.dpr, 0, 0); view.brain = b;
  const c = sizeCanvas(chartCanvas); cctx.setTransform(c.dpr, 0, 0, c.dpr, 0, 0); view.chart = c;
  drawChart();
}

function drawChart() {
  drawLine(cctx, s.losses, { width: view.chart.w, height: view.chart.h, theme, empty: 'The loss appears once it starts learning.', last: () => `${s.passes} passes` });
}

// While it learns the car is parked, so the brain shows one of your examples flowing through it.
const sampleActs = createActs(TEACH_SIZES);
function brainActs() {
  if (s.phase !== 'train' || !s.examples.length) return s.car.acts;
  forward(s.genome, TEACH_SIZES, s.examples[Math.floor(s.frame / 20) % s.examples.length].input, sampleActs);
  return sampleActs;
}

function drawCrashes() {
  const px = 1 / view.scale, r = 6 * px;
  tctx.lineWidth = 2.5 * px; tctx.strokeStyle = theme.red; tctx.lineCap = 'round';
  for (const { x, y } of s.crashes) {
    tctx.beginPath(); tctx.moveTo(x - r, y - r); tctx.lineTo(x + r, y + r); tctx.moveTo(x + r, y - r); tctx.lineTo(x - r, y + r); tctx.stroke();
  }
}

function frame() {
  if (s.phase === 'teach') teachFrame();
  else if (s.phase === 'train') trainFrame();
  else testFrame();

  drawTrack(tctx, { track: s.track, cars: [s.car] }, s.car, theme, view);
  drawCrashes();
  const acts = brainActs();
  drawBrain(bctx, {
    sizes: TEACH_SIZES, genome: s.genome, acts, inLabels: IN_LABELS, outLabels: ['Steer'],
    heads: ['What it senses', '8 hidden', 'What it steers'], inWords: describeInput, outWords: describeOutput,
    theme, width: view.brain.w, height: view.brain.h,
  });
  const guess = describeOutput(0, acts[2][0]);
  $('versus').textContent = s.phase === 'teach' && s.started ? `You: ${describeOutput(0, s.car.steer)} · Its guess: ${guess}`
    : s.phase === 'test' && held.size ? `You have the wheel · It would be ${guess}` : '';
  $('examples').textContent = s.examples.length + s.attempt.length;
  $('loss').textContent = s.losses.length ? s.losses.at(-1).toFixed(3) : '–';
  const [far, ...goal] = distanceLabel(progressPct(s.car)).split(' ');
  $('dist').innerHTML = `${far}<small> ${goal.join(' ')}</small>`;
  requestAnimationFrame(frame);
}

// ---------- Controls ----------
$('retrain').addEventListener('click', () => {
  startTraining(MORE_EPOCHS, `Retraining on all ${s.examples.length} examples, including your corrections. It starts from what it already knows.`);
});
$('newTrack').addEventListener('click', () => {
  s.track = makeTrack(rng); s.crashes = []; resetCar();
  if (s.losses.length) { setPhase('test'); s.rest = 0; say('New track, same brain. If it still drives, it learned to read the walls. If it crashes, it only learned your old track.'); }
  else { s.attempt = []; s.started = false; prompt('Hold ◀ or ▶ to steer. The car starts when you do.'); }
});
$('restart').addEventListener('click', () => {
  Object.assign(s, { genome: freshBrain(), examples: [], attempt: [], losses: [], passes: 0, crashes: [], corrections: 0, started: false, solved: false });
  setPhase('teach'); resetCar(); updateRetrain(); drawChart();
  prompt('Hold ◀ or ▶ to steer. The car starts when you do.');
  say('Starting over with a brand-new random brain. Drive two laps without crashing.');
});
$('lr').addEventListener('input', e => {
  const [lr, word] = LRS[Number(e.target.value)];
  s.lr = lr; $('lrOut').textContent = `${lr}: ${word}`;
});
document.querySelectorAll('.info').forEach(btn => btn.addEventListener('click', () => {
  const open = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', String(open));
  $(btn.getAttribute('aria-controls')).hidden = !open;
}));
wireLamp($('lamp'), () => { theme = readTheme(); drawChart(); });
new ResizeObserver(resize).observe(document.body);

setPhase('teach');
resize();
requestAnimationFrame(frame);
