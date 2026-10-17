import { describe, it, expect } from 'vitest';
import { describeInput, describeOutput, distanceLabel, firstFinishNote } from '../games/racer/sim.js';

describe('brain readout in words', () => {
  it('says which way the car is steering', () => {
    expect(describeOutput(0, -0.42)).toBe('turning left');
    expect(describeOutput(0, 0.6)).toBe('turning right');
    expect(describeOutput(0, 0.05)).toBe('going straight');
  });

  it('says what the throttle is doing', () => {
    expect(describeOutput(1, 0.8)).toBe('speeding up');
    expect(describeOutput(1, -0.5)).toBe('braking');
    expect(describeOutput(1, -0.1)).toBe('coasting');
  });

  it('says how far the wall is for each feeler', () => {
    expect(describeInput(2, 1)).toBe('clear');
    expect(describeInput(0, 0.7)).toBe('far');
    expect(describeInput(4, 0.35)).toBe('near');
    expect(describeInput(1, 0.1)).toBe('close');
  });

  it('says how fast the car is going', () => {
    expect(describeInput(5, 0.1)).toBe('slow');
    expect(describeInput(5, 0.5)).toBe('cruising');
    expect(describeInput(5, 0.9)).toBe('fast');
  });
});

describe('readouts and first-finish wording', () => {
  it('shows distance against the two-lap goal', () => {
    expect(distanceLabel(0)).toBe('0 of 2 laps');
    expect(distanceLabel(42.4)).toBe('0.42 of 2 laps');
    expect(distanceLabel(200)).toBe('2 of 2 laps');
  });

  it('calls a first-round finish luck, not learning', () => {
    expect(firstFinishNote(1)).toMatch(/random brain got lucky/i);
    expect(firstFinishNote(1)).not.toMatch(/ancestors/i);
    expect(firstFinishNote(6)).toMatch(/generation 6/i);
    expect(firstFinishNote(6)).toMatch(/ancestors/i);
  });
});
