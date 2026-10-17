// "How it works": every figure is drawn from one seeded run of the real simulation, so the pictures
// match the words on every visit. Animated figures only run while they are on screen.
import { mulberry32 } from '../../../engine/rng.js';
import { drawBrain } from '../../../engine/brain-panel.js';
import { nextGeneration } from '../../../engine/evolve.js';
import { readTheme, wireLamp } from '../../../assets/theme.js';
import { makeTicker } from '../../../engine/ticker.js';
import {
  WORLD_W, WORLD_H, SIZES, GENOME, IN_LABELS, OUT_LABELS, LAPS,
  createRace, tick, leaderOf, makeGhost, stepCar, describeInput, describeOutput, inheritance,
} from '../sim.js';
import { scoreLabel as scoreText } from '../../../engine/pedigree.js';
import { drawTrack, sizeCanvas } from '../track-view.js';
import { recordRun, childExample } from '../story-data.js';

// Seed 307: in round one most cars crash, each in its own way; then the best distance climbs every generation
// until a car finishes in generation 5. tests/racer-story.test.js holds the run to this story.
const SEED = 307;
const run = recordRun(SEED);
const gen1 = run.gens[0], last = run.gens.at(-1), star = last.cars[last.best];
const carName = car => `Car ${gen1.cars.indexOf(car) + 1}`;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
let theme = readTheme();

// ---------- Figure plumbing: resize and redraw on demand, step only while visible ----------
const figs = [], visible = new Set();
const io = new IntersectionObserver(entries => entries.forEach(e => {
  const fig = figs.find(f => f.el === e.target);
  if (e.isIntersecting) { visible.add(fig); fig.enter?.(); } else visible.delete(fig);
}), { rootMargin: '80px' });
function addFigure(fig) { figs.push(fig); io.observe(fig.el); }

// ---------- Fig. 1: generation 1, live and looping ----------
{
  const canvas = $('figRace'), ctx = canvas.getContext('2d');
  let race = createRace({ rng: mulberry32(SEED) }), view = {}, rest = 0, held = null;
  if (reduce) for (let k = 0; k < 90; k++) tick(race);
  addFigure({
    el: canvas,
    resize() { const t = sizeCanvas(canvas, WORLD_H / WORLD_W); view = { dpr: t.dpr, scale: t.w / WORLD_W }; },
    step() {
      if (reduce) return;
      // Hold the final positions for a second, then replay the same round.
      if (rest > 0) { if (--rest === 0) { race = createRace({ rng: mulberry32(SEED) }); held = null; } return; }
      const cars = race.cars;
      if (tick(race)) { held = { track: race.track, cars }; rest = 60; }
    },
    draw() { drawTrack(ctx, held ?? race, held ? null : leaderOf(race), theme, view); },
  });
}

// ---------- Figs. 2 and 3: the run's first finisher driving, its senses and its brain ----------
const driver = { car: makeGhost(star.genome, run.track), frame: 0, stepped: -1 };
function driveOnce(frameNo) {
  if (driver.stepped === frameNo || reduce) return;
  driver.stepped = frameNo;
  stepCar(driver.car, run.track, driver.frame++);
  if (!driver.car.alive || driver.frame > 3600) { driver.car = makeGhost(star.genome, run.track); driver.frame = 0; }
}
if (reduce) for (let k = 0; k < 140; k++) stepCar(driver.car, run.track, driver.frame++);

{
  const canvas = $('figCar'), ctx = canvas.getContext('2d'), senses = $('senses');
  senses.innerHTML = IN_LABELS.map(l => `<div class="sense"><span>${l}</span><i><b></b></i><em></em></div>`).join('');
  const rows = [...senses.children];
  let view = {}, cam = null;
  addFigure({
    el: canvas,
    resize() { const t = sizeCanvas(canvas, WORLD_H / WORLD_W); view = { dpr: t.dpr, scale: t.w / WORLD_W }; },
    step: driveOnce,
    draw() {
      const c = driver.car;
      cam = cam && driver.frame > 1 ? { x: cam.x + (c.x - cam.x) * 0.2, y: cam.y + (c.y - cam.y) * 0.2 } : { x: c.x, y: c.y };
      drawTrack(ctx, { track: run.track, cars: [c] }, c, theme, { ...view, focus: { ...cam, zoom: 2.6 } });
      c.acts[0].forEach((v, i) => {
        rows[i].querySelector('b').style.width = `${Math.round(v * 100)}%`;
        rows[i].querySelector('em').textContent = describeInput(i, v);
      });
    },
  });
}

{
  const canvas = $('figBrain'), ctx = canvas.getContext('2d');
  let size = {};
  addFigure({
    el: canvas,
    resize() { size = sizeCanvas(canvas); ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0); },
    step: driveOnce,
    draw() {
      const c = driver.car;
      drawBrain(ctx, {
        sizes: SIZES, genome: c.genome, acts: c.acts, inLabels: IN_LABELS, outLabels: OUT_LABELS,
        heads: ['What it senses', '8 hidden', 'What it does'], inWords: describeInput, outWords: describeOutput,
        theme, width: size.w, height: size.h,
      });
    },
  });
}

