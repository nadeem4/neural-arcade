import {
  WORLD_W, WORLD_H, SIZES, IN_LABELS, OUT_LABELS, LAPS, MAXF, describeInput, describeOutput,
  createRace, tick, endGeneration, leaderOf, aliveCount, pedigree, newTrack, restart, progressPct,
  makeGhost, stepCar, inheritance, distanceLabel, firstFinishNote,
} from './sim.js';
import { drawTrack, sizeCanvas } from './track-view.js';
import { drawBrain } from '../../engine/brain-panel.js';
import { drawBars } from '../../engine/curve.js';
import { pedigreeSvg, scoreLabel, updateScores } from '../../engine/pedigree.js';
import { readTheme, wireLamp } from '../../assets/theme.js';

const $ = id => document.getElementById(id);
const trackCanvas = $('track'), brainCanvas = $('brain'), chartCanvas = $('chart'), pedEl = $('pedigree');
pedEl.addEventListener('animationend', () => pedEl.classList.remove('arrive'));
const tctx = trackCanvas.getContext('2d'), bctx = brainCanvas.getContext('2d'), cctx = chartCanvas.getContext('2d');

const race = createRace();
let theme = readTheme(), speed = 1, paused = false, view = {}, frameNo = 0, pedKey = '', pedGen = 0;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const children = () => race.pop - race.elite - race.fresh;
const cap = t => t[0].toUpperCase() + t.slice(1);
const theBest = () => (race.elite === 1 ? 'the best car' : `the best ${race.elite} cars`);

// ---------- Narration: plain words first, the real term second ----------
function say(text) { $('log').textContent = text; }

function narrateGeneration(s) {
  if (s.firstFinish) {
    return say(s.gen === 1 ? firstFinishNote(1) : `${firstFinishNote(s.gen)} Try New track to check whether it learned to drive or only memorised this circuit.`);
  }
  say(`Generation ${s.gen}: ${s.finishers} of ${race.pop} cars finished. ${cap(theBest())} ${race.elite === 1 ? 'carries' : 'carry'} over unchanged, ${plural(race.fresh, 'random newcomer joins', 'random newcomers join')}, and ${children()} children mix two parents' genes (crossover).`);
}

function mutationHint(rate) {
  if (rate === 0) return 'No mutation: children can only reshuffle genes their parents already have, so nothing new can appear.';
  if (rate >= 0.3) return 'Mutation this high scrambles every child, so good driving cannot be passed on. Watch the finished bars fall.';
  return null;
}

const POP_WORDS = { 5: 'Five', 10: 'Ten', 20: 'Twenty', 50: 'Fifty' };
const POP_HINTS = {
  5: 'Few tries per round: slow, and luck matters a lot.',
  10: 'Few enough to follow every car. Usually learns within a handful of rounds.',
  20: 'More tries per round, so a good driver turns up sooner.',
  50: 'Many tries per round: often lucky in round one, but each round is five times the work of ten cars.',
};

// ---------- Last round: a card under the controls that updates each round, without stopping the race ----------
function dna(cells) {
  return `<div class="dna">${cells.map(c => `<i class="${c}"></i>`).join('')}</div>`;
}

function roundHtml(s) {
  const rankOf = id => s.ranked.findIndex(c => c.id === id);
  // Show a child with two different parents when there is one, so the mixing is visible.
  const kids = race.cars.filter(c => c.kind === 'child');
  const child = kids.find(c => c.parents[0] !== c.parents[1]) ?? kids[0];
  const [pa, pb] = child.parents.map(id => s.ranked[rankOf(id)]);
  const from = inheritance(child.genome, pa.genome, pb.genome);
  const mutated = from.filter(c => c === 'm').length;
  const rows = s.ranked.slice(0, 12).map((c, i) => {
    const role = i < race.elite ? 'Kept, and a parent' : i < race.pool ? 'Parent' : 'No children';
    return `<li class="${i < race.pool ? 'is-parent' : ''}"><span class="m-n">${i + 1}</span>
      <span class="m-bar"><i style="width:${(c.pct / (LAPS * 100)) * 100}%"></i></span>
      <span class="m-pct">${scoreLabel(c.pct)}</span><span class="m-role">${role}</span></li>`;
  }).join('');
  const more = s.ranked.length > 12 ? `<li class="m-more">and ${s.ranked.length - 12} more with no children</li>` : '';
  const head = `Last round · generation ${s.gen}: ${s.finishers} of ${race.pop} finished`;
  return `<p class="m-head">${head}</p>
    <div class="m-body">
      <ol class="m-rank">${rows}${more}</ol>
      <div class="m-dna">
        <p class="m-title">How a child is made</p>
        <p class="m-label">Parent: car ${rankOf(pa.id) + 1}</p>${dna(Array(pa.genome.length).fill('a'))}
        <p class="m-label">Parent: car ${rankOf(pb.id) + 1}</p>${dna(Array(pb.genome.length).fill('b'))}
        <p class="m-label">Child: half its genes from each, ${plural(mutated, 'gene', 'genes')} mutated</p>${dna(from)}
        <p class="m-key"><span><i class="a"></i>from first parent</span><span><i class="b"></i>from second</span><span><i class="m"></i>mutated</span></p>
      </div>
    </div>
    <p class="m-foot">This round: ${theBest()} kept, ${children()} children, ${plural(race.fresh, 'random newcomer', 'random newcomers')}.</p>`;
}

