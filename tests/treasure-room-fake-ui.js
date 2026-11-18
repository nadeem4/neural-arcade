import { ROOM } from '../games/treasure-room/sim.js';
// A minimal stand-in for the page, so a level's mount() can be smoke-tested in Node (no DOM).
export function fakeUi() {
  const els = {};
  let listeners = 0;
  const make = () => {
    const handlers = {};
    return {
      handlers, textContent: '', innerHTML: '', disabled: false, hidden: false, value: '0.9', dataset: {},
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener(t, fn, opts) {
        (handlers[t] ??= new Set()).add(fn); listeners++;
        opts?.signal?.addEventListener('abort', () => { if (handlers[t].delete(fn)) listeners--; });
      },
      removeEventListener(t, fn) { if (handlers[t]?.delete(fn)) listeners--; },
      setAttribute() {}, focus() {}, querySelector: () => null, querySelectorAll: () => [],
    };
  };
  const get = sel => (els[sel] ??= make());
  const drawn = [];
  return {
    drawn, last: () => drawn.at(-1),
    listenerCount: () => listeners,
    input(sel) { for (const fn of get(sel).handlers.input ?? []) fn({ target: get(sel) }); },
    click(sel) { for (const fn of get(sel).handlers.click ?? []) fn({ target: get(sel), preventDefault() {} }); },
    panel: { querySelector: get, querySelectorAll: () => [] },
    tiles: get('#tiles'),
    canvas: get('canvas'),
    room: ROOM,
    draw(o) { drawn.push(o); },
    cellAt: () => null,
    say() {}, readout() {}, sees() {}, setLog() {}, flash() {},
  };
}