// ---------- Fig. 4: the same brain as 74 numbers ----------
{
  const cell = w => {
    const strength = Math.min(1, Math.abs(w) / 2);
    return `<i class="${w < 0 ? 'neg' : 'pos'}" style="--k:${(0.2 + strength * 0.8).toFixed(2)}"></i>`;
  };
  const split = SIZES[0] * SIZES[1] + SIZES[1];
  $('genesA').innerHTML = [...star.genome.slice(0, split)].map(cell).join('');
  $('genesB').innerHTML = [...star.genome.slice(split)].map(cell).join('');
}

// ---------- Figs. 5 and 9: small multiples of car paths, drawn out when they scroll into view ----------
const roadCache = new WeakMap();
function road(track) {
  if (!roadCache.has(track)) {
    const p = new Path2D();
    track.pts.forEach((pt, i) => (i ? p.lineTo(pt.x, pt.y) : p.moveTo(pt.x, pt.y)));
    p.closePath();
    roadCache.set(track, p);
  }
  return roadCache.get(track);
}

// The box every path in a list fits in, padded and stretched to the tray's 8:5 shape.
function frameAround(cars, pad) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of cars) for (let i = 0; i < c.path.length; i += 2) {
    x0 = Math.min(x0, c.path[i]); x1 = Math.max(x1, c.path[i]);
    y0 = Math.min(y0, c.path[i + 1]); y1 = Math.max(y1, c.path[i + 1]);
  }
  let w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2;
  if (w / h > WORLD_W / WORLD_H) h = w * WORLD_H / WORLD_W; else w = h * WORLD_W / WORLD_H;
  return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w };
}

function drawPath(ctx, size, box, car, t, winner) {
  const k = size.w / box.w, px = 1 / k;
  ctx.setTransform(k * size.dpr, 0, 0, k * size.dpr, -box.x * k * size.dpr, -box.y * k * size.dpr);
  ctx.fillStyle = theme.tray; ctx.fillRect(box.x, box.y, box.w, box.w);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.lineWidth = run.track.width; ctx.strokeStyle = theme.road; ctx.stroke(road(run.track));
  const p0 = run.track.pts[0], nx = -Math.sin(run.track.startAngle), ny = Math.cos(run.track.startAngle);
  ctx.lineWidth = 2 * px; ctx.strokeStyle = theme.ink; ctx.setLineDash([3 * px, 3 * px]);
  ctx.beginPath(); ctx.moveTo(p0.x - nx * run.track.width / 2, p0.y - ny * run.track.width / 2); ctx.lineTo(p0.x + nx * run.track.width / 2, p0.y + ny * run.track.width / 2); ctx.stroke();
  ctx.setLineDash([]);

  const n = car.path.length / 2, m = Math.max(1, Math.round(n * t));
  ctx.lineWidth = 2.2 * px; ctx.strokeStyle = winner ? theme.amber : theme.ink;
  ctx.beginPath(); ctx.moveTo(car.path[0], car.path[1]);
  for (let i = 1; i < m; i++) ctx.lineTo(car.path[i * 2], car.path[i * 2 + 1]);
  ctx.stroke();
  const ex = car.path[(m - 1) * 2], ey = car.path[(m - 1) * 2 + 1], r = 5 * px;
  if (t < 1 || car.end === 'finished') { ctx.fillStyle = winner ? theme.amber : theme.ink; ctx.fillRect(ex - r * 0.7, ey - r * 0.7, r * 1.4, r * 1.4); }
  else if (car.end === 'crashed') {
    ctx.lineWidth = 2.4 * px; ctx.strokeStyle = theme.red;
    ctx.beginPath(); ctx.moveTo(ex - r, ey - r); ctx.lineTo(ex + r, ey + r); ctx.moveTo(ex + r, ey - r); ctx.lineTo(ex - r, ey + r); ctx.stroke();
  } else {
    ctx.lineWidth = 2 * px; ctx.strokeStyle = theme.ink;
    ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.stroke();
  }
}

function minis(el, items, box, label) {
  el.innerHTML = items.map(it => `<figure class="mini"><canvas aria-label="${label(it)}"></canvas><figcaption>${label(it)}</figcaption></figure>`).join('');
  const canvases = [...el.querySelectorAll('canvas')], ctxs = canvases.map(c => c.getContext('2d'));
  let sizes = [], start = reduce ? -Infinity : null;
  addFigure({
    el,
    enter() { start ??= performance.now(); },
    resize() { sizes = canvases.map(c => sizeCanvas(c, WORLD_H / WORLD_W)); },
    draw(now) {
      const t = start === null ? 0 : Math.min(1, (now - start) / 2400);
      items.forEach((it, i) => drawPath(ctxs[i], sizes[i], box, it.car, t, it.winner));
    },
  });
}

