// The home page demo for Balance: the trained brain from the write-up keeps the pole up on a loop, and an occasional shove
// (Push) makes it visibly correct. startDemo(canvas, panelEl) is the interface every game's demo.js shares.
import { createActs } from '../../engine/tinynet.js';
import { makeTicker } from '../../engine/ticker.js';
import { readTheme } from '../../assets/theme.js';
import { sizeCanvas } from '../racer/track-view.js';
import { newGame, step, push, LIMIT } from './sim.js';
import { SIZES, aiAct } from './ai.js';
import { layout, drawStage } from './render.js';

const SHOVE_EVERY = 300;                      // a shove every 5 s, alternating right and left (the brain survives this pattern for the full 20 s)

export const newRun = genome => ({ g: newGame(), genome, acts: createActs(SIZES), input: new Float32Array(4), outcome: null, force: 0 });

// One step: shove now and then, let the brain push, step the physics. Returns the push it chose and whether a shove landed.
export function tickRun(run) {
  const g = run.g;
  const shoved = g.t > 0 && g.t % SHOVE_EVERY === 0;
  if (shoved) push(g, (g.t / SHOVE_EVERY) % 2 ? 1 : -1);
  run.force = aiAct(run.genome, g, run.acts, run.input);
  if (step(g, run.force)) run.outcome = 'fell';
  else if (g.t >= LIMIT) run.outcome = 'limit';
  return { force: run.force, shoved };
}

export const forceView = u => {
  const pct = Math.round(Math.abs(u) * 100);
  return pct < 5 ? { label: 'None', pct: 0 } : { label: u > 0 ? 'Right' : 'Left', pct };
};

export async function startDemo(canvas, panelEl) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');
  let visible = false, view = {}, theme = readTheme();
  const story = await fetch(new URL('story.json', import.meta.url)).then(r => r.json());
  const ticker = makeTicker();
  panelEl.innerHTML = '<li><span>Push</span><span class="bar"><i style="width:0"></i></span><span class="num"></span></li>';
  const row = panelEl.firstElementChild;
  const showForce = u => {
    const f = forceView(u);
    row.querySelector('span').textContent = f.label === 'None' ? 'Push' : f.label;
    row.querySelector('i').style.width = f.pct + '%';
    row.querySelector('.num').textContent = f.pct ? f.pct + '%' : '';
    row.classList.toggle('on', f.pct > 0);
  };
  let run = newRun(story.ai.late.genome), hold = 0;
  const loop = now => {
    const steps = ticker(now);
    if (visible) {
      if (!reduceMotion) for (let k = 0; k < steps; k++) {
        if (hold > 0) { if (--hold === 0) run = newRun(story.ai.late.genome); continue; }
        tickRun(run);
        if (run.outcome) hold = 60;
      }
      showForce(run.force);
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      ctx.clearRect(0, 0, view.w, view.h);
      ctx.fillStyle = theme.tray; ctx.fillRect(0, 0, view.w, view.h);
      drawStage(ctx, run.g, { lay: layout(view.w, view.h), theme, force: run.force, fell: run.outcome === 'fell' });
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  const retheme = () => { theme = readTheme(); };
  new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', retheme);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  new ResizeObserver(() => { view = sizeCanvas(canvas, 5 / 8); }).observe(canvas);
}