function updateRound(s) {
  const el = $('round');
  $('roundBody').innerHTML = roundHtml(s);
  el.classList.add('fresh');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('fresh')));
}

function clearRound() {
  $('roundBody').innerHTML = `<p class="m-head">Last round</p><p class="m-foot">Results appear here when the first round ends: every car ranked by how far it got, and how one child was made from two parents.</p>`;
}

// ---------- Ghost race: the best of generation 1 against the latest best, same track, same start ----------
let ghost = null, firstBest = null, latestBest = null;

function remember(s) {
  if (s.gen === 1) firstBest = s.ranked[0].genome;
  latestBest = { genome: s.ranked[0].genome, gen: s.gen };
  $('ghost').disabled = !(firstBest && latestBest.gen > 1);
}

function startGhost() {
  if (!firstBest || !latestBest) return;
  ghost = { old: makeGhost(firstBest, race.track, 1), now: makeGhost(latestBest.genome, race.track, 0), frame: 0 };
  $('ghostText').textContent = 'Stop ghost race';
  $('caption').hidden = false;
  $('captionText').textContent = `Ghost race: the best of generation 1 against the best of generation ${latestBest.gen}.`;
  say(`Ghost race: the outline is the best car of generation 1, the amber car is the best of generation ${latestBest.gen}. Same track, same start, no learning during the race.`);
}

function stopGhost() {
  ghost = null;
  $('caption').hidden = true;
  $('ghostText').textContent = 'Ghost race';
}

function stepGhost() {
  for (const c of [ghost.old, ghost.now]) if (c.alive) stepCar(c, race.track, ghost.frame);
  ghost.frame++;
  if ((!ghost.old.alive && !ghost.now.alive) || ghost.frame >= MAXF) {
    const old = scoreLabel(progressPct(ghost.old)), now = scoreLabel(progressPct(ghost.now));
    say(`Ghost race over: generation 1's best managed ${old}; generation ${latestBest.gen}'s best managed ${now}.`);
    stopGhost();
  }
}

// ---------- Rendering ----------
let follow = false, cam = null;
const ZOOM = 2.4;

function setFollow(on) {
  follow = on; cam = null;
  $('follow').setAttribute('aria-pressed', String(on));
}

function camera(car) {
  if (!follow) return null;
  cam = cam ? { x: cam.x + (car.x - cam.x) * 0.15, y: cam.y + (car.y - cam.y) * 0.15 } : { x: car.x, y: car.y };
  return { ...cam, zoom: ZOOM };
}


function resize() {
  const t = sizeCanvas(trackCanvas, WORLD_H / WORLD_W);
  view = { dpr: t.dpr, scale: t.w / WORLD_W };
  const b = sizeCanvas(brainCanvas); bctx.setTransform(b.dpr, 0, 0, b.dpr, 0, 0); view.brain = b;
  const c = sizeCanvas(chartCanvas); cctx.setTransform(c.dpr, 0, 0, c.dpr, 0, 0); view.chart = c;
  pedKey = '';
  drawChart();
}

function drawChart() {
  drawBars(cctx, race.finishHistory, {
    width: view.chart.w, height: view.chart.h, max: race.pop, maxLabel: `All ${race.pop}`,
    empty: 'Bars appear after the first generation.', theme,
  });
}

function drawPedigree(leader, animate) {
  const width = Math.max(240, pedEl.clientWidth);
  pedEl.innerHTML = pedigreeSvg(pedigree(race, leader, 3), { width });
  if (animate) { pedEl.classList.remove('arrive'); void pedEl.offsetWidth; pedEl.classList.add('arrive'); }
}

function setGen(n) {
  const b = $('gen'), text = String(n).padStart(3, '0');
  if (b.textContent === text) return;
  b.textContent = text;
  b.classList.remove('flip'); void b.offsetWidth; b.classList.add('flip');
}

