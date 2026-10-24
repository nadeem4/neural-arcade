// The arcade home runs a real Neural Racer in the first tray, a little faster than real time, and live previews of the other games below.
import { WORLD_W, WORLD_H, createRace, tick, leaderOf, finishedCount } from '../games/racer/sim.js';
import { drawTrack, sizeCanvas } from '../games/racer/track-view.js';
import { readTheme, wireLamp } from './theme.js';
import { makeTicker } from '../engine/ticker.js';

const canvas = document.getElementById('preview'), ctx = canvas.getContext('2d');
const race = createRace();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let theme = readTheme(), view = {}, visible = true;

function resize() {
  const t = sizeCanvas(canvas, WORLD_H / WORLD_W);
  view = { dpr: t.dpr, scale: t.w / WORLD_W, sensors: false };
}

const ticker = makeTicker(), ticker2 = makeTicker(); // 60 steps a second on any screen
function frame(now) {
  const steps = ticker(now);
  if (visible) {
    if (!reduceMotion) for (let k = 0; k < 3 * steps; k++) tick(race);
    drawTrack(ctx, race, leaderOf(race), theme, view);
    document.getElementById('pgen').textContent = race.gen;
    document.getElementById('pdone').textContent = finishedCount(race);
  }
  requestAnimationFrame(frame);
}

// Pause the simulation while the tray is scrolled out of view.
new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
new ResizeObserver(resize).observe(canvas);
wireLamp(document.getElementById('lamp'), () => { theme = readTheme(); });

resize();
requestAnimationFrame(frame);

// The second tray: Teach by Driving's brain from its write-up, trained on two laps of examples, driving alone.
// The lesson is computed only when the tray first scrolls into view.
const canvas2 = document.getElementById('preview2'), ctx2 = canvas2.getContext('2d');
let lesson = null, car2 = null, frame2 = 0, view2 = {}, visible2 = false, started2 = false;
const sim2 = Promise.all([import('../games/teach/story-data.js'), import('../games/teach/sim.js')]);

async function startTeach() {
  const [{ recordLesson, LESSON_SEED }, { newCar, stepTeach }] = await sim2;
  lesson ??= recordLesson(LESSON_SEED);
  car2 = newCar(lesson.track);
  const loop = now => {
    const steps = ticker2(now);
    if (visible2) {
      if (!reduceMotion) for (let k = 0; k < steps; k++) {
        stepTeach(car2, lesson.track, { genome: lesson.final, frame: frame2++ });
        if (!car2.alive) { car2 = newCar(lesson.track); frame2 = 0; }
      }
      drawTrack(ctx2, { track: lesson.track, cars: [car2] }, car2, theme, view2);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

new IntersectionObserver(([e]) => { visible2 = e.isIntersecting; if (visible2 && !started2) { started2 = true; startTeach(); } }).observe(canvas2);
new ResizeObserver(() => { const t = sizeCanvas(canvas2, WORLD_H / WORLD_W); view2 = { dpr: t.dpr, scale: t.w / WORLD_W }; }).observe(canvas2);

// The third tray: Coin Runner's brain from its write-up (trained on the Balanced rules), playing the level on a loop.
// Loaded only when the tray first scrolls into view.
const canvas3 = document.getElementById('preview3'), ctx3 = canvas3.getContext('2d');
let visible3 = false, started3 = false, view3 = {};
async function startRunner() {
  const [{ mulberry32 }, { createLearner }, sim, render] = await Promise.all([
    import('../engine/rng.js'), import('../engine/reinforce.js'), import('../games/runner/sim.js'), import('../games/runner/render.js')]);
  const [story, art] = await Promise.all([fetch('games/runner/story.json').then(r => r.json()), render.loadArt('games/runner/art/')]);
  const rng = mulberry32(5), L = createLearner(sim.RUNNER_SIZES, rng), ticker3 = makeTicker();
  L.genome.set(story.runs.balanced.genome);
  let run, fx, hold = 0;
  const begin = () => { run = sim.startTry(L, sim.PRESETS.balanced.rules, rng); fx = render.createFx(); render.follow(fx, run.g, true); };
  begin();
  const loop = now => {
    const steps = ticker3(now);
    if (visible3) {
      if (!reduceMotion) for (let k = 0; k < steps; k++) {
        if (hold > 0) { if (--hold === 0) begin(); continue; }
        render.react(fx, run.g, sim.tick(run)); render.settle(fx);
        if (run.outcome) hold = 60;
      }
      render.follow(fx, run.g);
      render.drawLevel(ctx3, run.g, fx, art, { width: view3.w, dpr: view3.dpr });
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
new IntersectionObserver(([e]) => { visible3 = e.isIntersecting; if (visible3 && !started3) { started3 = true; startRunner(); } }).observe(canvas3);
new ResizeObserver(() => { view3 = sizeCanvas(canvas3, 5 / 8); }).observe(canvas3);
