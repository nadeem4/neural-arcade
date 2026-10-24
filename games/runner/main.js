// Coin Runner page: a brain learns the level from points, one try shown at real speed while the rest run unseen.
import { createActs, forward } from '../../engine/tinynet.js';
import { policy } from '../../engine/reinforce.js';
import { drawBrain } from '../../engine/brain-panel.js';
import { makeTicker } from '../../engine/ticker.js';
import { readTheme, wireLamp } from '../../assets/theme.js';
import { sizeCanvas } from '../racer/track-view.js';
import { RULES, PRESETS, RUNNER_SIZES, IN_LABELS, ACTIONS, describeInput, createTrainer, tick } from './sim.js';
import { loadArt, createFx, react, settle, follow, drawLevel, drawOutcomes } from './render.js';
import { tryNote, ruleValue, matchPreset, loopholeNote } from './words.js';

const $ = id => document.getElementById(id);
const levelCanvas = $('level'), brainCanvas = $('brain'), chartCanvas = $('chart');
const lctx = levelCanvas.getContext('2d'), bctx = brainCanvas.getContext('2d'), cctx = chartCanvas.getContext('2d');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let theme = readTheme(), view = {}, art = null;

// HOLD: how long (60 Hz steps) a finished try stays on screen with its result. BUDGET: most ms per frame for unseen tries.
const HOLD = 50, BUDGET = 6;
const PRESET_LINES = {
  balanced: 'Pays mostly for reaching the flag.',
  coinHungry: 'Coins pay far more than the flag.',
  afraid: 'Dying costs a lot; every second alive pays.',
};
const RULE_INFO = {
  flag: 'Points for touching the flag at the end of the level. The try ends there.',
  coin: 'Points for every coin: the five on the ground, and every bump of the block above the start.',
  progress: 'Points for every tile it gets further right than ever before in this try. Going back and forth earns nothing.',
  death: 'Points taken away when it falls into a pit or walks into the enemy. The try ends there.',
  second: 'Points for every second the try lasts. Below zero it is a cost, so it should hurry; above zero it is paid just for staying alive.',
};

// `rate`: unseen tries a second, run in the background while one try plays on screen (0: only the tries you see).
const s = { rules: { ...PRESETS.balanced.rules }, trainer: null, run: null, fx: createFx(), rate: 30, owed: 0, hold: 0, note: '' };
function freshBrain() {
  s.trainer = createTrainer(s.rules, (Math.random() * 2 ** 32) >>> 0);
  s.owed = 0; s.hold = 0; startShown(); drawChart();
}
function startShown() {
  s.run = s.trainer.start(); s.fx = createFx(); follow(s.fx, s.run.g, true);
  caption(`Try ${s.trainer.tries + 1}${s.rate ? ', with more tries running unseen' : ''}`);
}

function caption(t) { $('captionText').textContent = t; }
function say(t) { $('log').textContent = t; }

// ---------- The rules: presets and sliders ----------
const rulesBox = $('rules');
for (const [key, r] of Object.entries(RULES)) {
  const label = document.createElement('label');
  label.className = 'dial';
  label.innerHTML = `<span class="dial-name">${r.name}<button class="info" type="button" aria-expanded="false" aria-controls="info-${key}" aria-label="Explain ${r.name.toLowerCase()}" title="What is this?"><svg class="ic ic-info" aria-hidden="true" focusable="false" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z"/></svg></button></span>
    <span class="info-text" id="info-${key}" hidden>${RULE_INFO[key]}</span>
    <output id="out-${key}"></output>
    <input id="rule-${key}" type="range" min="${r.min}" max="${r.max}" step="${r.step}">`;
  rulesBox.append(label);
  const input = label.querySelector('input');
  input.addEventListener('input', () => { $(`out-${key}`).textContent = ruleValue(key, Number(input.value)); });
  // Letting go of a slider starts a fresh brain on the new rules.
  input.addEventListener('change', () => { s.rules[key] = Number(input.value); rulesChanged(); });
}
function showRules() {
  for (const key of Object.keys(RULES)) { $(`rule-${key}`).value = s.rules[key]; $(`out-${key}`).textContent = ruleValue(key, s.rules[key]); }
  const p = matchPreset(s.rules);
  document.querySelectorAll('[data-preset]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.preset === p)));
  $('presetOut').textContent = p ? PRESET_LINES[p] : 'Your own rules.';
}
function rulesChanged() {
  showRules(); freshBrain();
  say('New rules, so a fresh random brain. It never sees the rules, only the points it gets, and it will learn whatever earns the most.');
}
document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
  s.rules = { ...PRESETS[b.dataset.preset].rules }; rulesChanged();
}));
document.querySelectorAll('[data-rate]').forEach(b => b.addEventListener('click', () => {
  s.rate = Number(b.dataset.rate); s.owed = 0;
  document.querySelectorAll('[data-rate]').forEach(o => o.setAttribute('aria-pressed', String(o === b)));
  $('speedOut').textContent = s.rate ? `About ${s.rate} unseen tries a second` : 'Only the tries you see';
}));
$('fresh').addEventListener('click', () => { freshBrain(); say('A fresh random brain, same rules. Every brain starts by flailing.'); });

