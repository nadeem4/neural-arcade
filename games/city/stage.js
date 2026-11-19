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

// Map point (x, z = -map y) to a pixel in a w x h box with `pad` kept clear, one scale for both axes, north up.
export function routePlot(frames, w, h, pad = 24) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const f of frames) { x0 = Math.min(x0, f.x); x1 = Math.max(x1, f.x); z0 = Math.min(z0, f.z); z1 = Math.max(z1, f.z); }
  const k = Math.min((w - 2 * pad) / Math.max(1, x1 - x0), (h - 2 * pad) / Math.max(1, z1 - z0));
  const ox = (w - k * (x1 - x0)) / 2, oy = (h - k * (z1 - z0)) / 2;
  return (x, z) => [ox + k * (x - x0), oy + k * (z - z0)];
}

// The no-WebGL trip: the route as a line and the taxi as a dot on a flat canvas (at most 12 s), then onDone.
function drawTrip(el, track, onDone) {
  const doc = el && el.ownerDocument, cv = doc && doc.createElement && doc.createElement('canvas');
  const ctx = cv && cv.getContext && cv.getContext('2d');
  if (!ctx || !track || !track.frames || !track.frames.length) { if (onDone) onDone(); return; }
  const w = cv.width = Math.max(1, el.clientWidth), h = cv.height = Math.max(1, el.clientHeight);
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  el.appendChild(cv);
  const plot = routePlot(track.frames, w, h), n = track.frames.length, t0 = performance.now();
  const step = (now) => {
    const u = Math.max(0, Math.min(1, (now - t0) / Math.min(track.total || 12000, 12000))), upto = Math.floor(u * (n - 1));
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 3; ctx.strokeStyle = '#4fc3f7'; ctx.beginPath();
    for (let i = 0; i <= upto; i++) { const [px, py] = plot(track.frames[i].x, track.frames[i].z); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.stroke();
    const [dx, dy] = plot(track.frames[upto].x, track.frames[upto].z);
    ctx.fillStyle = '#f5b921'; ctx.beginPath(); ctx.arc(dx, dy, 7, 0, 6.2832); ctx.fill();
    if (u < 1) requestAnimationFrame(step); else { cv.remove(); if (onDone) onDone(); }
  };
  requestAnimationFrame(step);
}

// ready:false. Writes the message into #stageNote; playTrip draws the route as a line with a moving taxi dot (never onFrame), then calls onDone.
export function createFallbackStage(el, message) {
  const note = el && el.ownerDocument && el.ownerDocument.getElementById('stageNote');
  if (note) note.textContent = message;
  return {
    ready: false,
    setHeat() {},
    playTrip({ track, onDone } = {}) { drawTrip(el, track, onDone); },
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
