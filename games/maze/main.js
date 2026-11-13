// Treasure Maze page: a robot learns a small grid by Q-learning; you set the discount and the exploring.
import { drawLine } from '../../engine/curve.js';
import { makeTicker } from '../../engine/ticker.js';
import { readTheme, wireLamp } from '../../assets/theme.js';
import { sizeCanvas } from '../racer/track-view.js';
import { createAgent, startEpisode, stepEpisode, runEpisode, valueGrid, policyGrid, DEFAULTS } from './sim.js';
import { gammaHint, epsilonHint, episodeNote, learnedNote, INFO } from './words.js';
import { drawMaze, curvePoints } from './render.js';

const $ = id => document.getElementById(id);
const stageCanvas = $('stage'), chartCanvas = $('chart');
const sctx = stageCanvas.getContext('2d'), cctx = chartCanvas.getContext('2d');
let theme = readTheme(), view = {};

// FAST: episodes per frame in Fast (about 900 a second). BEAT: 60 Hz steps between moves (step) or episodes (play), about 4 a second.
const FAST = 15, BEAT = 15, SHOWN = 500;
const seed = () => (Math.random() * 2 ** 32) >>> 0;
const s = { agent: null, ep: null, trail: [], mapId: 'near-or-far', gamma: DEFAULTS.gamma, epsilon: DEFAULTS.epsilon, rate: '1', wait: 0 };
const params = () => ({ alpha: DEFAULTS.alpha, gamma: s.gamma, epsilon: s.epsilon });
const say = t => { $('log').textContent = t; };

function newBrain() {
  s.agent = createAgent(s.mapId, seed());
  s.ep = startEpisode(s.agent); s.trail = [s.ep.s]; s.wait = 0;
  say('A new robot, knowing nothing. Every tile starts at zero, so the first tries are random wandering.');
  drawChart();
}
function nextEpisode() { s.ep = startEpisode(s.agent); s.trail = [s.ep.s]; }
function finished() { say(episodeNote(s.ep)); }

// ---------- Controls ----------
function showSliders() {
  $('gammaOut').textContent = `${s.gamma.toFixed(2)}. ${gammaHint(s.gamma)}`;
  $('epsilonOut').textContent = `${s.epsilon.toFixed(2)}. ${epsilonHint(s.epsilon)}`;
}
$('gamma').addEventListener('input', e => { s.gamma = Number(e.target.value); showSliders(); }); // learning goes on, no reset
$('epsilon').addEventListener('input', e => { s.epsilon = Number(e.target.value); showSliders(); });
$('reset').addEventListener('click', newBrain);
const press = (attr, current) => document.querySelectorAll(`[data-${attr}]`).forEach(b => b.setAttribute('aria-pressed', String(b.dataset[attr] === current)));
document.querySelectorAll('[data-map]').forEach(b => b.addEventListener('click', () => {
  s.mapId = b.dataset.map; press('map', s.mapId); newBrain();
}));
document.querySelectorAll('[data-rate]').forEach(b => b.addEventListener('click', () => {
  s.rate = b.dataset.rate; s.wait = 0; press('rate', s.rate);
  $('log').setAttribute('aria-live', s.rate === 'step' ? 'polite' : 'off'); // only Step is slow enough to read aloud
  if (s.ep.outcome) nextEpisode();
}));

// ---------- Running ----------
// step: one move every beat, so you watch the robot. 1: one whole episode every beat. fast: as many as fit in BUDGET ms.
function advance(steps) {
  if (s.rate === '0') return;
  if (s.rate === 'fast') {
    for (let i = 0; i < FAST; i++) s.ep = runEpisode(s.agent, params());
    finished();
    nextEpisode();
    return;
  }
  s.wait += steps;
  if (s.wait < BEAT) return;
  s.wait = 0;
  if (s.rate === '1') { s.ep = runEpisode(s.agent, params()); finished(); nextEpisode(); return; }
  if (s.ep.outcome) { nextEpisode(); return; } // the finished try stays on screen for one beat
  stepEpisode(s.agent, s.ep, params());
  s.trail.push(s.ep.s);
  if (s.ep.outcome) finished();
}

// ---------- Drawing ----------
function resize() {
  const a = sizeCanvas(stageCanvas, 1); view.stage = a;
  const c = sizeCanvas(chartCanvas); cctx.setTransform(c.dpr, 0, 0, c.dpr, 0, 0); view.chart = c;
  drawChart();
}
function drawChart() {
  if (!view.chart) return;
  // The last SHOWN points of the 20-episode average; the scale runs from -10 (every try ends in the pit) to 10 (the big treasure).
  const { values, start } = curvePoints(s.agent.history, SHOWN);
  drawLine(cctx, values.map(v => Math.max(v, -10)), { width: view.chart.w, height: view.chart.h, min: -10, max: 10, empty: 'No episode yet.', first: `Episode ${start + 1}`, last: i => `Episode ${start + i + 1}`, format: v => v.toFixed(0), theme });
}
function drawStageNow() {
  const { dpr, w, h } = view.stage;
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sctx.clearRect(0, 0, w, h);
  drawMaze(sctx, theme, { map: s.agent.map, values: valueGrid(s.agent), policy: policyGrid(s.agent), robot: s.ep.s, trail: s.trail, w, h });
}

let shown = -1;
const ticker = makeTicker();
function frame(now) {
  advance(ticker(now));
  if (s.agent.episodes !== shown) { // the readouts and the curve change only when an episode ends
    shown = s.agent.episodes;
    const last = s.agent.history[shown - 1];
    $('episodes').textContent = shown;
    $('lastReward').textContent = shown ? last.toFixed(1) : '–';
    $('bestPath').textContent = learnedNote(s.agent);
    drawChart();
  }
  drawStageNow();
  requestAnimationFrame(frame);
}

document.querySelectorAll('.info-text[data-info]').forEach(p => { p.textContent = INFO[p.dataset.info]; });
document.querySelectorAll('.info').forEach(btn => btn.addEventListener('click', () => {
  const open = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', String(open));
  $(btn.getAttribute('aria-controls')).hidden = !open;
}));
wireLamp($('lamp'), () => { theme = readTheme(); drawChart(); });
new ResizeObserver(resize).observe(document.body);

newBrain();
showSliders();
resize();
requestAnimationFrame(frame);
