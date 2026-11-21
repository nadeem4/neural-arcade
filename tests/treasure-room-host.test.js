import { describe, it, expect, vi } from 'vitest';
import { ROOM } from '../games/treasure-room/sim.js';
import { createRoomHost, debugFlag, webglAvailable, warm, shareLoad, subscribeProgress, LOAD_TOTAL } from '../games/treasure-room/room-host.js';

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return Object.assign(promise, { resolve }); };

function setup(over = {}) {
  const box = { dataset: {} };
  const scenes = [];
  const ctx = { lost: null };
  const createScene3d = vi.fn(opts => {
    ctx.lost = opts.onContextLost;
    const s = { draw: vi.fn(), cellAt: vi.fn(() => ({ x: 1, y: 2 })), resize: vi.fn(), setFocus: vi.fn(), setOverlays: vi.fn(), destroy: vi.fn() };
    scenes.push(s);
    return s;
  });
  const states = [], progress = [];
  const base = {
    box, room: ROOM, search: '', reduceMotion: false, webgl: () => true,
    loader: vi.fn(() => Promise.resolve({ createScene3d })),
    onState: (...a) => states.push(a), onProgress: f => progress.push(f), subscribe: () => () => {}, ...over,
  };
  const host = createRoomHost(base);
  return { box, scenes, ctx, createScene3d, host, states, progress, loader: base.loader };
}

