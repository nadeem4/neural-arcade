import { describe, it, expect } from 'vitest';
import { webglAvailable, createFallbackStage, chooseStage, noWebglFlag } from '../games/city/stage.js';

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
    expect(() => { stage.setHeat(new Uint32Array(1)); stage.clearRoute(); stage.setChase(true); stage.setShot('chase'); stage.skipTrip(); stage.setMapView(true); stage.setInset(300); stage.renderAt(0); stage.destroy(); }).not.toThrow();
  });
  it("the fallback stage's renderAt returns the finished map state", () => {
    expect(createFallbackStage(fakeEl(), 'x').renderAt(1234)).toEqual({ phase: 'map', done: true });
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

describe('?nowebgl=1', () => {
  it('is on only for nowebgl=1, whatever else is in the query', () => {
    expect(noWebglFlag('?nowebgl=1')).toBe(true);
    expect(noWebglFlag('?record=1&nowebgl=1')).toBe(true);
    expect(noWebglFlag('?nowebgl=0')).toBe(false);
    expect(noWebglFlag('?nowebgl')).toBe(false);
    expect(noWebglFlag('')).toBe(false);
    expect(noWebglFlag(undefined)).toBe(false);
  });
  it('main.js turns webgl off with it, so chooseStage gives the fallback', async () => {
    const { readFileSync } = await import('node:fs');
    const main = readFileSync(new URL('../games/city/main.js', import.meta.url), 'utf8');
    expect(main).toMatch(/noWebglFlag\(location\.search\)/);
    const el = fakeEl();
    expect(chooseStage(el, {}, { webgl: !noWebglFlag('?nowebgl=1') && true, make3d: () => ({ ready: true }) }).ready).toBe(false);
  });
  it('the end card is built from the trip alone, so the fallback shows the same numbers as the 3D stage', async () => {
    const { readFileSync } = await import('node:fs');
    const main = readFileSync(new URL('../games/city/main.js', import.meta.url), 'utf8');
    const showEnd = main.slice(main.indexOf('function showEnd'), main.indexOf('function finish'));
    expect(showEnd).toMatch(/endCardModel\(t\.rewards, t\.analysis/);
    expect(showEnd).toMatch(/t\.people\.scares\.length/);
    expect(showEnd).not.toMatch(/stage/);
  });
});
