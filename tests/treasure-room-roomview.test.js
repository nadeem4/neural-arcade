import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ROOM } from '../games/treasure-room/sim.js';
import { cellAt, drawRoom, tagTone, createView2d } from '../games/treasure-room/room-view.js';

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
  it('draws a ghost route as a line, a shrunk treasure as one circle, and marks as extra outlines', () => {
    const base = stub();
    drawRoom(base, ROOM, { cell: 60 });
    const a = stub();
    drawRoom(a, ROOM, { cell: 60, ghost: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }] });
    expect(a.calls.lineTo).toHaveLength(2);
    const b = stub();
    drawRoom(b, ROOM, { cell: 60, treasureScale: 0.5 });
    expect(b.calls.arc).toHaveLength(1);
    const c = stub();
    drawRoom(c, ROOM, { cell: 60, marks: [{ x: 1, y: 1 }, { x: 2, y: 1 }] });
    expect(c.calls.strokeRect.length - base.calls.strokeRect.length).toBe(2);
  });
  it('draws heat as one tint per floor tile that has any, an icy sheen on every floor tile, and two ghost routes as two lines', () => {
    const base = stub();
    drawRoom(base, ROOM, { cell: 60 });
    const heat = new Array(25).fill(0);
    heat[0] = 1; heat[1] = 0.5;
    const a = stub();
    drawRoom(a, ROOM, { cell: 60, heat });
    expect(a.calls.fillRect.length - base.calls.fillRect.length).toBe(2);
    const floor = ROOM.cells.flat().filter(c => !'TX#'.includes(c)).length;
    const b = stub();
    drawRoom(b, ROOM, { cell: 60, ice: true });
    expect(b.calls.fillRect.length - base.calls.fillRect.length).toBe(floor);
    const p = [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }];
    const c = stub();
    drawRoom(c, ROOM, { cell: 60, ghost: [p, p] });
    expect(c.calls.lineTo).toHaveLength(4);
  });
});

describe('createView2d', () => {
  const canvasStub = () => {
    const ctx = stub();
    return { ctx, style: {}, clientWidth: 300, width: 0, height: 0, getContext: () => ctx, getBoundingClientRect: () => ({ left: 10, top: 20, width: 300 }) };
  };
  it('sizes the canvas, draws the room and finds the cell under a pointer', () => {
    const cv = canvasStub();
    globalThis.window = { devicePixelRatio: 2 };
    const v = createView2d(cv, ROOM);
    v.resize();
    expect(cv.width).toBe(600);
    v.draw({ agent: { x: 1, y: 1 } });
    expect(cv.ctx.calls.setTransform[0]).toEqual([2, 0, 0, 2, 0, 0]);
    expect(cv.ctx.calls.arc).toHaveLength(1);
    expect(v.cellAt({ clientX: 10 + 3.5 * 60, clientY: 20 + 2.5 * 60 })).toEqual({ x: 3, y: 2 });
    delete globalThis.window;
  });
  it('hides and shows its canvas', () => {
    const v = createView2d(canvasStub(), ROOM);
    const cv = canvasStub();
    const w = createView2d(cv, ROOM);
    w.show(false);
    expect(cv.style.display).toBe('none');
    w.show(true);
    expect(cv.style.display).toBe('');
    expect(v).toBeTruthy();
  });
  it('never loads three.js', () => {
    expect(readFileSync(new URL('../games/treasure-room/room-view.js', import.meta.url), 'utf8')).not.toMatch(/from\s+['"][^'"]*three/);
  });
});
