// The HTML labels over the 3D room: "Agent (i)" pill and (i) dots, each opening a small card.
// Thin glue over room-markers.js (what opens when) and the scene (which calls update after every frame). Needs a DOM, so it is checked by source guards and in a browser.
import { cardReduce, markerAria } from './room-markers.js';

const GAP = 8;  // between a label and its card
const EDGE = 4; // the card stays this far inside the box
const POINTER = 8; // the pill's pointer, between the pill and the anchor

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
      const i = document.createElement('span');
      i.setAttribute('aria-hidden', 'true');
      i.textContent = 'i';
      btn.append(m.label, i);
      btn.setAttribute('aria-label', `${m.label}: what is this?`);
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
    return { m, wrap, btn, card, at: null };
  });

  // The open card goes to the right of its label (to the left if it would leave the box), top at the label's top, kept inside the box.
  const placeCard = it => {
    if (state.open !== it.m.id || !it.at) return;
    const w = box.clientWidth, h = box.clientHeight, { x, y } = it.at;
    const half = it.btn.offsetWidth / 2, top = it.m.kind === 'pill' ? -(it.btn.offsetHeight + POINTER) : -it.btn.offsetHeight / 2;
    const cw = it.card.offsetWidth, ch = it.card.offsetHeight;
    const right = x + half + GAP + cw <= w - EDGE;
    const left = right ? half + GAP : -(half + GAP + cw);
    const t = Math.min(Math.max(y + top, EDGE), Math.max(h - ch - EDGE, EDGE)) - y;
    it.card.style.left = `${left.toFixed(1)}px`;
    it.card.style.top = `${t.toFixed(1)}px`;
  };
  const render = () => {
    for (const it of items) {
      const open = state.open === it.m.id;
      it.btn.setAttribute('aria-expanded', markerAria(it.m.id, state)['aria-expanded']);
      it.card.hidden = !open;
      it.wrap.toggleAttribute('data-open', open);
      placeCard(it);
    }
  };
  const send = e => { state = cardReduce(state, e); render(); };

  for (const it of items) {
    const id = it.m.id;
    const wrap = it.wrap;
    wrap.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') send({ type: 'hover', id }); }, { signal }); // the wrapper holds the card too, so the mouse can move onto it
    wrap.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') send({ type: 'leave', id }); }, { signal });
    // A pointer click pins the card; Enter or Space (detail 0) only toggles it, and it closes when focus leaves the wrapper.
    it.btn.addEventListener('click', e => send(e.detail === 0 ? (state.open === id ? { type: 'escape' } : { type: 'focus', id }) : { type: 'click', id }), { signal });
    it.btn.addEventListener('focus', () => send({ type: 'focus', id }), { signal });
    wrap.addEventListener('focusout', e => { if (!wrap.contains(e.relatedTarget)) send({ type: 'blur', id }); }, { signal });
  }
  layer.addEventListener('click', e => e.stopPropagation(), { signal }); // a click on a label is not a tap on the room
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.open) send({ type: 'escape' }); }, { signal });
  document.addEventListener('pointerdown', e => { if (state.open && !layer.contains(e.target)) send({ type: 'outside' }); }, { signal });
  box.appendChild(layer);

  return {
    // project(world) gives { x, y, visible } in box css px; agentWorld is the point above the rogue's head, or null while it is hidden.
    update(project, agentWorld) {
      for (const it of items) {
        const world = it.m.anchor === 'agent' ? agentWorld : it.m.world;
        const p = world && project(world);
        it.wrap.hidden = !p || !p.visible;
        it.at = it.wrap.hidden ? null : p;
        if (!it.at) continue;
        it.wrap.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
        placeCard(it);
      }
    },
    setShown(on) { layer.hidden = !on; },
    destroy() { ctl.abort(); layer.remove(); },
  };
}
