import { describe, it, expect } from 'vitest';
import { webglAvailable, createFallbackStage, chooseStage } from '../games/city/stage.js';

const fakeEl = () => {
  const note = { textContent: '' };
  return { note, querySelector: (s) => (s === '#stageNote' ? note : null), ownerDocument: { getElementById: (id) => (id === 'stageNote' ? note : null) } };
};
const MSG = '3D view needs WebGL. The reward and receipt still work.';

describe('stage', () => {
  it('chooseStage falls back when webgl is false', () => {
    const el = fakeEl();
    const make3d = () => { throw new Error('must not be called'); };
    const stage = chooseStage(el, {}, { webgl: false, make3d });
    expect(stage.ready).toBe(false);
    expect(el.note.textContent).toBe(MSG);
  });
  it('chooseStage falls back when make3d throws', () => {
    const el = fakeEl();
    const stage = chooseStage(el, {}, { webgl: true, make3d: () => { throw new Error('boom'); } });
    expect(stage.ready).toBe(false);
    expect(el.note.textContent).toBe(MSG);
  });
  it('chooseStage uses make3d when webgl is true and it works', () => {
    const el = fakeEl();
    const mine = { ready: true };
    expect(chooseStage(el, { a: 1 }, { webgl: true, make3d: (e, c) => (e === el && c.a === 1 ? mine : null) })).toBe(mine);
  });
  it("the fallback stage's playTrip calls onDone once and never onFrame", () => {
    const stage = createFallbackStage(fakeEl(), 'x');
    let done = 0, frames = 0;
    stage.playTrip({ track: {}, events: {}, onFrame: () => frames++, onDone: () => done++ });
    expect(done).toBe(1);
    expect(frames).toBe(0);
    expect(() => { stage.setHeat(new Uint32Array(1)); stage.clearRoute(); stage.setChase(true); stage.setShot('chase'); stage.skipTrip(); stage.setMapView(true); stage.destroy(); }).not.toThrow();
  });
  it('playTrip without options does not throw', () => {
    expect(() => createFallbackStage(fakeEl(), 'x').playTrip()).not.toThrow();
    expect(() => createFallbackStage(fakeEl(), 'x').playTrip({})).not.toThrow();
  });
  it("the fallback stage's playRace calls onDone once, never onFrame, and tolerates no options", () => {
    const stage = createFallbackStage(fakeEl(), 'x');
    let frames = 0, done = 0;
    stage.playRace({ race: {}, onFrame: () => frames++, onDone: () => done++ });
    expect([frames, done]).toEqual([0, 1]);
    expect(() => stage.playRace()).not.toThrow();
  });
  it('webglAvailable returns false for an object without createElement', () => {
    expect(webglAvailable({})).toBe(false);
    expect(webglAvailable(undefined)).toBe(false);
  });
  it('webglAvailable returns false when no context can be made', () => {
    expect(webglAvailable({ createElement: () => ({ getContext: () => null }) })).toBe(false);
    expect(webglAvailable({ createElement: () => { throw new Error('x'); } })).toBe(false);
    expect(webglAvailable({ createElement: () => ({ getContext: () => ({}) }) })).toBe(true);
  });
});
