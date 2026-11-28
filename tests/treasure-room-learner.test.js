import { describe, it, expect } from 'vitest';
import { learn } from '../games/treasure-room/learner.js';
import { ROOM, START } from '../games/treasure-room/sim.js';

describe('the room learner', () => {
  const run = learn();
  it('its greedy last try reaches the treasure in 6 steps for +5', () => {
    const { path, score } = run.last;
    expect(path[0]).toEqual(START);
    expect(path).toHaveLength(7);
    const end = path.at(-1);
    expect(ROOM.cells[end.y][end.x]).toBe('T');
    expect(score).toBe(5);
  });
  it('is the same on every call', () => {
    expect(learn()).toEqual(run);
  });
});
