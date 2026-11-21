// Hosts the 3D room: loads the scene and models, reports load progress, and keeps a last-draw to replay when the scene comes up (or comes back).
// States: 'loading' -> '3d' | 'failed' (reasons: 'no-webgl', 'load', 'scene', 'lost'); retry() starts a new attempt from 'failed'.
// No three.js import here: the 3D scene and its models load through `loader`, so a page without WebGL never fetches them.

export const debugFlag = (search = '') => new URLSearchParams(search).get('debug') === '1';

// Copied from games/city/stage.js: pages never depend on another game's code.
export function webglAvailable(doc = globalThis.document) {
  try {
    if (!doc || typeof doc.createElement !== 'function') return false;
    return !!doc.createElement('canvas').getContext('webgl');
  } catch { return false; }
}

// The scene module and the kit load together and in parallel, once per page: every caller shares the promise, and a failure is
// forgotten so a later mount can retry. The rogue is not shared: loadCharacter() parses its own copy per mount (its bytes download once).
export const shareLoad = fn => {
  let p = null;
  return () => (p ??= fn().catch(e => { p = null; throw e; }));
};

// Load progress, page-wide: the scene module, each of the eight models and the rogue (room-kit.js MODEL_FILES, guarded by a test).
export const LOAD_TOTAL = 10;
const progress = { done: 0, listeners: new Set() };
const notify = () => { for (const fn of [...progress.listeners]) fn(progress.done / LOAD_TOTAL); };
const reportFile = () => { progress.done = Math.min(LOAD_TOTAL, progress.done + 1); notify(); };
export function subscribeProgress(fn) {
  progress.listeners.add(fn);
  fn(progress.done / LOAD_TOTAL);
  return () => { progress.listeners.delete(fn); };
}

const loadSceneFiles = async () => {
  const [scene, kit, ch] = await Promise.all([
    import('./room-scene.js').then(m => { reportFile(); return m; }),
    import('./room-kit.js').then(m => m.loadKit(undefined, reportFile)),
    import('./room-character.js'),
  ]);
  await ch.preloadCharacter(); // the one shared download, so a mount only parses
  reportFile();
  return { loadCharacter: () => ch.loadCharacter(), createScene3d: opts => scene.createScene3d({ ...opts, kit }) };
};
const loadScene = shareLoad(async () => {
  try {
    const r = await loadSceneFiles();
    progress.done = LOAD_TOTAL; // a cached kit reports no files, so a resolve always ends at 1
    notify();
    return r;
  } catch (e) { progress.done = 0; notify(); throw e; }
});

// Starts the scene import and the model downloads early (nav hover). Does nothing without WebGL, so those never fetch three.js.
// Each probe opens a throwaway WebGL context, so warm() asks a given probe only once (it runs on every nav hover).
const probed = new WeakMap();
const probeOnce = webgl => {
  if (typeof webgl !== 'function') return webgl;
  if (!probed.has(webgl)) probed.set(webgl, webgl());
  return probed.get(webgl);
};

// A load that failed while warming is not retried by later hovers (a blocked file would refetch each time); a mount still retries.
const warmFailed = new WeakSet();

export function warm({ webgl = webglAvailable, loader = loadScene } = {}) {
  if (warmFailed.has(loader) || !probeOnce(webgl)) return;
  loader().catch(() => { warmFailed.add(loader); });
}

// box: the .room element (it carries data-room). onState(state, reason?) fires on every change; onProgress(0..1) while loading.
// Returns { mode, ready, retry, draw, cellAt, redraw, resize, setFocus, setOverlays, destroy }; `ready` is the current attempt's promise.
export function createRoomHost({
  box, room, search = globalThis.location?.search ?? '', reduceMotion = false,
  loader = loadScene, webgl = webglAvailable, onState = () => {}, onProgress = () => {}, subscribe = subscribeProgress,
}) {
  let scene = null, dead = false, inFlight = false, state = 'loading', last = null, focus = null, overlays = null;

  const setState = (s, reason) => { state = s; box.dataset.room = s; if (reason) onState(s, reason); else onState(s); };
  const fail = reason => { setState('failed', reason); return 'failed'; };
  const lost = () => {
    if (dead || !scene) return;
    scene.destroy();
    scene = null;
    fail('lost');
  };

  async function run() {
    if (!probeOnce(webgl)) return fail('no-webgl');
    let mod, character;
    try { mod = await loader(); character = await mod.loadCharacter?.(); } catch { return dead ? 'failed' : fail('load'); }
    if (dead) return 'failed';
    try { scene = mod.createScene3d({ box, room, character, reduceMotion, debug: debugFlag(search), onContextLost: lost }); } catch { scene = null; return fail('scene'); }
    scene.resize();
    if (overlays) scene.setOverlays(overlays);
    if (focus) scene.setFocus(focus);
    if (last) scene.draw(last);
    setState('3d');
    return '3d';
  }

  let unsub = () => {};
  async function attempt() {
    inFlight = true;
    let top = 0;
    setState('loading');
    unsub = subscribe(f => { top = Math.max(top, Math.min(1, f)); onProgress(top); });
    try { return await run(); } finally { inFlight = false; unsub(); }
  }

  const host = {
    mode: () => state,
    retry() {
      if (dead || inFlight || state !== 'failed') return;
      host.ready = attempt();
    },
    draw(opts) { if (dead) return; last = opts; scene?.draw(opts); },
    cellAt: e => (scene ? scene.cellAt(e) : null),
    redraw() { if (!dead && last) scene?.draw(last); },
    resize() { if (!dead) scene?.resize(); },
    setFocus(cell) { focus = cell; scene?.setFocus(cell); },
    setOverlays(names) { overlays = names; scene?.setOverlays(names); },
    destroy() {
      if (dead) return;
      dead = true;
      unsub();
      scene?.destroy();
      scene = null;
    },
  };
  host.ready = attempt();
  return host;
}
