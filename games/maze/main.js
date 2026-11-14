// Treasure Maze page: an explorer learns a small dungeon by Q-learning; you set the discount and the exploring.
import { drawLine } from '../../engine/curve.js';
import { makeTicker } from '../../engine/ticker.js';
import { readTheme, wireLamp } from '../../assets/theme.js';
import { sizeCanvas } from '../racer/track-view.js';
import { createAgent, startEpisode, stepEpisode, runEpisode, greedyWalk, valueGrid, policyGrid, DEFAULTS } from './sim.js';
import { gammaHint, epsilonHint, episodeNote, learnedNote, INFO } from './words.js';
import { drawMaze, curvePoints, loadArt, actionBetween, walkAt } from './render.js';

const $ = id => document.getElementById(id);
const stageCanvas = $('stage'), chartCanvas = $('chart');
const sctx = stageCanvas.getContext('2d'), cctx = chartCanvas.getContext('2d');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const light = document.createElement('canvas'); // the darkness layer, sized with the stage
let theme = readTheme(), view = {}, art = null, clock = 0;

// FAST: episodes per frame in Fast (about 900 a second). BEAT: 60 Hz steps between moves (step) or episodes (play), about 4 a second.
const FAST = 15, BEAT = 15, END = 75, SHOWN = 500, WALK_MAX = 25; // WALK_MAX: longest walk shown in Play, in tiles // END: 60 Hz steps a finished try stays on screen in Step, so the pickup or the fall can play
const seed = () => (Math.random() * 2 ** 32) >>> 0;
// from and action: the last move, for the explorer's walk in Step. wait: steps since that move.
// walk: in Play, the explorer shows the best path it knows now, { path, outcome, t }, one tile a beat; training goes on unseen.
const s = { agent: null, ep: null, from: null, action: null, walk: null, mapId: 'near-or-far', gamma: DEFAULTS.gamma, epsilon: DEFAULTS.epsilon, rate: '1', wait: 0, four: false };
const params = () => ({ alpha: DEFAULTS.alpha, gamma: s.gamma, epsilon: s.epsilon });
const say = t => { $('log').textContent = t; };

function newBrain() {
  s.agent = createAgent(s.mapId, seed());
  s.ep = startEpisode(s.agent); s.from = s.action = s.walk = null; s.wait = 0;
  say('A new explorer, knowing nothing. Every tile starts at zero, so the first tries are random wandering.');
  drawChart();
}
function nextEpisode() { s.ep = startEpisode(s.agent); s.from = s.action = null; }
function finished() { say(episodeNote(s.ep)); }

// ---------- Controls ----------
function showSliders() {
  $('gammaOut').textContent = `${s.gamma.toFixed(2)}. ${gammaHint(s.gamma)}`;
  $('epsilonOut').textContent = `${s.epsilon.toFixed(2)}. ${epsilonHint(s.epsilon)}`;
}
$('gamma').addEventListener('input', e => { s.gamma = Number(e.target.value); showSliders(); }); // learning goes on, no reset
$('epsilon').addEventListener('input', e => { s.epsilon = Number(e.target.value); showSliders(); });
$('reset').addEventListener('click', newBrain);
$('four').addEventListener('click', e => { s.four = !s.four; e.currentTarget.setAttribute('aria-pressed', String(s.four)); e.currentTarget.textContent = s.four ? 'Hide the four values' : 'Show the four values'; });
const press = (attr, current) => document.querySelectorAll(`[data-${attr}]`).forEach(b => b.setAttribute('aria-pressed', String(b.dataset[attr] === current)));
document.querySelectorAll('[data-map]').forEach(b => b.addEventListener('click', () => {
  s.mapId = b.dataset.map; press('map', s.mapId); newBrain();
}));
document.querySelectorAll('[data-rate]').forEach(b => b.addEventListener('click', () => {
  s.rate = b.dataset.rate; s.wait = 0; s.from = s.walk = null; press('rate', s.rate);
  $('log').setAttribute('aria-live', s.rate === 'step' ? 'polite' : 'off'); // only Step is slow enough to read aloud
  if (s.ep.outcome) nextEpisode();
}));

// ---------- Running ----------
// step: one move every beat, so you watch the explorer. 1: one whole episode every beat. fast: as many as fit in BUDGET ms.
function advance(steps) {
  if (s.rate === '0') return;
  if (s.rate === 'fast') {
    for (let i = 0; i < FAST; i++) s.ep = runEpisode(s.agent, params());
    finished();
    nextEpisode();
    return;
  }
  if (s.rate === '1' && !reduceMotion.matches) {
    if (s.walk && !walkAt(s.agent.map, s.walk.path, s.walk.outcome, s.walk.t).done) s.walk.t += steps;
    else { const g = greedyWalk(s.agent), long = g.path.length > WALK_MAX; s.walk = { path: g.path.slice(0, WALK_MAX), outcome: long ? 'cap' : g.outcome, t: 0 }; }
  }
  s.wait += steps;
  if (s.wait < (s.ep.outcome && !reduceMotion.matches ? END : BEAT)) return;
  s.wait = 0;
  if (s.rate === '1') { s.ep = runEpisode(s.agent, params()); finished(); nextEpisode(); return; }
  if (s.ep.outcome) { nextEpisode(); return; } // the finished try stays on screen for END steps
  s.from = s.ep.s;
  stepEpisode(s.agent, s.ep, params());
  s.action = actionBetween(s.agent.map, s.from, s.ep.s) ?? s.action; // a bump into a wall keeps his facing
  if (s.ep.outcome) finished();
}

// ---------- Drawing ----------
function resize() {
  const a = sizeCanvas(stageCanvas, 2 / 3); view.stage = a;
  light.width = stageCanvas.width; light.height = stageCanvas.height;
  light.getContext('2d').setTransform(a.dpr, 0, 0, a.dpr, 0, 0);
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
  // In Step he walks the real episode; in Play he walks the best path it knows now while episodes train unseen; in Fast and on Pause he stands on his tile. Reduced motion never walks or flickers.
  const walks = s.rate === 'step' && !reduceMotion.matches;
  const play = s.rate === '1' && !reduceMotion.matches && s.walk, leg = play && walkAt(s.agent.map, s.walk.path, s.walk.outcome, s.walk.t);
  const explorer = leg ? { from: leg.from, action: leg.action, outcome: leg.outcome, k: leg.k, e: leg.e } : walks ? { from: s.from, action: s.action, outcome: s.ep.outcome, k: s.wait / BEAT, e: (s.wait - BEAT) / 60 } : { action: s.action };
  drawMaze(sctx, theme, { map: s.agent.map, values: valueGrid(s.agent), policy: policyGrid(s.agent), showFour: s.four, q: s.agent.q, robot: leg ? leg.to : s.ep.s, explorer, art, light, now: reduceMotion.matches || s.rate === 'fast' ? null : clock, w, h });
}

let shown = -1;
const ticker = makeTicker();
function frame(now) {
  clock = now / 1000;
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

loadArt('art/').then(a => { art = a; }).catch(() => {}); // without the art the stage stays dark, with its glows and arrows
newBrain();
showSliders();
resize();
requestAnimationFrame(frame);
