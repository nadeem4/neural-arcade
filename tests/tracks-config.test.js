import { describe, it, expect } from 'vitest';
import { TRACKS, trackById } from '../assets/tracks/index.js';

describe('track configs', () => {
  it('lists the three tracks in order', () => {
    expect(TRACKS.map(t => t.id)).toEqual(['neural-networks', 'reinforcement-learning', 'physical-ai']);
  });
  it('reinforcement learning has the planned parts and live lessons', () => {
    const rl = trackById('reinforcement-learning');
    expect(rl.parts.map(p => [p.title, p.lessons.length])).toEqual([
      ['What is reinforcement learning?', 2], ['One decision', 2], ['A chain of decisions', 5], ['Planning with the rulebook', 3],
      ['Learning without the rulebook', 5], ['Too big for a table', 2], ['Learning the policy directly', 3],
      ['Planning meets learning', 2], ['In the real world', 2],
    ]);
    expect(rl.parts.flatMap(p => p.lessons).map(l => l.id)).toEqual([
      'learning-by-reward', 'loop', 'bandit', 'exploration', 'state', 'return', 'policy', 'value', 'mdp',
      'bellman-equation', 'value-iteration', 'policy-iteration', 'monte-carlo', 'td-learning', 'action-values', 'q-learning', 'sarsa',
      'function-approximation', 'dqn', 'policy-gradient', 'actor-critic', 'ppo', 'model-based', 'search', 'reward-design', 'map-of-rl',
    ]);
    expect(rl.parts.flatMap(p => p.lessons).filter(l => l.status === 'live').map(l => l.id))
      .toEqual(['learning-by-reward', 'loop', 'state', 'return', 'policy', 'value', 'mdp', 'reward-design']);
    expect(rl.needs).toEqual([{ track: 'neural-networks', before: 'function-approximation' }]);
  });
  it('the deep lessons borrow the balance game and map-of-rl the city, none with a level', () => {
    const by = id => trackById('reinforcement-learning').parts.flatMap(p => p.lessons).find(l => l.id === id);
    for (const id of ['function-approximation', 'dqn', 'policy-gradient', 'actor-critic', 'ppo']) expect(by(id)).toMatchObject({ game: 'balance', status: 'soon' });
    for (const id of ['function-approximation', 'dqn', 'policy-gradient', 'actor-critic', 'ppo', 'map-of-rl']) expect(by(id)).not.toHaveProperty('level');
    expect(by('map-of-rl')).toMatchObject({ game: 'city', status: 'soon' });
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
