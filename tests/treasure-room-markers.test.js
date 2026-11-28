import { describe, it, expect } from 'vitest';
import { ROOM, REWARD } from '../games/treasure-room/sim.js';
import { cellToWorld } from '../games/treasure-room/room-math.js';
import { MARKER_INFO } from '../games/treasure-room/words.js';
import { projectPoint, MARKERS_FOR_LEVEL, markersFor, AGENT_HEAD_Y, cardReduce, markerAria } from '../games/treasure-room/room-markers.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
// Perspective-like: clip w = -z, so points in front of a camera looking down -z have w > 0 when z < 0.
const P = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1, 0, 0, 0, 0];

describe('projectPoint', () => {
  it('puts the origin at the middle of the box', () => {
    expect(projectPoint(I, [0, 0, 0], 800, 500)).toEqual({ x: 400, y: 250, visible: true });
  });
  it('flips y: up on screen is a smaller css y', () => {
    expect(projectPoint(I, [0, 0.5, 0], 800, 500).y).toBeLessThan(250);
    expect(projectPoint(I, [0.5, 0, 0], 800, 500).x).toBeGreaterThan(400);
  });
  it('hides points behind the camera and outside the view', () => {
    expect(projectPoint(P, [0, 0, 1], 800, 500).visible).toBe(false);
    expect(projectPoint(P, [0, 0, -1], 800, 500).visible).toBe(true);
    expect(projectPoint(I, [2, 0, 0], 800, 500).visible).toBe(false);
  });
  it('pad hides a point whose label would be cut by the edge', () => {
    expect(projectPoint(I, [0.95, 0, 0], 800, 500, 0).visible).toBe(true);
    expect(projectPoint(I, [0.95, 0, 0], 800, 500, 40).visible).toBe(false);
  });
});

describe('level 1 markers', () => {
  it('has the agent pill, the treasure dot and the pit dot, and no other level has any', () => {
    expect(MARKERS_FOR_LEVEL.loop.map(m => [m.id, m.kind])).toEqual([['agent', 'pill'], ['treasure', 'dot'], ['pit', 'dot']]);
    expect(MARKERS_FOR_LEVEL.loop[0].label).toBe('Agent');
    for (const id of ['state', 'return', 'policy', 'value', 'mdp']) expect(markersFor(id, ROOM)).toEqual([]);
  });
  it('anchors the dots above the treasure and pit cells and the pill to the agent', () => {
    const list = markersFor('loop', ROOM), by = id => list.find(m => m.id === id);
    for (const [id, ch] of [['treasure', 'T'], ['pit', 'X']]) {
      let c; ROOM.cells.forEach((row, y) => { const x = [...row].indexOf(ch); if (x >= 0) c = { x, y }; });
      const w = cellToWorld(ROOM, c.x, c.y);
      expect(by(id).world[0]).toBeCloseTo(w.x);
      expect(by(id).world[2]).toBeCloseTo(w.z);
      expect(by(id).world[1]).toBeGreaterThan(0);
    }
    expect(by('agent').anchor).toBe('agent');
    expect(AGENT_HEAD_Y).toBeGreaterThan(0);
  });
  it('every marker has a card with a title and text built from the rewards', () => {
    for (const m of MARKERS_FOR_LEVEL.loop) {
      expect(MARKER_INFO[m.id].title.length).toBeGreaterThan(0);
      expect(MARKER_INFO[m.id].text.length).toBeGreaterThan(0);
    }
    expect(MARKER_INFO.treasure.text).toContain(String(REWARD.treasure));
    expect(MARKER_INFO.pit.text).toContain(String(Math.abs(REWARD.pit)));
    expect(MARKER_INFO.pit.text).toContain('−');
  });
});

describe('cardReduce', () => {
  const closed = { open: null, pinned: false };
  const step = (s, ...evs) => evs.reduce((st, e) => cardReduce(st, e), s);
  it('hover opens unpinned and leave closes it', () => {
    expect(step(closed, { type: 'hover', id: 'a' })).toEqual({ open: 'a', pinned: false });
    expect(step(closed, { type: 'hover', id: 'a' }, { type: 'leave', id: 'a' })).toEqual(closed);
  });
  it('click pins; a pinned card ignores leave and a second click closes it', () => {
    const pinned = step(closed, { type: 'hover', id: 'a' }, { type: 'click', id: 'a' });
    expect(pinned).toEqual({ open: 'a', pinned: true });
    expect(cardReduce(pinned, { type: 'leave', id: 'a' })).toEqual(pinned);
    expect(cardReduce(pinned, { type: 'click', id: 'a' })).toEqual(closed);
    expect(step(closed, { type: 'click', id: 'a' })).toEqual({ open: 'a', pinned: true });
  });
  it('focus opens, blur closes only if unpinned', () => {
    expect(step(closed, { type: 'focus', id: 'a' })).toEqual({ open: 'a', pinned: false });
    expect(step(closed, { type: 'focus', id: 'a' }, { type: 'blur', id: 'a' })).toEqual(closed);
    expect(step(closed, { type: 'click', id: 'a' }, { type: 'blur', id: 'a' })).toEqual({ open: 'a', pinned: true });
  });
  it('escape and outside close and unpin', () => {
    const pinned = step(closed, { type: 'click', id: 'a' });
    expect(cardReduce(pinned, { type: 'escape' })).toEqual(closed);
    expect(cardReduce(pinned, { type: 'outside' })).toEqual(closed);
  });
  it('opening one marker closes the other, and a stale leave does nothing', () => {
    const s = step(closed, { type: 'click', id: 'a' }, { type: 'hover', id: 'b' });
    expect(s.open).toBe('b');
    expect(cardReduce({ open: 'b', pinned: false }, { type: 'leave', id: 'a' })).toEqual({ open: 'b', pinned: false });
  });
  it('markerAria reports expanded for the open marker only', () => {
    expect(markerAria('a', { open: 'a', pinned: false })).toEqual({ 'aria-expanded': 'true' });
    expect(markerAria('b', { open: 'a', pinned: false })).toEqual({ 'aria-expanded': 'false' });
  });
});
