import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../engine/rng.js';
import { makeTrack, progressPct } from '../games/racer/sim.js';
import { trainEpoch } from '../engine/train.js';
import { TEACH_SIZES, TEACH_GENOME, CRUISE, newCar, stepTeach, autopilot } from '../games/teach/sim.js';

const track = makeTrack(mulberry32(1));

function teacherLap(t) {
  const c = newCar(t), data = [];
  for (let f = 0; c.alive && f < 5000; f++) data.push(stepTeach(c, t, { want: autopilot(c), frame: f }));
  return { car: c, data };
}

describe('teach by driving', () => {
  it('has a 6-8-1 brain of 65 numbers', () => {
    expect(TEACH_SIZES).toEqual([6, 8, 1]);
    expect(TEACH_GENOME).toBe(65);
  });

  it('records one example per frame you steer, with your smoothed steering as the answer', () => {
    const c = newCar(track);
    const ex = stepTeach(c, track, { want: 1 });
    expect(ex.input).toHaveLength(6);
    expect(ex.target[0]).toBeCloseTo(0.25);
    expect(stepTeach(c, track, { want: 1 }).target[0]).toBeCloseTo(0.4375);
  });

  it('lets the brain steer, recording nothing, when you are not steering', () => {
    const c = newCar(track), g = new Float32Array(TEACH_GENOME).fill(0.3);
    expect(stepTeach(c, track, { genome: g })).toBeNull();
    expect(c.steer).toBe(c.acts[2][0]);
  });

  it('holds cruising speed', () => {
    const { car } = teacherLap(track);
    expect(car.speed).toBeGreaterThan(CRUISE * 0.9);
    expect(car.speed).toBeLessThan(CRUISE * 1.1);
  });

  it('the stand-in teacher drives two laps', () => {
    for (const s of [1, 2, 3]) expect(teacherLap(makeTrack(mulberry32(s))).car.finished).toBe(true);
  });

  it('a brain trained on the teacher lap drives two laps by itself', () => {
    const { data } = teacherLap(track), rng = mulberry32(9);
    const g = new Float64Array(TEACH_GENOME).map(() => (rng() - 0.5));
    for (let e = 0; e < 30; e++) trainEpoch(g, TEACH_SIZES, data, { lr: 0.05, batch: 32, rng });
    const c = newCar(track);
    for (let f = 0; c.alive && f < 5000; f++) stepTeach(c, track, { genome: g, frame: f });
    expect(progressPct(c)).toBe(200);
  });
});
