// Teach by Driving: you steer, the car records what it sensed and what you did, and a brain learns to copy you.
// No DOM, so it runs in tests and in the page alike. Track, sensing and physics come from Neural Racer.
import { createActs, forward, genomeLength } from '../../engine/tinynet.js';
import { N, makeGhost, makeTrack, sense, drive } from '../racer/sim.js';

// Six senses in, eight hidden neurons, one output: steering. The car holds its own speed.
export const TEACH_SIZES = [6, 8, 1];
export const TEACH_GENOME = genomeLength(TEACH_SIZES); // 65
// Gentle enough for a person with two buttons: a slow cruising speed and, at full lock, 60% of the racer's turn rate.
// You teach one lap; the brain is tested on two.
export const CRUISE = 1.5, STEER_MAX = 0.6, STEER_RATE = 0.25, TEACH_LAPS = 1;

export const lapDone = c => c.maxProg >= N * TEACH_LAPS;

// Teaching tracks: a road 85 wide (the racer's is 54) with bends at 70% strength, so two buttons are enough.
export const makeTeachTrack = rng => makeTrack(rng, { width: 85, wobble: 0.7 });

// Throttle that settles at cruising speed, used whether you or the brain is steering.
export function cruiseThrottle(c) {
  return Math.max(-1, Math.min(1, 0.4 + (CRUISE - c.speed) * 2));
}

export function newCar(track) {
  const c = makeGhost(new Float32Array(0), track);
  c.acts = createActs(TEACH_SIZES);
  c.steer = 0;
  return c;
}

// One frame. `want` is your steering (-1 left, 0 straight, 1 right) or null when the brain steers.
// Your steering is smoothed like a real wheel, and every frame you steer becomes one example: senses in, your steer out.
export function stepTeach(c, track, { genome = null, want = null, frame = 0 } = {}) {
  const input = sense(c, track);
  const guess = genome ? forward(genome, TEACH_SIZES, input, c.acts)[0] : 0;
  let example = null;
  if (want !== null) {
    c.steer += (want - c.steer) * STEER_RATE;
    example = { input: Float32Array.from(input), target: Float32Array.of(c.steer) };
  } else c.steer = guess;
  drive(c, track, c.steer * STEER_MAX, cruiseThrottle(c), frame);
  return example;
}

// A stand-in teacher for tests and the write-up's figures: steer towards whichever side has more room.
export function autopilot(c) {
  const v = c.acts[0], room = v[3] + v[4] - v[0] - v[1];
  return Math.max(-1, Math.min(1, room * 2.5));
}
