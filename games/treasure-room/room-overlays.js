// Treasure Room 3D overlays: which ones a level draws, and what each one puts on the floor. Pure: no three.js and no DOM.
// Each overlay is { list(room, opts) -> draw list }; room-overlay-meshes.js turns a list into meshes.

const isFloor = (room, x, y) => !'TX#'.includes(room.cells[y][x]);
const clamp01 = h => (h > 0 ? Math.min(1, h) : 0); // NaN and negatives are 0

// The numbers on the floor tiles and the heat tint behind them (the value level). Nothing when there are no values yet.
export function valuesList(room, values, heat) {
  const labels = [], tiles = [];
  if (!values) return { labels, tiles };
  for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) {
    if (!isFloor(room, x, y)) continue;
    const i = y * room.w + x, text = values[i].toFixed(1);
    labels.push({ x, y, text: text === '-0.0' ? '0.0' : text });
    tiles.push({ x, y, h: clamp01(heat?.[i] ?? 0) });
  }
  return { labels, tiles };
}

// The outlined tiles. Part of the base room, not an overlay.
export const marksList = marks => (marks ?? []).map(({ x, y }) => ({ x, y }));

export const OVERLAYS = {
  values: { list: (room, opts) => valuesList(room, opts.values, opts.heat) },
};

// Later slices fill in the rest of the rows.
export const OVERLAYS_FOR_LEVEL = { 1: [], 2: [], 3: [], 4: [], 5: ['values'], 6: [] };

export function overlayNames(names) {
  const list = names ?? [];
  for (const n of list) if (!(n in OVERLAYS)) throw new Error(`Unknown overlay: ${n}`);
  return list;
}