const ENDS = { crashed: 'crashed', stalled: 'stalled', finished: 'finished' };
minis($('figRound'), gen1.cars.map(car => ({ car })), frameAround(gen1.cars, 40),
  ({ car }) => `${carName(car)} · ${scoreText(car.pct)} · ${ENDS[car.end]}`);
minis($('figGens'), run.gens.map(g => ({ car: g.cars[g.best], gen: g.gen, winner: g.cars[g.best].end === 'finished' })),
  { x: 0, y: 0, w: WORLD_W },
  ({ car, gen, winner }) => `Gen ${gen} · ${winner ? `finished ${LAPS} laps` : scoreText(car.pct)}`);
$('finishLine').textContent = `Generation ${run.firstFinish}: a car drives ${LAPS} full laps. Its brain was never trained, only bred from the cars that drove a little further than the rest, round after round.`;

// ---------- Fig. 6: generation 1 ranked ----------
{
  const ranked = [...gen1.cars].sort((a, b) => b.pct - a.pct), top = ranked[0].pct || 1;
  $('figRank').innerHTML = ranked.map((car, i) => {
    const role = i === 0 ? 'Parent, and kept unchanged' : i < 3 ? 'Parent' : 'No children';
    return `<li class="${i < 3 ? 'is-parent' : ''}"><span class="r-n">${i + 1}</span><span class="r-name">${carName(car)}</span>
      <span class="r-bar"><i style="width:${(car.pct / top) * 100}%"></i></span><span class="r-pct">${scoreText(car.pct)}</span><span class="r-role">${role}</span></li>`;
  }).join('');
}

// ---------- Fig. 7: crossover and mutation, with a button to breed again ----------
{
  const ex = childExample(run);
  const strip = cells => `<div class="dna">${cells.map(k => `<i class="${k}"></i>`).join('')}</div>`;
  const show = (genes) => {
    const n = k => genes.filter(g => g === k).length;
    $('figBreed').innerHTML = `
      <p class="dna-label">Parent: ${carName(ex.a)}</p>${strip(Array(GENOME).fill('a'))}
      <p class="dna-label">Parent: ${carName(ex.b)}</p>${strip(Array(GENOME).fill('b'))}
      <p class="dna-label child">Child: ${n('a')} from ${carName(ex.a)}, ${n('b')} from ${carName(ex.b)}, ${n('m')} mutated</p>${strip(genes)}
      <p class="key"><span><i class="a"></i>from ${carName(ex.a)}</span><span><i class="b"></i>from ${carName(ex.b)}</span><span><i class="m"></i>mutated</span></p>`;
  };
  show(ex.genes);
  const rng = mulberry32(SEED + 1), parents = [ex.a, ex.b];
  $('breedAgain').addEventListener('click', () => {
    let kid;
    do {
      [kid] = nextGeneration(parents, { popSize: 1, elite: 0, fresh: 0, poolSize: 2, mutRate: 0.08, mutScale: 0.4, genomeLength: GENOME, rng, newId: () => 0 });
    } while (kid.parents[0] === kid.parents[1]);
    show(inheritance(kid.genome, ex.a.genome, ex.b.genome));
  });
}

// ---------- Fig. 8: who generation 2 is, in lineage marks ----------
{
  const MARK = {
    kept: ['<path d="M3 3h10v10H3Z"/>', 'kept unchanged'],
    child: ['<circle cx="8" cy="8" r="5.5"/>', 'child of two parents'],
    new: ['<path d="M8 1.5 14.5 8 8 14.5 1.5 8Z"/>', 'brand-new random brain'],
  };
  const groups = ['kept', 'child', 'new'].map(kind => [kind, run.gens[1].cars.filter(c => c.kind === kind).length]);
  $('figLineup').innerHTML = groups.map(([kind, count]) => `<li><span class="marks">${
    Array(count).fill(`<svg viewBox="0 0 16 16" aria-hidden="true">${MARK[kind][0]}</svg>`).join('')
  }</span><span>${count} ${MARK[kind][1]}</span></li>`).join('');
}

// ---------- Loop ----------
let frameNo = 0;
const ticker = makeTicker(); // 60 simulation steps a second, whatever the screen's refresh rate
function frame(now) {
  for (let k = ticker(now); k > 0; k--) { frameNo++; for (const fig of visible) fig.step?.(frameNo); }
  for (const fig of visible) fig.draw(now);
  requestAnimationFrame(frame);
}
function resizeAll() { for (const fig of figs) { fig.resize(); fig.draw(performance.now()); } }
new ResizeObserver(resizeAll).observe(document.body);
wireLamp($('lamp'), () => { theme = readTheme(); resizeAll(); });
requestAnimationFrame(frame);
