import { describe, it, expect } from 'vitest';
import { lapDoneNote, learningNote, drivesNote, retrainNote, testEndNote, relearnNote, wheelMode } from '../games/teach/words.js';

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

  it('after two clean laps on your track, moves on to a track it has never seen', () => {
    expect(testEndNote('finished', false)).toBe('Two laps on your track. Now the real test: a track it has never seen.');
  });

  it('stops after two clean laps on a new track', () => {
    expect(testEndNote('finished', true)).toBe('Done: two laps on a track it never saw. It learned to drive, not just your track. Try New track, or change the learning rate.');
  });

  it('goes again after a crash, so you can take the wheel', () => {
    expect(testEndNote('crashed', false)).toBe('It crashed at the red cross. It goes again in a moment: take the wheel just before the cross, then press Retrain.');
  });

  it('says a new learning rate relearns the same examples from scratch', () => {
    expect(relearnNote(1, 850)).toBe('New learning rate (1): learning your same 850 examples again, from scratch.');
  });
});

describe('teach by driving: what the steering buttons do', () => {
  const at = (phase, more = {}) => wheelMode({ phase, wait: 0, rest: 0, done: false, ...more });
  it('steer the car while you teach', () => expect(at('teach')).toBe('drive'));
  it('are off while it learns', () => expect(at('train')).toBe('off'));
  it('take the wheel from the brain while it drives', () => expect(at('test')).toBe('takeover'));
  it('are off while a caption announces the next step, between drives, and once it is done', () => {
    expect(at('test', { wait: 10 })).toBe('off');
    expect(at('test', { rest: 10 })).toBe('off');
    expect(at('test', { done: true })).toBe('off');
  });
});
