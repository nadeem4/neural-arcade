import { describe, it, expect } from 'vitest';
import { lapDoneNote, learningNote, drivesNote, retrainNote, testEndNote } from '../games/teach/words.js';

describe('teach by driving: what the track says at each step', () => {
  it('says the lap is over and what happens next', () => {
    expect(lapDoneNote(850)).toBe('Lap complete! Next, step 2: it learns from your 850 examples.');
  });

  it('counts the passes while it learns', () => {
    expect(learningNote(12, 40)).toBe('Step 2: learning. Pass 12 of 40');
  });

  it('announces step 3 before the brain drives', () => {
    expect(drivesNote()).toBe('Step 3: now it drives on its own. Take the wheel if it heads for trouble.');
  });

  it('says what a retrain learns from', () => {
    expect(retrainNote(910, 60)).toBe('Step 2 again: it learns from all 910 examples, including your 60 corrections.');
  });

  it('says how the brain\'s drive ended and that it goes again', () => {
    expect(testEndNote(true)).toBe('Two laps on its own! It drives again in a moment.');
    expect(testEndNote(false)).toBe('It crashed at the red cross. It tries again in a moment.');
  });
});
