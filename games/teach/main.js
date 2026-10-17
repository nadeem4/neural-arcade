// Teach by Driving page: you drive, it learns by gradient descent, it drives, you correct it.
import { mulberry32 } from '../../engine/rng.js';
import { randomGenome } from '../../engine/evolve.js';
import { createActs, forward } from '../../engine/tinynet.js';
import { drawBrain } from '../../engine/brain-panel.js';
import { drawLine } from '../../engine/curve.js';
import { trainEpoch, datasetLoss } from '../../engine/train.js';
import { makeTicker } from '../../engine/ticker.js';
import { readTheme, wireLamp } from '../../assets/theme.js';
import { WORLD_H, WORLD_W, IN_LABELS, progressPct, describeInput, describeOutput, distanceLabel } from '../racer/sim.js';
import { drawTrack, drawMinimap, sizeCanvas } from '../racer/track-view.js';
import { TEACH_SIZES, TEACH_GENOME, newCar, stepTeach, autopilot, lapDone, makeTeachTrack } from './sim.js';
import { LESSON_SEED } from './story-data.js';
import { lapDoneNote, learningNote, drivesNote, retrainNote, testEndNote, relearnNote } from './words.js';

const $ = id => document.getElementById(id);
const trackCanvas = $('track'), brainCanvas = $('brain'), chartCanvas = $('chart');
const tctx = trackCanvas.getContext('2d'), bctx = brainCanvas.getContext('2d'), cctx = chartCanvas.getContext('2d');
let theme = readTheme(), view = {};

// Learning rates on the slider, with what each one does to the loss.
const LRS = [[0.002, 'crawls'], [0.01, 'slow'], [0.05, 'steady'], [0.2, 'fast but noisy'], [1, 'jumpy'], [3, 'overshoots']];
// HOLD: how long (in 60 Hz steps) the caption announces the next step before it starts.
const EPOCHS = 40, MORE_EPOCHS = 30, FRAMES_PER_EPOCH = 4, HOLD = 150;
const rng = mulberry32(Date.now() >>> 0);
const freshBrain = () => Float64Array.from(randomGenome(TEACH_GENOME, rng), v => v * 0.5);

const s = {
  // Every visit starts on the same friendly track (the write-up's); New track gives random ones.
  phase: 'teach', track: makeTeachTrack(mulberry32(LESSON_SEED)), car: null, frame: 0, genome: freshBrain(),
  examples: [], attempt: [], losses: [], passes: 0, crashes: [], corrections: 0,
  started: false, epochsLeft: 0, epochs: 0, wait: 0, rest: 0, lr: LRS[2][0],
  // Step 3 drives your track first, then (after two clean laps) a track it has never seen: the real test.
  home: null, onNew: false, toNew: false, done: false,
};
s.home = s.track;
s.car = newCar(s.track);

// ---------- Words ----------
const START = 'Slide your thumb on the track, or hold Left or Right. The car starts when you steer.';
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
// Thumb steering: touch the track and slide sideways; the further you slide, the harder it turns.
let drag = null;
trackCanvas.addEventListener('pointerdown', e => {
  trackCanvas.setPointerCapture(e.pointerId);
  drag = { x0: e.clientX, steer: 0, width: trackCanvas.clientWidth };
});
trackCanvas.addEventListener('pointermove', e => {
  if (drag) drag.steer = Math.max(-1, Math.min(1, (e.clientX - drag.x0) / (drag.width * 0.2)));
});
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) trackCanvas.addEventListener(ev, () => { drag = null; });
const steering = () => drag !== null || held.size > 0;
const want = () => (AUTO && s.phase === 'teach' ? autopilot(s.car)
  : drag ? drag.steer : (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0));
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
    if (!steering() && !AUTO) return;
    s.started = true; prompt('');
  }
  s.attempt.push(stepTeach(s.car, s.track, { genome: s.genome, want: want(), frame: s.frame++ }));
  if (lapDone(s.car)) {
    s.examples.push(...s.attempt); s.attempt = [];
    startTraining(EPOCHS, lapDoneNote(s.examples.length), `One lap, ${s.examples.length} examples. Now it learns: every pass over your examples, each of its 65 numbers moves a little in the direction that makes its steering closer to yours. That is gradient descent.`);
  } else if (!s.car.alive) {
    s.crashes.push({ x: s.car.x, y: s.car.y });
    say(s.car.crashed
      ? 'Crashed. That attempt is thrown away, so the brain never learns to crash. Steer to start again.'
      : 'The car stopped making progress. That attempt is thrown away. Steer to start again.');
    s.attempt = []; s.started = false; resetCar(); prompt(START);
  }
}

