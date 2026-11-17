import { describe, it, expect } from 'vitest';
import { nextScreen, canToggleView } from '../games/city/screens.js';

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
