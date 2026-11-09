// Coin Runner page: a brain learns the level from points, one try shown at real speed while the rest run unseen.
import { createActs, forward } from '../../engine/tinynet.js';
import { policy } from '../../engine/reinforce.js';
import { drawBrain } from '../../engine/brain-panel.js';
import { makeTicker } from '../../engine/ticker.js';
import { readTheme, wireLamp } from '../../assets/theme.js';
import { sizeCanvas } from '../racer/track-view.js';
import { timeLeft, RULES, PRESETS, RUNNER_SIZES, IN_LABELS, ACTIONS, describeInput, createTrainer, tick, startTry, tickHuman, actionFor, KEY_MAP } from './sim.js';
import { loadArt, createFx, react, settle, follow, drawLevel, drawOutcomes } from './render.js';
import { createSfx, soundsFor, readSound, saveSound } from './sfx.js';
import { tryNote, endWords, compareNote, whyNote, rulesItems, pausedNote, bestOf, ruleValue, matchPreset, loopholeNote } from './words.js';

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
// Sound effects play only for the try on screen: full volume for your own, quieter for the AI's.
const sfx = createSfx(), AI_VOLUME = 0.4;
const cue = (ev, volume) => { for (const n of soundsFor(ev)) sfx.play(n, volume); };
const s = { rules: { ...PRESETS.balanced.rules }, trainer: null, run: null, fx: createFx(), rate: 30, owed: 0, hold: 0, note: '', mode: 'ai', phase: null, count: 0, down: new Set(), guard: new Set(), held: new Set() };
function freshBrain() {
  s.trainer = createTrainer(s.rules, (Math.random() * 2 ** 32) >>> 0);
  endHuman(); s.owed = 0; s.hold = 0; startShown(); drawChart();
}
function startShown() {
  s.run = s.trainer.start(); s.fx = createFx(); follow(s.fx, s.run.g, true);
  caption(`Try ${s.trainer.tries + 1}${s.rate ? ', with more tries running unseen' : ''}`);
}

