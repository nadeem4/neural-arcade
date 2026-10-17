// Data for the Teach by Driving write-up: one seeded lesson, from the teacher's laps to the corrected brain,
// so every figure is drawn from a real run. The stand-in teacher (autopilot) plays the part of you.
import { mulberry32 } from '../../engine/rng.js';
import { randomGenome } from '../../engine/evolve.js';
import { trainEpoch, datasetLoss, gradient } from '../../engine/train.js';
import { makeTrack, progressPct } from '../racer/sim.js';
import { TEACH_SIZES, TEACH_GENOME, newCar, stepTeach, autopilot, lapDone } from './sim.js';

const MAX_FRAMES = 8000;
const point = c => [c.x, c.y];

// The brain drives alone; `takeOver(car)` may return a steer to grab the wheel for that frame (recorded as an example).
function drive(track, genome, takeOver = () => null) {
  const c = newCar(track), path = [point(c)], added = [], taken = [];
  for (let f = 0; c.alive && f < MAX_FRAMES; f++) {
    const want = f ? takeOver(c) : null;
    const ex = stepTeach(c, track, { genome, want, frame: f });
    if (ex) { added.push(ex); taken.push(path.length); }
    path.push(point(c));
  }
  return { path, taken, added, end: c.finished ? 'finished' : c.crashed ? 'crashed' : 'stalled', pct: progressPct(c) };
}

function train(genome, data, epochs, lr, rng) {
  const losses = [datasetLoss(genome, TEACH_SIZES, data)];
  for (let e = 0; e < epochs; e++) losses.push(trainEpoch(genome, TEACH_SIZES, data, { lr, batch: 32, rng }));
  return losses;
}

export function recordLesson(seed, { epochs = 30, lr = 0.05 } = {}) {
  const track = makeTrack(mulberry32(seed));
  // 1. The teacher drives one lap; every frame is an example.
  const teacherCar = newCar(track), teacherPath = [point(teacherCar)], examples = [];
  for (let f = 0; teacherCar.alive && !lapDone(teacherCar) && f < MAX_FRAMES; f++) {
    examples.push(stepTeach(teacherCar, track, { want: autopilot(teacherCar), frame: f }));
    teacherPath.push(point(teacherCar));
  }
  // 2. A random brain learns from them.
  const start = Float64Array.from(randomGenome(TEACH_GENOME, mulberry32(100 + seed)), v => v * 0.5);
  const genome = start.slice(), rng = mulberry32(seed);
  const losses = train(genome, examples, epochs, lr, rng);
  const trained = genome.slice();
  // 3. It drives alone.
  const first = drive(track, trained);
  // 4. It drives again; the teacher takes the wheel for 20 frames whenever a feeler reads under 12% (close to a wall).
  let hold = 0;
  const corrected = drive(track, trained, c => {
    if (Math.min(...c.acts[0].slice(0, 5)) < 0.12) hold = 20;
    return hold-- > 0 ? autopilot(c) : null;
  });
  // 5. Retrain on everything, then drive alone again.
  const all = examples.concat(corrected.added);
  const relosses = train(genome, all, epochs, lr, rng);
  const after = drive(track, genome);
  return { seed, track, teacherPath, examples, start, trained, losses, first, corrected, all, relosses, final: genome, after };
}

// Loss as one weight slides while the other 64 stay put: the hill that gradient descent walks down.
export function lossCurve(genome, data, index, { span = 3, steps = 60 } = {}) {
  const g = genome.slice(), centre = genome[index];
  return Array.from({ length: steps + 1 }, (_, k) => {
    g[index] = centre - span + (2 * span * k) / steps;
    return { w: g[index], loss: datasetLoss(g, TEACH_SIZES, data) };
  });
}

// A ball on that hill: start somewhere, then step against the slope (the gradient for that one weight).
export function rollDown(genome, data, index, from, { lr = 0.5, steps = 12 } = {}) {
  const g = genome.slice(), path = [];
  g[index] = from;
  for (let k = 0; k <= steps; k++) {
    const { loss, grad } = gradient(g, TEACH_SIZES, data);
    path.push({ w: g[index], loss });
    g[index] -= lr * grad[index];
  }
  return path;
}

// The hill to draw: of the weights feeding the steering output, the one where a ball started 2 away from
// the trained value rolls furthest down. Returns its index and where the ball starts.
export function bestHill(genome, data, { lr = 1, steps = 12 } = {}) {
  const first = TEACH_SIZES[0] * TEACH_SIZES[1] + TEACH_SIZES[1];
  let best = null;
  for (let i = first; i < genome.length; i++) for (const off of [-2, 2]) {
    const r = rollDown(genome, data, i, genome[i] + off, { lr, steps });
    const drop = r[0].loss - r.at(-1).loss;
    if (!best || drop > best.drop) best = { index: i, from: genome[i] + off, drop };
  }
  return best;
}
