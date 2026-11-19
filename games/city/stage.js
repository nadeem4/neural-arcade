// Traffic is scene-only: the 3D stage starts other cars from playTrip's events and calls onHonk when one honks at the taxi; the fallback ignores both.
// The Stage interface: { ready, setHeat(visits), playTrip({ track, events, onFrame, onDone, onHonk }), playRace({ race, onFrame, onDone }), clearRoute(), setChase(on), setShot(name), skipTrip(), renderAt(ms), setMapView(on), setInset(px), destroy() }. setInset(px, topPx) slides the picture so the map centre sits in the free area between the top buttons (topPx tall) and a phone bottom sheet of height px.
// scene.js supplies the 3D stage; this file holds the choice between it and the message-only fallback.
export const NO_WEBGL = '3D view needs WebGL. The reward and receipt still work.';

// ?nowebgl=1 forces the fallback, so it can be checked in a browser that has WebGL.
export const noWebglFlag = (search = '') => new URLSearchParams(search).get('nowebgl') === '1';

export function webglAvailable(doc = globalThis.document) {
  try {
    if (!doc || typeof doc.createElement !== 'function') return false;
    return !!doc.createElement('canvas').getContext('webgl');
  } catch { return false; }
}

// ready:false. Writes the message into #stageNote; playTrip calls onDone at once (and never onFrame) so the page carries on.
export function createFallbackStage(el, message) {
  const note = el && el.ownerDocument && el.ownerDocument.getElementById('stageNote');
  if (note) note.textContent = message;
  return {
    ready: false,
    setHeat() {},
    playTrip({ onDone } = {}) { if (onDone) onDone(); },
    playRace({ onDone } = {}) { if (onDone) onDone(); },
    clearRoute() {},
    setChase() {},
    setShot() {},
    skipTrip() {},
    renderAt() { return { phase: 'map', done: true }; },
    setMapView() {},
    setInset() {},
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
