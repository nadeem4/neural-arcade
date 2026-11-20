import { describe, it, expect, vi } from 'vitest';
import { ROOM } from '../games/treasure-room/sim.js';
import { createRoomHost, wants3d, roomMode, noWebglFlag, debugFlag, webglAvailable, LEVELS_IN_3D } from '../games/treasure-room/room-host.js';

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return Object.assign(promise, { resolve }); };

function setup(over = {}) {
  const box = { dataset: {} };
  const view2d = { draw: vi.fn(), cellAt: vi.fn(() => ({ x: 9, y: 9 })), resize: vi.fn(), show: vi.fn() };
  const scene = {
    draw: vi.fn(), cellAt: vi.fn(() => ({ x: 1, y: 2 })), resize: vi.fn(), setFocus: vi.fn(), setOverlays: vi.fn(), destroy: vi.fn(),
  };
  const ctx = { lost: null };
  const createScene3d = vi.fn(opts => { ctx.lost = opts.onContextLost; ctx.opts = opts; return scene; });
  const base = {
    box, canvas: {}, room: ROOM, n: 5, search: '?room=3d', reduceMotion: false, webgl: () => true,
    createView: () => view2d, loader: () => Promise.resolve({ createScene3d }), ...over,
  };
  return { box, view2d, scene, ctx, createScene3d, base, host: createRoomHost(base) };
}

describe('flags', () => {
  it('reads the query string', () => {
    expect(roomMode('?room=x')).toBeNull();
    expect(roomMode('?room=3d')).toBe('3d');
    expect(roomMode('?room=2d')).toBe('2d');
    expect(noWebglFlag('?nowebgl=1')).toBe(true);
    expect(noWebglFlag('')).toBe(false);
    expect(debugFlag('?debug=1')).toBe(true);
    expect(debugFlag('')).toBe(false);
  });
  it('webglAvailable is false without a document and when the context is refused', () => {
    expect(webglAvailable(null)).toBe(false);
    expect(webglAvailable({ createElement: () => ({ getContext: () => null }) })).toBe(false);
    expect(webglAvailable({ createElement: () => ({ getContext: () => ({}) }) })).toBe(true);
    expect(webglAvailable({ createElement: () => { throw new Error('x'); } })).toBe(false);
  });
});

describe('probe context', () => {
  it('is opened only when the flags want 3D', async () => {
    for (const search of ['', '?room=2d']) {
      const webgl = vi.fn(() => true);
      await setup({ search, webgl }).host.ready;
      expect(webgl, search).not.toHaveBeenCalled();
    }
    const webgl = vi.fn(() => true);
    await setup({ search: '?room=3d', webgl }).host.ready;
    expect(webgl).toHaveBeenCalledTimes(1);
  });
});

describe('wants3d', () => {
  it('needs WebGL, and a level in LEVELS_IN_3D or ?room=3d', () => {
    expect(LEVELS_IN_3D).toEqual([]);
    expect(wants3d({ n: 5, search: '', webgl: true })).toBe(false);
    expect(wants3d({ n: 5, search: '?room=3d', webgl: true })).toBe(true);
    expect(wants3d({ n: 5, search: '?room=3d', webgl: false })).toBe(false);
    expect(wants3d({ n: 1, search: '?room=3d&nowebgl=1', webgl: true })).toBe(false);
    expect(wants3d({ n: 1, search: '?room=2d', webgl: true })).toBe(false);
  });
});

