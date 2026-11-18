import { describe, it, expect } from 'vitest';
import { ROOM } from '../games/treasure-room/sim.js';
import { cellAt, drawRoom, tagTone } from '../games/treasure-room/room-view.js';

const stub = () => {
  const calls = {};
  return new Proxy({}, {
    get: (_, k) => (k === 'calls' ? calls : (...a) => { (calls[k] ??= []).push(a); }),
    set: () => true,
  });
};

describe('treasure room view helpers', () => {
  it('maps a canvas pixel to a cell', () => {
    expect(cellAt(300, ROOM, 10, 10)).toEqual({ x: 0, y: 0 });
    expect(cellAt(300, ROOM, 3.5 * 60, 2.5 * 60)).toEqual({ x: 3, y: 2 });
    expect(cellAt(300, ROOM, 299, 299)).toEqual({ x: 4, y: 4 });
  });
  it('returns null outside the canvas', () => {
    expect(cellAt(300, ROOM, -1, 10)).toBeNull();
    expect(cellAt(300, ROOM, 10, 300)).toBeNull();
  });
  it('tones a reward good, bad or step', () => {
    expect(tagTone(10)).toBe('good');
    expect(tagTone(-10)).toBe('bad');
    expect(tagTone(-1)).toBe('step');
  });
  it('draws the room with no options, and the agent as one circle', () => {
    const a = stub();
    drawRoom(a, ROOM);
    expect(a.calls.fillRect.length).toBeGreaterThanOrEqual(25);
    expect(a.calls.arc).toBeUndefined();
    const b = stub();
    drawRoom(b, ROOM, { cell: 60, agent: { x: 1, y: 1 }, tags: [{ x: 1, y: 1, text: '−1', tone: 'step' }] });
    expect(b.calls.arc).toHaveLength(1);
    expect(b.calls.fillText.some(c => c[0] === '−1')).toBe(true);
  });
});
