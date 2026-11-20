import { describe, it, expect } from 'vitest';
import { TRACKS, trackById } from '../assets/tracks/index.js';

describe('track configs', () => {
  it('lists the three tracks in order', () => {
    expect(TRACKS.map(t => t.id)).toEqual(['neural-networks', 'reinforcement-learning', 'physical-ai']);
  });
  it('reinforcement learning has the planned parts and live lessons', () => {
    const rl = trackById('reinforcement-learning');
    expect(rl.parts.map(p => p.lessons.length)).toEqual([6, 2, 5, 2, 3, 1]);
    expect(rl.parts.flatMap(p => p.lessons).filter(l => l.status === 'live').map(l => l.id))
      .toEqual(['agent', 'state-action-reward', 'return', 'policy', 'value', 'mdp', 'reward-design']);
    expect(rl.needs).toEqual([{ track: 'neural-networks', before: 'function-approximation' }]);
  });
  it('physical AI holds the PID lesson with its video', () => {
    expect(trackById('physical-ai').parts[0].lessons[0].video).toBe('drtqgVse4jo');
  });
  it('neural networks has two live lessons', () => {
    const ls = trackById('neural-networks').parts[0].lessons;
    expect(ls.map(l => [l.id, l.game, l.status])).toEqual([
      ['learning-from-examples', 'teach', 'live'], ['learning-by-selection', 'racer', 'live'],
    ]);
  });
  it('trackById is undefined for an unknown id', () => {
    expect(trackById('nope')).toBeUndefined();
  });
});
