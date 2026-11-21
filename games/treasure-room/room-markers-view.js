// The HTML labels over the 3D room: "Agent (i)" pill and (i) dots, each opening a small card.
// Thin glue over room-markers.js (what opens when) and the scene (which calls update after every frame). Needs a DOM, so it is checked by source guards and in a browser.
import { cardReduce, markerAria } from './room-markers.js';

const CARD_HALF = 120; // half of the card's max width (see .marker-card in treasure-room.css)
const FLIP_BELOW = 130; // an anchor nearer the top than this (css px) opens its card below, not above

// markers: markersFor(n, room); info: MARKER_INFO. Returns { update(project, agentWorld), setShown(bool), destroy() }.
export function createMarkerLayer({ box, markers, info }) {
  const layer = document.createElement('div');
  layer.className = 'marker-layer';
  const ctl = new AbortController(), { signal } = ctl;
  let state = { open: null, pinned: false };

  const items = markers.map(m => {
    const wrap = document.createElement('div');
    wrap.className = `marker-wrap marker-${m.kind}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'marker';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', `card-${m.id}`);
    if (m.kind === 'pill') {
      btn.textContent = `${m.label} ⓘ`;
    } else {
      btn.textContent = 'i';
      btn.setAttribute('aria-label', `About the ${info[m.id].title.replace(/^The /, '')}`);
    }
    const card = document.createElement('div');
    card.className = 'marker-card';
    card.id = `card-${m.id}`;
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', info[m.id].title);
    card.hidden = true;
    const h = document.createElement('strong');
    h.textContent = info[m.id].title;
    const p = document.createElement('p');
    p.textContent = info[m.id].text;
    card.append(h, p);
    wrap.append(btn, card);
    layer.append(wrap);
    return { m, wrap, btn, card };
  });

  const render = () => {
    for (const it of items) {
      it.btn.setAttribute('aria-expanded', markerAria(it.m.id, state)['aria-expanded']);
      it.card.hidden = state.open !== it.m.id;
    }
  };
  const send = e => { state = cardReduce(state, e); render(); };

  for (const it of items) {
    const id = it.m.id;
    it.btn.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') send({ type: 'hover', id }); }, { signal });
    it.btn.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') send({ type: 'leave', id }); }, { signal });
    it.btn.addEventListener('click', () => send({ type: 'click', id }), { signal });
    it.btn.addEventListener('focus', () => send({ type: 'focus', id }), { signal });
    it.btn.addEventListener('blur', () => send({ type: 'blur', id }), { signal });
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.open) send({ type: 'escape' }); }, { signal });
  document.addEventListener('pointerdown', e => { if (state.open && !layer.contains(e.target)) send({ type: 'outside' }); }, { signal });
  box.appendChild(layer);

  return {
    // project(world) gives { x, y, visible } in box css px; agentWorld is the point above the rogue's head, or null while it is hidden.
    update(project, agentWorld) {
      const w = box.clientWidth;
      for (const it of items) {
        const world = it.m.anchor === 'agent' ? agentWorld : it.m.world;
        const p = world && project(world);
        it.wrap.hidden = !p || !p.visible;
        if (it.wrap.hidden) continue;
        it.wrap.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
        if (state.open === it.m.id) {
          it.wrap.dataset.flip = p.y < FLIP_BELOW ? 'below' : 'above';
          const left = Math.min(Math.max(p.x, CARD_HALF + 4), Math.max(w - CARD_HALF - 4, CARD_HALF + 4));
          it.card.style.left = `${(left - p.x).toFixed(1)}px`;
        }
      }
    },
    setShown(on) { layer.hidden = !on; },
    destroy() { ctl.abort(); layer.remove(); },
  };
}
