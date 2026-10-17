// The arcade home runs a real Neural Racer in the first tray, a little faster than real time.
import { WORLD_W, WORLD_H, createRace, tick, leaderOf, finishedCount } from '../games/racer/sim.js';
import { drawTrack, sizeCanvas } from '../games/racer/track-view.js';
import { readTheme, wireLamp } from './theme.js';

const canvas = document.getElementById('preview'), ctx = canvas.getContext('2d');
const race = createRace();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let theme = readTheme(), view = {}, visible = true;

function resize() {
  const t = sizeCanvas(canvas, WORLD_H / WORLD_W);
  view = { dpr: t.dpr, scale: t.w / WORLD_W, sensors: false };
}

function frame() {
  if (visible) {
    if (!reduceMotion) for (let k = 0; k < 3; k++) tick(race);
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
  const [{ recordLesson }, { newCar, stepTeach }] = await sim2;
  lesson ??= recordLesson(2);
  car2 = newCar(lesson.track);
  const loop = () => {
    if (visible2) {
      if (!reduceMotion) {
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
