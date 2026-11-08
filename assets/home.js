// The arcade home: renders the hero, categories and chips from the games data, and plays one recorded Coin Runner brain on the demo stage.
import { CATEGORIES, GAMES, homeModel } from './games.js';
import { heroActionsHtml, categoryHtml, chipsHtml } from './home-view.js';
import { mountSite } from './site.js';
import { makeTicker } from '../engine/ticker.js';
import { sizeCanvas } from '../games/racer/track-view.js';

mountSite('');
const model = homeModel(CATEGORIES, GAMES);
document.getElementById('hero-actions').innerHTML = heroActionsHtml(model.hero);
document.getElementById('stage-title').textContent = model.hero.title;
document.getElementById('categories').innerHTML = model.categories.map(categoryHtml).join('');
document.getElementById('chips').innerHTML = chipsHtml(model.chips);

// The demo stage: Coin Runner's brain from its write-up (trained on the Balanced rules), playing the level on a loop.
// Paused while scrolled out of view; still when the visitor prefers reduced motion.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('demo'), ctx = canvas.getContext('2d');
const movesEl = document.getElementById('moves');
let visible = false, started = false, view = {};

async function startRunner() {
  const [{ mulberry32 }, { createLearner }, sim, render] = await Promise.all([
    import('../engine/rng.js'), import('../engine/reinforce.js'), import('../games/runner/sim.js'), import('../games/runner/render.js')]);
  const [story, art] = await Promise.all([fetch('games/runner/story.json').then(r => r.json()), render.loadArt('games/runner/art/')]);
  const rng = mulberry32(5), L = createLearner(sim.RUNNER_SIZES, rng), ticker = makeTicker();
  L.genome.set(story.runs.balanced.genome);
  movesEl.innerHTML = sim.ACTIONS.map(a => `<li><span>${a}</span><span class="bar"><i style="width:0"></i></span><span class="num"></span></li>`).join('');
  const rows = [...movesEl.children];
  const showMoves = p => rows.forEach((li, i) => {
    li.querySelector('i').style.width = Math.round(p[i] * 100) + '%';
    li.querySelector('.num').textContent = p[i] >= .05 ? Math.round(p[i] * 100) + '%' : '';
    li.classList.toggle('on', p[i] === Math.max(...p));
  });
  let run, fx, hold = 0;
  const begin = () => { run = sim.startTry(L, sim.PRESETS.balanced.rules, rng); fx = render.createFx(); render.follow(fx, run.g, true); };
  begin();
  const loop = now => {
    const steps = ticker(now);
    if (visible) {
      if (!reduceMotion) for (let k = 0; k < steps; k++) {
        if (hold > 0) { if (--hold === 0) begin(); continue; }
        render.react(fx, run.g, sim.tick(run)); render.settle(fx);
        if (run.outcome) hold = 60;
      }
      if (run.current) showMoves(run.current.p);
      render.follow(fx, run.g);
      render.drawLevel(ctx, run.g, fx, art, { width: view.w, dpr: view.dpr });
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !started) { started = true; startRunner(); } }).observe(canvas);
new ResizeObserver(() => { view = sizeCanvas(canvas, 5 / 8); }).observe(canvas);