// ---------- Running ----------
function stepShown() {
  if (s.hold > 0) { if (--s.hold === 0) startShown(); return; } // the finished try stays up with its result
  const ev = tick(s.run);
  react(s.fx, s.run.g, ev, { reduceMotion });
  if (!s.run.outcome) return;
  s.trainer.learnFrom(s.run);
  caption(tryNote(s.run, s.trainer.tries));
  s.hold = HOLD;
  drawChart();
}
// Unseen tries run at the chosen rate, at most a few milliseconds per frame, so the page stays smooth on a phone.
// They learn into the same brain as the try on screen, which keeps playing with whatever the brain knows so far.
function runUnseen(steps) {
  s.owed = Math.min(s.owed + (s.rate * steps) / 60, 10);
  const t0 = performance.now();
  let ran = false;
  while (s.owed >= 1 && performance.now() - t0 < BUDGET) { s.trainer.runTry(); s.owed--; ran = true; }
  if (ran) drawChart();
}

// ---------- Drawing ----------
function resize() {
  const t = sizeCanvas(levelCanvas, 5 / 8); view.level = t;
  const b = sizeCanvas(brainCanvas); bctx.setTransform(b.dpr, 0, 0, b.dpr, 0, 0); view.brain = b;
  const c = sizeCanvas(chartCanvas); cctx.setTransform(c.dpr, 0, 0, c.dpr, 0, 0); view.chart = c;
  drawChart();
}
function drawChart() {
  if (!view.chart) return;
  drawOutcomes(cctx, s.trainer.history, { width: view.chart.w, height: view.chart.h, theme });
  const note = loopholeNote(s.trainer.history);
  if (note !== s.note) { s.note = note; $('loophole').textContent = note; }
}

// The brain panel shows the decision the hero is making right now, with each move's chance in words.
const acts = createActs(RUNNER_SIZES);
function drawBrainPanel() {
  const cur = s.run.current;
  if (!cur) return;
  const out = forward(s.trainer.L.genome, RUNNER_SIZES, cur.input, acts), p = policy(out);
  drawBrain(bctx, {
    sizes: RUNNER_SIZES, genome: s.trainer.L.genome, acts, inLabels: IN_LABELS, outLabels: ACTIONS,
    heads: ['What it senses', '8 hidden', 'Its chances'], inWords: describeInput, outWords: k => `${Math.round(p[k] * 100)}% likely`,
    theme, width: view.brain.w, height: view.brain.h,
  });
}

const ticker = makeTicker();
function frame(now) {
  const steps = ticker(now);
  for (let k = steps; k > 0; k--) { stepShown(); settle(s.fx); }
  runUnseen(steps);
  follow(s.fx, s.run.g);
  if (art) drawLevel(lctx, s.run.g, s.fx, art, { width: view.level.w, dpr: view.level.dpr });
  drawBrainPanel();
  $('tries').textContent = s.trainer.tries; $('triesPlate').textContent = s.trainer.tries + 1;
  $('score').textContent = s.run.score.toFixed(1); $('coins').textContent = s.run.coins;
  requestAnimationFrame(frame);
}

document.querySelectorAll('.info').forEach(btn => btn.addEventListener('click', e => {
  e.preventDefault(); // inside a <label>, a click would otherwise also focus the slider
  const open = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', String(open));
  $(btn.getAttribute('aria-controls')).hidden = !open;
}));
wireLamp($('lamp'), () => { theme = readTheme(); drawChart(); });
new ResizeObserver(resize).observe(document.body);

showRules();
freshBrain();
resize();
loadArt('art/').then(a => { art = a; });
requestAnimationFrame(frame);