describe('flags', () => {
  it('reads the debug flag', () => {
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

describe('createRoomHost', () => {
  it('starts in loading and 3D replaces it, replaying the last draw', async () => {
    const { host, box, scenes, states } = setup();
    host.draw({ agent: { x: 1, y: 1 } });
    expect(host.mode()).toBe('loading');
    expect(box.dataset.room).toBe('loading');
    expect(states[0]).toEqual(['loading']);
    expect(await host.ready).toBe('3d');
    expect(host.mode()).toBe('3d');
    expect(box.dataset.room).toBe('3d');
    expect(states.at(-1)).toEqual(['3d']);
    expect(scenes[0].draw).toHaveBeenCalledWith({ agent: { x: 1, y: 1 } });
    host.draw({ agent: { x: 2, y: 1 } });
    expect(scenes[0].draw).toHaveBeenLastCalledWith({ agent: { x: 2, y: 1 } });
  });
  it('hands the scene its inputs and remembers overlays and focus', async () => {
    const { host, createScene3d, scenes } = setup({ search: '?debug=1', reduceMotion: true });
    host.setOverlays(['values']);
    host.setFocus({ x: 1, y: 1 });
    await host.ready;
    expect(createScene3d).toHaveBeenCalledWith(expect.objectContaining({ room: ROOM, reduceMotion: true, debug: true, onContextLost: expect.any(Function) }));
    expect(scenes[0].setOverlays).toHaveBeenCalledWith(['values']);
    expect(scenes[0].setFocus).toHaveBeenCalledWith({ x: 1, y: 1 });
    host.resize();
    expect(scenes[0].resize).toHaveBeenCalled();
  });
  it('no WebGL fails fast and never loads', async () => {
    const loader = vi.fn();
    const { host, box, states } = setup({ webgl: () => false, loader });
    expect(await host.ready).toBe('failed');
    expect(loader).not.toHaveBeenCalled();
    expect(states.at(-1)).toEqual(['failed', 'no-webgl']);
    expect(box.dataset.room).toBe('failed');
  });
  it('a load error fails with reason load', async () => {
    const { host, states } = setup({ loader: () => Promise.reject(new Error('404')) });
    expect(await host.ready).toBe('failed');
    expect(states.at(-1)).toEqual(['failed', 'load']);
    expect(() => host.draw({})).not.toThrow();
  });
  it('loadCharacter rejection fails with reason load', async () => {
    const loader = () => Promise.resolve({ loadCharacter: () => Promise.reject(new Error('bad glb')), createScene3d: () => ({}) });
    const { host, states } = setup({ loader });
    expect(await host.ready).toBe('failed');
    expect(states.at(-1)).toEqual(['failed', 'load']);
  });
  it('a scene that throws fails with reason scene', async () => {
    const { host, states } = setup({ loader: () => Promise.resolve({ createScene3d: () => { throw new Error('gl'); } }) });
    expect(await host.ready).toBe('failed');
    expect(states.at(-1)).toEqual(['failed', 'scene']);
  });
  it('context lost after 3D fails with reason lost and destroys the scene once', async () => {
    const { host, scenes, ctx, states, box } = setup();
    await host.ready;
    ctx.lost();
    ctx.lost();
    expect(scenes[0].destroy).toHaveBeenCalledTimes(1);
    expect(host.mode()).toBe('failed');
    expect(box.dataset.room).toBe('failed');
    expect(states.at(-1)).toEqual(['failed', 'lost']);
  });
  it('retry after a failure loads again and replays state', async () => {
    let calls = 0;
    const scene = { draw: vi.fn(), resize: vi.fn(), setFocus: vi.fn(), setOverlays: vi.fn(), destroy: vi.fn() };
    const createScene3d = vi.fn(() => scene);
    const loader = vi.fn(() => (calls++ ? Promise.resolve({ createScene3d }) : Promise.reject(new Error('x'))));
    const { host, states } = setup({ loader });
    const c = { x: 1, y: 1 };
    host.draw({ a: 1 });
    host.setOverlays(['values']);
    host.setFocus(c);
    expect(await host.ready).toBe('failed');
    host.retry();
    expect(await host.ready).toBe('3d');
    expect(loader).toHaveBeenCalledTimes(2);
    expect(scene.draw).toHaveBeenCalledWith({ a: 1 });
    expect(scene.setOverlays).toHaveBeenCalledWith(['values']);
    expect(scene.setFocus).toHaveBeenCalledWith(c);
    expect(states.filter(s => s[0] === 'loading')).toHaveLength(2);
  });
  it('retry after context lost builds a fresh scene', async () => {
    const { host, ctx, scenes, createScene3d } = setup();
    host.draw({ a: 1 });
    await host.ready;
    ctx.lost();
    host.retry();
    expect(await host.ready).toBe('3d');
    expect(createScene3d).toHaveBeenCalledTimes(2);
    expect(scenes[1].draw).toHaveBeenCalledWith({ a: 1 });
  });
  it('retry twice quickly runs one load', async () => {
    let calls = 0;
    const loader = vi.fn(() => (calls++ ? Promise.resolve({ createScene3d: () => ({ resize() {}, destroy() {} }) }) : Promise.reject(new Error('x'))));
    const { host } = setup({ loader });
    await host.ready;
    host.retry();
    host.retry();
    await host.ready;
    expect(loader).toHaveBeenCalledTimes(2);
  });
  it('retry is a no-op while 3D is up', async () => {
    const { host, loader } = setup();
    await host.ready;
    host.retry();
    expect(loader).toHaveBeenCalledTimes(1);
  });
  it('builds no scene when destroyed during loading, and no retry after destroy', async () => {
    const later = deferred();
    let built = 0;
    const loader = vi.fn(() => later.then(() => ({ createScene3d: () => { built++; return {}; } })));
    const { host } = setup({ loader });
    host.destroy();
    later.resolve();
    await host.ready;
    expect(built).toBe(0);
    host.retry();
    expect(loader).toHaveBeenCalledTimes(1);
  });
  it('cellAt is null until 3D, then follows the scene', async () => {
    const { host } = setup();
    expect(host.cellAt({ clientX: 1, clientY: 1 })).toBeNull();
    await host.ready;
    expect(host.cellAt({ clientX: 1, clientY: 1 })).toEqual({ x: 1, y: 2 });
  });
  it('progress comes from the subscription and is clamped and monotonic', () => {
    const unsub = vi.fn();
    const { progress, host } = setup({ subscribe: fn => { fn(0.2); fn(0.1); fn(1.4); return unsub; } });
    expect(progress).toEqual([0.2, 0.2, 1]);
    host.destroy();
    expect(unsub).toHaveBeenCalled();
  });
  it('destroy tears the scene down and later calls do nothing', async () => {
    const { host, scenes } = setup();
    await host.ready;
    host.destroy();
    expect(scenes[0].destroy).toHaveBeenCalledTimes(1);
    scenes[0].draw.mockClear();
    host.draw({});
    expect(scenes[0].draw).not.toHaveBeenCalled();
    host.destroy();
    expect(scenes[0].destroy).toHaveBeenCalledTimes(1);
  });
});

describe('subscribeProgress', () => {
  it('replays the current fraction and unsubscribes', () => {
    const seen = [];
    const off = subscribeProgress(f => seen.push(f));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeGreaterThanOrEqual(0);
    expect(typeof off).toBe('function');
    off();
    expect(LOAD_TOTAL).toBe(10);
  });
});

describe('each mount has its own rogue', () => {
  it('loads a fresh character per mount through one shared loader, and hands it to the scene', async () => {
    let parsed = 0;
    const loadCharacter = vi.fn(async () => ({ id: ++parsed }));
    const seen = [];
    const loader = () => Promise.resolve({ loadCharacter, createScene3d: opts => { seen.push(opts.character); return { resize() {}, draw() {}, destroy() {} }; } });
    await setup({ loader }).host.ready;
    await setup({ loader }).host.ready;
    expect(loadCharacter).toHaveBeenCalledTimes(2);
    expect(seen).toEqual([{ id: 1 }, { id: 2 }]);
    expect(seen[0]).not.toBe(seen[1]);
  });
  it('probes WebGL once for a mount', async () => {
    const webgl = vi.fn(() => true);
    await setup({ webgl }).host.ready;
    await setup({ webgl }).host.ready;
    expect(webgl).toHaveBeenCalledTimes(1);
  });
});

describe('warm and shared loading', () => {
  it('warm does not retry a failed load on later calls', async () => {
    const loader = vi.fn(() => Promise.reject(new Error('blocked')));
    warm({ webgl: () => true, loader });
    await new Promise(r => setTimeout(r, 0));
    warm({ webgl: () => true, loader });
    expect(loader).toHaveBeenCalledTimes(1);
  });
  it('warm starts the loader once per call, and never without WebGL', () => {
    const loader = vi.fn(() => Promise.resolve({}));
    warm({ webgl: () => true, loader });
    expect(loader).toHaveBeenCalledTimes(1);
    warm({ webgl: () => false, loader });
    expect(loader).toHaveBeenCalledTimes(1);
  });
  it('warm probes WebGL once per probe, however often it is called', () => {
    const webgl = vi.fn(() => true), loader = vi.fn(() => Promise.resolve({}));
    warm({ webgl, loader });
    warm({ webgl, loader });
    expect(webgl).toHaveBeenCalledTimes(1);
    expect(loader).toHaveBeenCalledTimes(2);
  });
  it('warm swallows a failed load', () => {
    expect(() => warm({ webgl: () => true, loader: () => Promise.reject(new Error('x')) })).not.toThrow();
  });
  it('shareLoad runs the load once for every caller and forgets a failure', async () => {
    let calls = 0;
    const load = shareLoad(() => { calls++; return Promise.resolve({ ok: 1 }); });
    const [a, b] = await Promise.all([load(), load()]);
    expect(a).toBe(b);
    expect(calls).toBe(1);
    let fails = 0;
    const flaky = shareLoad(() => (fails++ ? Promise.resolve('ok') : Promise.reject(new Error('x'))));
    await expect(flaky()).rejects.toThrow();
    expect(await flaky()).toBe('ok');
  });
});