// Each step is announced on the track first (`note`), and starts a couple of seconds later.
function startTraining(epochs, note, text) {
  setPhase('train'); s.epochs = s.epochsLeft = epochs; s.wait = HOLD; s.corrections = 0; updateRetrain();
  // The loss before this round of learning, so the chart shows the drop (and the bump that new corrections cause).
  s.losses.push(datasetLoss(s.genome, TEACH_SIZES, s.examples)); drawChart();
  prompt(note); say(text);
}

function trainFrame() {
  if (s.wait > 0) { if (--s.wait === 0) resetCar(); return; } // the car stays where it finished while the caption is read
  if (s.frame++ % FRAMES_PER_EPOCH) return;
  s.passes++;
  prompt(learningNote(s.epochs - s.epochsLeft + 1, s.epochs));
  s.losses.push(trainEpoch(s.genome, TEACH_SIZES, s.examples, { lr: s.lr, batch: 32, rng }));
  drawChart();
  if (--s.epochsLeft === 0) startTest();
}

function startTest() {
  setPhase('test'); resetCar(); s.rest = 0; s.wait = HOLD; s.done = false; prompt(drivesNote());
  say(`Trained for ${s.passes} passes over your examples. Now it drives on its own. If it heads for trouble, take the wheel (slide on the track, or hold Left or Right): whatever you do is added as new examples.`);
}

