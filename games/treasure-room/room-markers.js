// Labels over the 3D room (pure): where each label sits, where a world point lands on screen, and when its card is open.
// The DOM that draws them is room-markers-view.js; the card texts are MARKER_INFO in words.js.
import { cellToWorld } from './room-math.js';

export const AGENT_HEAD_Y = 1.35; // above the rogue's feet: the pill's pointer tip sits just over the head
const DOT_Y = 0.9;                // above the chest and the pit

// The one place a level gets labels. An entry is { id, kind: 'pill' | 'dot', label?, cell?: grid char, anchor?: 'agent' }.
export const MARKERS_FOR_LEVEL = {
  agent: [
    { id: 'agent', kind: 'pill', label: 'Agent', anchor: 'agent' },
    { id: 'treasure', kind: 'dot', cell: 'T' },
    { id: 'pit', kind: 'dot', cell: 'X' },
  ],
};

// The level's markers; a cell marker gets its world position from the grid, an agent marker is placed by the scene each frame.
export function markersFor(id, room) {
  return (MARKERS_FOR_LEVEL[id] ?? []).map(m => {
    if (!m.cell) return { ...m };
    for (let y = 0; y < room.h; y++) {
      const x = room.cells[y].indexOf(m.cell);
      if (x >= 0) { const w = cellToWorld(room, x, y); return { ...m, world: [w.x, DOT_Y, w.z] }; }
    }
    return { ...m, world: null };
  });
}

// World point to css pixels in a w x h box. m is projection * view (column-major, THREE Matrix4.elements).
// visible is false behind the camera or when the point is within `pad` css px of (or beyond) the box edge.
export function projectPoint(m, [x, y, z], w, h, pad = 0) {
  const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  const nx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / cw;
  const ny = (m[1] * x + m[5] * y + m[9] * z + m[13]) / cw;
  const px = (nx + 1) / 2 * w, py = (1 - ny) / 2 * h;
  const visible = cw > 0 && px >= pad && px <= w - pad && py >= pad && py <= h - pad;
  return { x: px, y: py, visible };
}

// Which card is open. state = { open: id | null, pinned }. Hover and focus open a card unpinned, a click pins it.
export function cardReduce(state, e) {
  const closed = { open: null, pinned: false };
  switch (e.type) {
    case 'hover': case 'focus': return state.open === e.id ? state : { open: e.id, pinned: false };
    case 'leave': case 'blur': return state.open === e.id && !state.pinned ? closed : state;
    case 'click': return state.open === e.id && state.pinned ? closed : { open: e.id, pinned: true };
    case 'escape': case 'outside': return closed;
    default: return state;
  }
}

export const markerAria = (id, state) => ({ 'aria-expanded': String(state.open === id) });