function onGeneration(s) {
  remember(s);
  narrateGeneration(s);
  drawChart();
  updateRound(s);
}

function frame() {
  if (!paused) {
    for (let k = 0; k < speed; k++) {
      if (ghost) { stepGhost(); if (!ghost) break; continue; }
      const s = tick(race);
      if (s) onGeneration(s);
    }
  }
  const leader = leaderOf(race), driver = ghost ? ghost.now : leader;
  const shown = ghost ? { track: race.track, cars: [ghost.old] } : race;
  const tags = ghost ? [{ car: ghost.old, text: 'Gen 1' }, { car: ghost.now, text: `Gen ${latestBest.gen}` }] : [];
  drawTrack(tctx, shown, driver, theme, { ...view, focus: camera(driver), tags });
  const net = {
    sizes: SIZES, genome: driver?.genome, acts: driver?.acts, inLabels: IN_LABELS, outLabels: OUT_LABELS,
    heads: ['What it senses', '8 hidden', 'What it does'], inWords: describeInput, outWords: describeOutput, theme,
  };
  drawBrain(bctx, { ...net, width: view.brain.w, height: view.brain.h });

  // The pedigree slides in once per new generation; lead changes and scores redraw in place.
  const key = `${race.gen}:${leader.id}`;
  if (key !== pedKey) { drawPedigree(leader, pedGen !== 0 && pedGen !== race.gen); pedKey = key; pedGen = race.gen; }
  else if (frameNo % 12 === 0) updateScores(pedEl, pedigree(race, leader, 3));

  setGen(race.gen);
  // Big number, small goal: "7 of 10", "0.42 of 2 laps".
  const [far, ...goal] = distanceLabel(progressPct(leader)).split(' ');
  $('alive').innerHTML = `${aliveCount(race)}<small> of ${race.pop}</small>`;
  $('lead').innerHTML = `${far}<small> ${goal.join(' ')}</small>`;
  frameNo++;
  requestAnimationFrame(frame);
}

// ---------- Controls ----------
function setSpeed(n) {
  speed = n;
  document.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === n)));
}

function resetRace(pop) {
  stopGhost();
  restart(race, pop);
  clearRound();
  firstBest = latestBest = null; $('ghost').disabled = true;
  pedKey = '';
  document.querySelectorAll('.popN').forEach(el => { el.textContent = race.pop; });
  drawChart();
}

document.querySelectorAll('[data-speed]').forEach(btn => btn.addEventListener('click', () => setSpeed(Number(btn.dataset.speed))));
document.querySelectorAll('[data-pop]').forEach(btn => btn.addEventListener('click', () => {
  const pop = Number(btn.dataset.pop);
  document.querySelectorAll('[data-pop]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
  $('popOut').textContent = POP_HINTS[pop];
  $('briefSetup').textContent = `${POP_WORDS[pop]} cars get random brains. Nobody teaches them how to drive.`;
  resetRace(pop);
  say(`Restarted with ${pop} cars. Generation 1 is all random brains again.`);
}));
$('pause').addEventListener('click', () => {
  paused = !paused;
  $('pause').dataset.state = paused ? 'paused' : 'running';
  $('pause').setAttribute('aria-label', paused ? 'Resume' : 'Pause');
  $('pause').title = paused ? 'Resume' : 'Pause';
});
$('follow').addEventListener('click', () => setFollow(!follow));
$('ghost').addEventListener('click', () => (ghost ? stopGhost() : startGhost()));
// Info buttons open a short explanation under their label.
document.querySelectorAll('.info').forEach(btn => btn.addEventListener('click', () => {
  const open = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', String(open));
  $(btn.getAttribute('aria-controls')).hidden = !open;
}));
$('newTrack').addEventListener('click', () => {
  stopGhost();
  newTrack(race);
  pedKey = '';
  say('New track, same brains. If they crash now, they memorised the old corners instead of learning to read the walls. That is overfitting.');
});
$('restart').addEventListener('click', () => {
  resetRace(race.pop);
  say('Training restarted. Generation 1 is all random brains again.');
});
$('mut').addEventListener('input', e => {
  race.mutRate = Number(e.target.value);
  $('mutOut').textContent = `${Math.round(race.mutRate * 100)}% of genes nudged`;
  const hint = mutationHint(race.mutRate);
  if (hint) say(hint);
});
wireLamp($('lamp'), () => { theme = readTheme(); pedKey = ''; drawChart(); });
new ResizeObserver(resize).observe(document.body);

resize();
requestAnimationFrame(frame);