function testFrame() {
  if (s.done) return; // two clean laps on a new track: it parks until you change something
  if (s.wait > 0) { if (--s.wait === 0) prompt(''); return; }
  if (s.rest > 0) {
    if (--s.rest > 0) return;
    if (s.toNew) Object.assign(s, { track: makeTeachTrack(rng), crashes: [], onNew: true, toNew: false });
    resetCar(); prompt(''); return;
  }
  const w = steering() ? want() : null;
  const ex = stepTeach(s.car, s.track, { genome: s.genome, want: w, frame: s.frame++ });
  prompt(w === null ? '' : 'You have the wheel. Every moment is a new example.');
  if (ex) { s.examples.push(ex); s.corrections++; updateRetrain(); }
  if (s.car.alive) return;
  prompt(testEndNote(s.car.finished ? 'finished' : 'crashed', s.onNew));
  if (s.car.finished && s.onNew) {
    s.done = true;
    say('It drove two laps on a track it had never seen, so it learned to read the walls, not just to replay your track. Try New track for another, or change the learning rate to see if it still learns as well.');
    return;
  }
  s.rest = HOLD;
  if (s.car.finished) {
    s.toNew = true;
    say('It drove two laps by itself on the track you taught it. But it could have just memorised that track, so the real test is a track it has never seen.');
  } else {
    s.crashes.push({ x: s.car.x, y: s.car.y });
    say(s.car.crashed
      ? 'It crashed at the red cross. Your examples never showed it what to do there. When it gets close next time, take the wheel (slide on the track, or hold Left or Right) to steer it through, then press Retrain.'
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
  const m = tctx.getTransform(), px = view.dpr / Math.hypot(m.a, m.b), r = 6 * px;
  tctx.lineWidth = 2.5 * px; tctx.strokeStyle = theme.red; tctx.lineCap = 'round';
  for (const { x, y } of s.crashes) {
    tctx.beginPath(); tctx.moveTo(x - r, y - r); tctx.lineTo(x + r, y + r); tctx.moveTo(x + r, y - r); tctx.lineTo(x - r, y + r); tctx.stroke();
  }
}

const ZOOM = 3;
let cam = { x: 0, y: 0, heading: 0 };

// A steering gauge along the bottom of the tray: where the wheel is right now (ink when you steer, amber when the brain does).
function drawGauge(steer, yours) {
  const w = trackCanvas.width / view.dpr, h = trackCanvas.height / view.dpr, gw = Math.min(220, w * 0.5), y = h - 14;
  tctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  tctx.fillStyle = theme.tray; tctx.globalAlpha = 0.85; tctx.fillRect(w / 2 - gw / 2 - 8, y - 10, gw + 16, 20); tctx.globalAlpha = 1;
  tctx.strokeStyle = theme.muted; tctx.lineWidth = 1;
  tctx.beginPath(); tctx.moveTo(w / 2 - gw / 2, y); tctx.lineTo(w / 2 + gw / 2, y); tctx.moveTo(w / 2, y - 5); tctx.lineTo(w / 2, y + 5); tctx.stroke();
  tctx.fillStyle = yours ? theme.ink : theme.amber;
  tctx.fillRect(w / 2 + (steer * gw) / 2 - 3, y - 7, 6, 14);
}

const ticker = makeTicker(); // 60 simulation steps a second, whatever the screen's refresh rate
function frame(now) {
  for (let k = ticker(now); k > 0; k--) {
    if (s.phase === 'teach') teachFrame();
    else if (s.phase === 'train') trainFrame();
    else testFrame();
  }

  // Driver's view whenever the car is moving, so Left always means left on screen; the whole track otherwise.
  const moving = (s.phase === 'teach' && s.started) || (s.phase === 'test' && s.rest === 0 && s.wait === 0 && !s.done);
  const c = s.car;
  if (moving) {
    let d = c.angle - cam.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    cam = { x: c.x, y: c.y, heading: cam.heading + d * 0.2 };
  } else cam = { x: c.x, y: c.y, heading: c.angle };
  drawTrack(tctx, { track: s.track, cars: [c] }, c, theme, { ...view, focus: moving ? { ...cam, zoom: ZOOM } : null });
  drawCrashes();
  if (moving) { drawMinimap(tctx, s.track, c, theme, { ...view, crashes: s.crashes }); drawGauge(c.steer, steering() || s.phase === 'teach'); }
  const acts = brainActs();
  drawBrain(bctx, {
    sizes: TEACH_SIZES, genome: s.genome, acts, inLabels: IN_LABELS, outLabels: ['Steer'],
    heads: ['What it senses', '8 hidden', 'What it steers'], inWords: describeInput, outWords: describeOutput,
    theme, width: view.brain.w, height: view.brain.h,
  });
  const guess = describeOutput(0, acts[2][0]);
  $('versus').textContent = s.phase === 'teach' && s.started ? `You: ${describeOutput(0, s.car.steer)} · Its guess: ${guess}`
    : s.phase === 'test' && steering() ? `You have the wheel · It would be ${guess}` : '';
  $('examples').textContent = s.examples.length + s.attempt.length;
  $('loss').textContent = s.losses.length ? s.losses.at(-1).toFixed(3) : '–';
  // While you teach the goal is one lap; when the brain drives, two.
  const [far, ...goal] = distanceLabel(progressPct(s.car)).split(' ');
  $('dist').innerHTML = s.phase !== 'test' ? `${far}<small> of 1 lap</small>` : `${far}<small> ${goal.join(' ')}</small>`;
  requestAnimationFrame(frame);
}

// ---------- Controls ----------
$('retrain').addEventListener('click', () => {
  startTraining(MORE_EPOCHS, retrainNote(s.examples.length, s.corrections), `Retraining on all ${s.examples.length} examples, including your corrections. It starts from what it already knows.`);
});
$('newTrack').addEventListener('click', () => {
  s.track = makeTeachTrack(rng); s.crashes = []; resetCar();
  if (s.phase === 'teach') s.home = s.track; // a new track to teach on
  if (s.losses.length) { setPhase('test'); Object.assign(s, { rest: 0, wait: 0, onNew: true, toNew: false, done: false }); prompt(''); say('New track, same brain. If it still drives, it learned to read the walls. If it crashes, it only learned your old track.'); }
  else { s.attempt = []; s.started = false; prompt(START); }
});
$('restart').addEventListener('click', () => {
  Object.assign(s, { genome: freshBrain(), examples: [], attempt: [], losses: [], passes: 0, crashes: [], corrections: 0, started: false,
    wait: 0, track: s.home, onNew: false, toNew: false, done: false });
  setPhase('teach'); resetCar(); updateRetrain(); drawChart();
  prompt(START);
  say('Starting over with a brand-new random brain. Drive one lap without crashing.');
});
$('lr').addEventListener('input', e => {
  const [lr, word] = LRS[Number(e.target.value)];
  s.lr = lr; $('lrOut').textContent = `${lr}: ${word}`;
});
// Letting go of the slider after it has learned relearns the same examples from a fresh brain, back on your track,
// so learning rates can be compared on the same lap.
$('lr').addEventListener('change', () => {
  if (s.phase === 'teach') return;
  Object.assign(s, { genome: freshBrain(), losses: [], passes: 0, crashes: [], track: s.home, onNew: false, toNew: false, done: false });
  drawChart();
  startTraining(EPOCHS, relearnNote(s.lr, s.examples.length), `Learning rate ${s.lr}, a fresh random brain, and your same ${s.examples.length} examples. Watch how the loss line falls this time, and whether it still drives.`);
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
