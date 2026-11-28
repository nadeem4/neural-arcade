import { ROOM } from '../games/treasure-room/sim.js';
// A minimal stand-in for the page, so a level's mount() can be smoke-tested in Node (no DOM).
export function fakeUi(room = ROOM) {
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
      setAttribute() {}, removeAttribute() {}, focus() {}, querySelector: () => null, querySelectorAll: () => [],
    };
  };
  const get = sel => (els[sel] ??= make());
  const drawn = [], curves = [];
  return {
    drawn, curves, dark: false, last: () => drawn.at(-1),
    listenerCount: () => listeners,
    input(sel) { for (const fn of get(sel).handlers.input ?? []) fn({ target: get(sel) }); },
    click(sel) { for (const fn of get(sel).handlers.click ?? []) fn({ target: get(sel), preventDefault() {} }); },
    panel: { querySelector: get, querySelectorAll: () => [] },
    tiles: get('#tiles'),
    canvas: get('canvas'),
    room,
    draw(o) { drawn.push(o); },
    curve(scores) { curves.push(scores); },
    lightsOff(on) { this.dark = on; },
    cellAt: () => null,
    said: [], say(t) { this.said.push(t); }, readout() {}, sees() {}, setLog() {}, flash() {},
  };
}
