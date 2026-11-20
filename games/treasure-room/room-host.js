// Chooses between the 2D room (always first) and the 3D one (when WebGL and the models are ready), and keeps 2D on any failure.
// No three.js import here: the 3D scene and its models load through `loader`, so a page without WebGL never fetches them.
import { createView2d } from './room-view.js';

// Levels that use 3D by default. ?room=3d turns it on for any level, ?room=2d or ?nowebgl=1 forces 2D.
export const LEVELS_IN_3D = [];

export const roomMode = (search = '') => {
  const v = new URLSearchParams(search).get('room');
  return v === '2d' || v === '3d' ? v : null;
};
export const noWebglFlag = (search = '') => new URLSearchParams(search).get('nowebgl') === '1';
export const debugFlag = (search = '') => new URLSearchParams(search).get('debug') === '1';

// Copied from games/city/stage.js: pages never depend on another game's code.
export function webglAvailable(doc = globalThis.document) {
  try {
    if (!doc || typeof doc.createElement !== 'function') return false;
    return !!doc.createElement('canvas').getContext('webgl');
  } catch { return false; }
}

export function wants3d({ n, search = '', webgl }) {
  if (noWebglFlag(search) || roomMode(search) === '2d' || !webgl) return false;
  return roomMode(search) === '3d' || LEVELS_IN_3D.includes(n);
}

// Both files load together and in parallel; the scene is built only once the models are in.
const loadScene = async () => {
  const [scene, kit] = await Promise.all([import('./room-scene.js'), import('./room-kit.js').then(m => m.loadKit())]);
  return { createScene3d: opts => scene.createScene3d({ ...opts, kit }) };
};

// box: the .room element (it carries data-room); canvas: the 2D canvas inside it.
// Returns { mode, ready, draw, cellAt, redraw, resize, setFocus, setOverlays, destroy }.
export function createRoomHost({
  box, canvas, room, n, search = globalThis.location?.search ?? '', reduceMotion = false,
  loader = loadScene, webgl = webglAvailable, createView = createView2d,
}) {
  const view2d = createView(canvas, room);
  let scene = null, dead = false, last = null, focus = null, overlays = null;
  box.dataset.room = '2d';

  const active = () => scene ?? view2d;
  const to2d = () => {
    box.dataset.room = '2d';
    view2d.show(true);
    view2d.resize();
    if (last) view2d.draw(last);
  };
  const lost = () => {
    if (dead || !scene) return;
    scene.destroy();
    scene = null;
    to2d();
  };

  const ready = (async () => {
    if (!wants3d({ n, search, webgl: typeof webgl === 'function' ? webgl() : webgl })) return '2d';
    let mod;
    try { mod = await loader(); } catch { return '2d'; }
    if (dead) return '2d';
    try { scene = mod.createScene3d({ box, room, reduceMotion, debug: debugFlag(search), onContextLost: lost }); } catch { scene = null; return '2d'; }
    view2d.show(false);
    box.dataset.room = '3d';
    scene.resize();
    if (overlays) scene.setOverlays(overlays);
    if (focus) scene.setFocus(focus);
    if (last) scene.draw(last);
    return '3d';
  })();

  return {
    mode: () => (scene ? '3d' : '2d'),
    ready,
    draw(opts) { if (dead) return; last = opts; active().draw(opts); },
    cellAt: e => active().cellAt(e),
    redraw() { if (!dead && last) active().draw(last); },
    resize() { if (!dead) active().resize(); },
    setFocus(cell) { focus = cell; scene?.setFocus(cell); },
    setOverlays(names) { overlays = names; scene?.setOverlays(names); },
    destroy() {
      if (dead) return;
      dead = true;
      scene?.destroy();
      scene = null;
    },
  };
}
