// The Stage interface: { ready, setHeat(visits), showRoute(route, analysis, { onDone }), clearRoute(), setChase(on), destroy() }.
// RC3 and RC4 supply the 3D stage; this file holds the choice between it and the message-only fallback.
export const NO_WEBGL = '3D view needs WebGL. The pay slip and receipt still work.';

export function webglAvailable(doc = globalThis.document) {
  try {
    if (!doc || typeof doc.createElement !== 'function') return false;
    return !!doc.createElement('canvas').getContext('webgl');
  } catch { return false; }
}

// ready:false. Writes the message into #stageNote; showRoute calls onDone at once so the page carries on.
export function createFallbackStage(el, message) {
  const note = el && el.ownerDocument && el.ownerDocument.getElementById('stageNote');
  if (note) note.textContent = message;
  return {
    ready: false,
    setHeat() {},
    showRoute(route, analysis, { onDone } = {}) { if (onDone) onDone(); },
    clearRoute() {},
    setChase() {},
    destroy() {},
  };
}

export function chooseStage(el, city, { webgl, make3d }) {
  if (webgl) {
    try {
      const stage = make3d(el, city);
      if (stage) return stage;
    } catch { /* fall through to the message */ }
  }
  return createFallbackStage(el, NO_WEBGL);
}