describe('createRoomHost', () => {
  it('shows 2D first, then 3D replaces it and the last draw is replayed', async () => {
    const { host, box, view2d, scene } = setup();
    host.draw({ agent: { x: 1, y: 1 } });
    expect(host.mode()).toBe('2d');
    expect(view2d.draw).toHaveBeenCalledTimes(1);
    expect(box.dataset.room).toBe('2d');
    expect(await host.ready).toBe('3d');
    expect(host.mode()).toBe('3d');
    expect(scene.draw).toHaveBeenCalledWith({ agent: { x: 1, y: 1 } });
    expect(view2d.show).toHaveBeenLastCalledWith(false);
    expect(box.dataset.room).toBe('3d');
    host.draw({ agent: { x: 2, y: 1 } });
    expect(scene.draw).toHaveBeenLastCalledWith({ agent: { x: 2, y: 1 } });
    expect(view2d.draw).toHaveBeenCalledTimes(1);
  });
  it('hands the scene its inputs, and remembers overlays and focus for it', async () => {
    const { host, createScene3d, scene } = setup({ search: '?room=3d&debug=1', reduceMotion: true });
    host.setOverlays(['values']);
    host.setFocus({ x: 1, y: 1 });
    await host.ready;
    expect(createScene3d).toHaveBeenCalledWith(expect.objectContaining({ room: ROOM, reduceMotion: true, debug: true, onContextLost: expect.any(Function) }));
    expect(scene.setOverlays).toHaveBeenCalledWith(['values']);
    expect(scene.setFocus).toHaveBeenCalledWith({ x: 1, y: 1 });
    host.resize();
    expect(scene.resize).toHaveBeenCalled();
  });
  it('stays 2D when 3D is not wanted, and never loads', async () => {
    for (const over of [{ search: '' }, { search: '?room=2d' }, { search: '?room=3d&nowebgl=1' }, { webgl: () => false }]) {
      const loader = vi.fn();
      const { host, box } = setup({ ...over, loader });
      expect(await host.ready).toBe('2d');
      expect(loader).not.toHaveBeenCalled();
      expect(box.dataset.room).toBe('2d');
    }
  });
  it('stays 2D and keeps working when loading fails or the scene cannot be built', async () => {
    for (const over of [{ loader: () => Promise.reject(new Error('404')) }, { loader: () => Promise.resolve({ createScene3d: () => { throw new Error('gl'); } }) }]) {
      const { host, box, view2d } = setup(over);
      expect(await host.ready).toBe('2d');
      host.draw({});
      expect(view2d.draw).toHaveBeenCalled();
      expect(box.dataset.room).toBe('2d');
    }
  });
  it('builds no scene when destroyed before the models arrive', async () => {
    const later = deferred();
    let built = 0;
    const { host } = setup({ loader: () => later.then(() => ({ createScene3d: () => { built++; return {}; } })) });
    host.destroy();
    later.resolve();
    await host.ready;
    expect(built).toBe(0);
  });
  it('goes back to 2D with the same state when the context is lost', async () => {
    const { host, view2d, scene, ctx, box } = setup();
    host.draw({ agent: { x: 1, y: 1 } });
    await host.ready;
    ctx.lost();
    expect(host.mode()).toBe('2d');
    expect(box.dataset.room).toBe('2d');
    expect(view2d.show).toHaveBeenLastCalledWith(true);
    expect(scene.destroy).toHaveBeenCalled();
    expect(view2d.draw).toHaveBeenLastCalledWith({ agent: { x: 1, y: 1 } });
    ctx.lost(); // a second loss is ignored
    expect(scene.destroy).toHaveBeenCalledTimes(1);
  });
  it('cellAt follows the active backend', async () => {
    const { host, view2d, scene } = setup();
    expect(host.cellAt({ clientX: 1, clientY: 1 })).toEqual({ x: 9, y: 9 });
    expect(view2d.cellAt).toHaveBeenCalled();
    await host.ready;
    expect(host.cellAt({ clientX: 1, clientY: 1 })).toEqual({ x: 1, y: 2 });
    expect(scene.cellAt).toHaveBeenCalled();
  });
  it('destroy tears the scene down and later calls do nothing', async () => {
    const { host, scene } = setup();
    await host.ready;
    host.destroy();
    expect(scene.destroy).toHaveBeenCalledTimes(1);
    scene.draw.mockClear();
    host.draw({});
    expect(scene.draw).not.toHaveBeenCalled();
    host.destroy();
    expect(scene.destroy).toHaveBeenCalledTimes(1);
  });
});
