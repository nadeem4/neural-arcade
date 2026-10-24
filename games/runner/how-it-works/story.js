// "How it works" for Coin Runner: the figures come from story.json, three real seeded learning runs recorded by
// story-data.js, so the pictures match the words on every visit. The replays roll live moves from the trained brains.
import { mulberry32 } from '../../../engine/rng.js';
import { createLearner } from '../../../engine/reinforce.js';
import { readTheme, wireLamp } from '../../../assets/theme.js';
import { makeTicker } from '../../../engine/ticker.js';
import { sizeCanvas } from '../../racer/track-view.js';
import { RUNNER_SIZES, PRESETS, ACTIONS, startTry, tick } from '../sim.js';
import { loadArt, createFx, react, settle, follow, drawLevel, drawOutcomes } from '../render.js';
import { historyOf, settledAt } from '../story-data.js';

const $ = id => document.getElementById(id);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let theme = readTheme(), art = null;
const S = await (await fetch('../story.json')).json();
const share = (h, f) => Math.round((h.filter(f).length / h.length) * 100);

// ---------- Figure plumbing ----------
const figs = [], visible = new Set();
const io = new IntersectionObserver(entries => entries.forEach(e => {
  const fig = figs.find(f => f.el === e.target);
  if (e.isIntersecting) visible.add(fig); else visible.delete(fig);
}), { rootMargin: '80px' });
function addFigure(fig) { figs.push(fig); io.observe(fig.el); }

// A trained brain playing the level on a loop. Its moves are still rolled from its chances, as in the game.
function replay(canvas, genome, rules, seed) {
  const L = createLearner(RUNNER_SIZES, mulberry32(seed)), rng = mulberry32(seed);
  L.genome.set(genome);
  const ctx = canvas.getContext('2d');
  let run, fx, hold = 0, view = {};
  const begin = () => { run = startTry(L, rules, rng); fx = createFx(); follow(fx, run.g, true); };
  begin();
  return {
    el: canvas,
    resize() { view = sizeCanvas(canvas, 5 / 8); },
    step() {
      if (reduce) return;
      if (hold > 0) { if (--hold === 0) begin(); return; }
      react(fx, run.g, tick(run), { reduceMotion: reduce }); settle(fx);
      if (run.outcome) hold = 60;
    },
    draw() { if (art) { follow(fx, run.g); drawLevel(ctx, run.g, fx, art, { width: view.w, dpr: view.dpr }); } },
    run: () => run,
  };
}

function outcomes(canvas, history) {
  let size = {};
  return {
    el: canvas,
    resize() { size = sizeCanvas(canvas); canvas.getContext('2d').setTransform(size.dpr, 0, 0, size.dpr, 0, 0); },
    draw() { drawOutcomes(canvas.getContext('2d'), history, { width: size.w, height: size.h, theme, slots: 80 }); },
  };
}

document.querySelectorAll('.n-tries').forEach(el => { el.textContent = S.tries.toLocaleString('en'); });
$('seed').textContent = S.seed;
const H = Object.fromEntries(Object.keys(S.runs).map(k => [k, historyOf(S.runs[k])]));

// ---------- Fig. 1 ----------
{
  const fig = replay($('figPlay'), S.runs.balanced.genome, PRESETS.balanced.rules, 3);
  addFigure(fig);
  const last = H.balanced.slice(-100);
  $('playCaption').textContent = `The brain after ${S.tries.toLocaleString('en')} tries with the Balanced rules, on a loop. It reached the flag on ${share(last, t => t.outcome === 'finished')} of its last 100 tries. It was never shown how.`;
}

// ---------- Fig. 2: chances before and after ----------
{
  const row = (label, p) => `<div class="ch-row"><p class="ch-label">${label}</p>${ACTIONS.map((a, k) =>
    `<div class="ch"><span>${a}</span><i><b style="width:${(p[k] * 100).toFixed(1)}%"></b></i><em>${Math.round(p[k] * 100)}%</em></div>`).join('')}</div>`;
  $('figChances').innerHTML = row('Brand-new brain', S.runs.balanced.before) + row(`After ${S.tries.toLocaleString('en')} tries`, S.runs.balanced.after);
}

// ---------- Fig. 3: how tries ended while it learned ----------
{
  addFigure(outcomes($('figLearn'), H.balanced));
  const at = settledAt(H.balanced, t => t.outcome === 'finished');
  $('learnCaption').textContent = `With the Balanced rules: one bar per 50 tries. For the first few hundred it nearly always died. From about try ${at.toLocaleString('en')}, four in five tries reached the flag.`;
}

// ---------- Fig. 4: three rule sets ----------
{
  const el = $('figThree');
  const notes = {
    balanced: h => `Reached the flag on ${share(h, t => t.outcome === 'finished')} of its last 100 tries.`,
    coinHungry: h => `Farmed the block until time ran out on ${share(h, t => t.outcome === 'timeout' && t.coins >= 8)} of its last 100, about ${Math.round(h.reduce((a, t) => a + t.coins, 0) / h.length)} coins a try.`,
    afraid: h => `Ran out the clock on ${share(h, t => t.outcome === 'timeout')} of its last 100 tries.`,
  };
  el.innerHTML = Object.keys(S.runs).map(k => `<figure class="mini">
    <canvas class="level" aria-label="The brain trained with ${PRESETS[k].name}, playing"></canvas>
    <canvas class="outcomes small" aria-label="How its tries ended while it learned"></canvas>
    <figcaption><b>${PRESETS[k].name}</b> ${notes[k](H[k].slice(-100))}</figcaption></figure>`).join('');
  const minis = [...el.querySelectorAll('figure')];
  const parts = Object.keys(S.runs).map((k, i) => {
    const [lv, oc] = minis[i].querySelectorAll('canvas');
    return [replay(lv, S.runs[k].genome, PRESETS[k].rules, 11 + i), outcomes(oc, H[k])];
  });
  addFigure({
    el,
    resize() { parts.forEach(p => p.forEach(f => f.resize())); },
    step() { parts.forEach(([r]) => r.step()); },
    draw() { parts.forEach(p => p.forEach(f => f.draw())); },
  });
}

// ---------- Loop ----------
const ticker = makeTicker();
function frame(now) {
  for (let k = ticker(now); k > 0; k--) for (const fig of visible) fig.step?.();
  for (const fig of visible) fig.draw(now);
  requestAnimationFrame(frame);
}
function resizeAll() { for (const fig of figs) { fig.resize(); fig.draw(performance.now()); } }
new ResizeObserver(resizeAll).observe(document.body);
wireLamp($('lamp'), () => { theme = readTheme(); resizeAll(); });
loadArt('../art/').then(a => { art = a; resizeAll(); });
requestAnimationFrame(frame);
