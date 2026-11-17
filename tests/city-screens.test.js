import { describe, it, expect } from 'vitest';
import { nextScreen, canToggleView } from '../games/city/screens.js';

describe('the race screens', () => {
  it('a race starts from the map, a drive or the end card, and ends on the race result', () => {
    for (const from of ['map', 'driving', 'done', 'raced']) expect(nextScreen(from, 'race')).toBe('racing');
    expect(nextScreen('training', 'race')).toBe('training');
    expect(nextScreen('racing', 'finished')).toBe('raced');
    expect(nextScreen('racing', 'skip')).toBe('raced');
  });
  it('leaves the result for the rate card or for training, and lets the Map view work in a race', () => {
    expect(nextScreen('raced', 'edit')).toBe('map');
    expect(nextScreen('raced', 'train')).toBe('training');
    expect(nextScreen('raced', 'replay')).toBe('driving');
    expect(canToggleView('racing')).toBe(true);
  });
});

describe('nextScreen', () => {
  it('walks the loop: map, training, driving, done, then back', () => {
    let s = 'map';
    s = nextScreen(s, 'train'); expect(s).toBe('training');
    s = nextScreen(s, 'trained'); expect(s).toBe('driving');
    s = nextScreen(s, 'arrived'); expect(s).toBe('done');
    expect(nextScreen(s, 'again')).toBe('driving');
    expect(nextScreen(s, 'edit')).toBe('map');
    expect(nextScreen(s, 'train')).toBe('training');
  });
  it('a failed training run goes back to the map', () => {
    expect(nextScreen('training', 'failed')).toBe('map');
  });
  it('skip ends a drive', () => {
    expect(nextScreen('driving', 'skip')).toBe('done');
  });
  it('replay (DRIVE from the garage) starts a drive from the map, a drive or the end card, but not while training', () => {
    for (const from of ['map', 'driving', 'done']) expect(nextScreen(from, 'replay')).toBe('driving');
    expect(nextScreen('training', 'replay')).toBe('training');
  });
  it('ignores events that make no sense', () => {
    expect(nextScreen('training', 'train')).toBe('training');
    expect(nextScreen('map', 'skip')).toBe('map');
    expect(nextScreen('training', 'skip')).toBe('training');
    expect(nextScreen('driving', 'edit')).toBe('driving');
    expect(nextScreen('map', 'edit')).toBe('map');
    expect(nextScreen('map', 'again')).toBe('map');
    expect(nextScreen('driving', 'train')).toBe('driving');
    expect(nextScreen('map', 'nonsense')).toBe('map');
  });
});

describe('canToggleView', () => {
  it('only while driving', () => {
    expect(canToggleView('driving')).toBe(true);
    expect(canToggleView('map')).toBe(false);
    expect(canToggleView('training')).toBe(false);
  });
});