// ---------- Play it yourself ----------
// One try by hand on the same level and physics. It never reaches the trainer, and the AI's learning pauses until "Back to the AI".
// Phases: intro (start card), count (3-2-1, counted in 60 Hz steps), play, end (end card).
const levelEl = document.querySelector('.level');
const COUNT_STEP = 30;
const show = id => { for (const c of ['cardIntro', 'cardCount', 'cardEnd']) $(c).hidden = c !== id; $('playCard').hidden = !id; $('hud').hidden = s.phase !== 'play'; };
function newHumanTry() {
  s.held.clear(); s.run = startTry(null, s.rules, null); s.fx = createFx(); follow(s.fx, s.run.g, true);
}
function startHuman() {
  s.mode = 'human'; s.phase = 'intro'; newHumanTry();
  $('playSelf').setAttribute('aria-pressed', 'true'); levelEl.dataset.mode = 'human';
  s.said = $('log').textContent; say(pausedNote(s.trainer.tries)); $('cardRules').innerHTML = rulesItems(s.rules).map(t => `<span class="rule-item">${t}</span>`).join(' \u00b7 ');
  show('cardIntro'); $('playStart').focus();
  levelEl.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
}
function beginCount() { s.phase = 'count'; s.count = 3 * COUNT_STEP; $('countNum').textContent = '3'; show('cardCount'); }
function playAgain() { newHumanTry(); beginCount(); }
function endHuman() {
  if (s.mode !== 'human') return;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); // full screen is for playing only
  s.mode = 'ai'; s.phase = null; s.held.clear(); show(null); say(s.said);
  $('playSelf').setAttribute('aria-pressed', 'false'); delete levelEl.dataset.mode;
}
function backToAi() {
  endHuman(); s.hold = 0; startShown(); $('playSelf').focus();
}
$('playSelf').addEventListener('click', () => { if (s.mode === 'human') backToAi(); else startHuman(); });
$('playStart').addEventListener('click', () => { if (s.phase === 'intro') beginCount(); });
$('playAgain').addEventListener('click', playAgain);
$('playBack').addEventListener('click', backToAi);
const heldKey = e => (s.phase === 'play' && !e.ctrlKey && !e.metaKey && !e.altKey ? KEY_MAP[e.code] : undefined);
window.addEventListener('keydown', e => {
  if (s.mode !== 'human') return;
  if (e.key === 'Escape') { backToAi(); return; }
  if (s.guard.has(e.code)) { e.preventDefault(); return; } // a key still held when the try ended must not press Play again
  const t = e.target, typing = /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || (t.tagName === 'BUTTON' && t.id !== 'playStart');
  if (s.phase === 'intro' && !typing && !e.repeat && (e.code === 'Enter' || KEY_MAP[e.code]) && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); beginCount(); return; }
  const k = heldKey(e);
  if (k) { e.preventDefault(); s.held.add(k); s.down.add(e.code); }
});
window.addEventListener('keyup', e => { s.down.delete(e.code); if (s.guard.delete(e.code)) e.preventDefault(); });
window.addEventListener('keyup', e => { const k = heldKey(e); if (k) { e.preventDefault(); s.held.delete(k); } });
window.addEventListener('blur', () => s.held.clear());
document.querySelectorAll('[data-hold]').forEach(b => {
  const k = b.dataset.hold;
  b.addEventListener('pointerdown', e => { e.preventDefault(); s.held.add(k); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => s.held.delete(k));
});
// Full screen where the browser allows it (not on iPhone Safari): the canvas is resized when it changes.
if (document.fullscreenEnabled) {
  $('fullscreen').hidden = false;
  $('fullscreen').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else levelEl.requestFullscreen().catch(() => {}); });
  document.addEventListener('fullscreenchange', () => {
    const label = document.fullscreenElement ? 'Exit full screen' : 'Full screen';
    $('fullscreen').setAttribute('aria-label', label); $('fullscreen').title = label;
    requestAnimationFrame(resize); // measure once the new layout has settled
  });
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
function stepHuman() {
  if (s.phase === 'count') {
    s.count--;
    $('countNum').textContent = Math.ceil(s.count / COUNT_STEP);
    if (s.count <= 0) { s.phase = 'play'; show(null); }
    return;
  }
  if (s.phase !== 'play') return;
  const flags = { left: s.held.has('left'), right: s.held.has('right'), jump: s.held.has('jump') };
  const ev = tickHuman(s.run, actionFor(flags));
  react(s.fx, s.run.g, ev, { reduceMotion }); cue(ev, 1);
  if (!s.run.outcome) return;
  s.held.clear(); s.guard = new Set(s.down); s.phase = 'end';
  const best = bestOf(s.trainer.history);
  $('endNote').textContent = compareNote(s.run, best); $('endWhy').textContent = whyNote(s.run, best);
  show('cardEnd'); $('playAgain').focus();
}
function stepShown() {
  if (s.hold > 0) { if (--s.hold === 0) startShown(); return; } // the finished try stays up with its result
  const ev = tick(s.run);
  react(s.fx, s.run.g, ev, { reduceMotion }); cue(ev, AI_VOLUME);
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
  for (let k = steps; k > 0; k--) { if (s.mode === 'human') stepHuman(); else stepShown(); settle(s.fx); }
  if (s.mode === 'ai') runUnseen(steps);
  follow(s.fx, s.run.g);
  if (art) drawLevel(lctx, s.run.g, s.fx, art, { width: view.level.w, dpr: view.level.dpr, dark: theme.dark });
  drawBrainPanel();
  $('tries').textContent = s.trainer.tries; $('plate').textContent = s.mode === 'human' ? 'You are playing' : 'AI is playing';
  $('hudScore').textContent = s.run.score.toFixed(1); $('hudCoins').textContent = s.run.coins; $('hudTime').textContent = timeLeft(s.run);
  $('score').textContent = s.run.score.toFixed(1); $('coins').textContent = s.run.coins;
  requestAnimationFrame(frame);
}

document.querySelectorAll('.info').forEach(btn => btn.addEventListener('click', e => {
  e.preventDefault(); // inside a <label>, a click would otherwise also focus the slider
  const open = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', String(open));
  $(btn.getAttribute('aria-controls')).hidden = !open;
}));
wireLamp($('lamp'), () => { theme = readTheme(); drawChart(); }); // the level repaints every frame, so night follows the lamp

// ---------- Sound switch: muted until asked, remembered, and silent while the tab is hidden ----------
// Browsers only allow audio after a gesture, so a remembered "on" starts with the first click or key.
if (window.AudioContext || window.webkitAudioContext) {
  const btn = $('sound'), player = sfx;
  let store = null; try { store = localStorage; } catch { /* storage blocked */ }
  let on = readSound(store), hidden = document.hidden, gestured = false;
  const sync = () => { btn.setAttribute('aria-pressed', String(on)); };
  const apply = () => { if (on && !hidden && gestured) player.start(); else player.stop(); };
  btn.hidden = false; sync();
  btn.addEventListener('click', () => { on = !on; gestured = true; saveSound(store, on); sync(); apply(); });
  // A remembered "on" waits for a gesture that browsers accept (pointerup, not pointerdown, on touch) and stays listening until audio runs.
  const unlock = () => { gestured = true; apply(); if (player.running()) for (const ev of ['pointerup', 'keydown']) window.removeEventListener(ev, unlock); };
  if (on) for (const ev of ['pointerup', 'keydown']) window.addEventListener(ev, unlock);
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; apply(); });
}
const sizer = new ResizeObserver(resize); sizer.observe(document.body); sizer.observe(levelCanvas); // the canvas itself, so entering or leaving full screen always re-measures

showRules();
freshBrain();
resize();
loadArt('art/').then(a => { art = a; });
requestAnimationFrame(frame);
