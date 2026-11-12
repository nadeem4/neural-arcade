// The home page demo for Coin Runner: its brain from the write-up (trained on the Balanced rules) playing the level on a loop.
// startDemo(canvas, panelEl) is the interface every game's demo.js shares. Paused while scrolled out of view; still when the visitor prefers reduced motion.
import { mulberry32 } from '../../engine/rng.js';
import { createLearner } from '../../engine/reinforce.js';
import { makeTicker } from '../../engine/ticker.js';
import { sizeCanvas } from '../racer/track-view.js';
import * as sim from './sim.js';
import * as render from './render.js';

export async function startDemo(canvas, panelEl) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');
  let visible = false, view = {};
  const [story, art] = await Promise.all([fetch(new URL('story.json', import.meta.url)).then(r => r.json()), render.loadArt(new URL('art/', import.meta.url).href)]);
  const rng = mulberry32(5), L = createLearner(sim.RUNNER_SIZES, rng), ticker = makeTicker();
  L.genome.set(story.runs.balanced.genome);
  panelEl.innerHTML = sim.ACTIONS.map(a => `<li><span>${a}</span><span class="bar"><i style="width:0"></i></span><span class="num"></span></li>`).join('');
  const rows = [...panelEl.children];
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
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  new ResizeObserver(() => { view = sizeCanvas(canvas, 5 / 8); }).observe(canvas);
}
