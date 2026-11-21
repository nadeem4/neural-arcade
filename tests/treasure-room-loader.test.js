import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createLoader, REASONS } from '../games/treasure-room/room-loader.js';

function el(tag) {
  const n = {
    tag, kids: [], className: '', dataset: {}, attrs: {}, listeners: {}, parentNode: null, textContent: '', hidden: false,
    // Like a real HTMLCollection: indexable and with a length, but no array methods (no .at, .find, .flatMap).
    get children() { const c = { length: n.kids.length, item: i => n.kids[i] ?? null }; n.kids.forEach((k, i) => { c[i] = k; }); return c; },
    style: { setProperty(k, v) { this[k] = v; } },
    setAttribute(k, v) { this.attrs[k] = v; },
    append(...c) { for (const x of c) { x.parentNode = n; n.kids.push(x); } },
    appendChild(x) { n.append(x); return x; },
    remove() { if (n.parentNode) n.parentNode.kids = n.parentNode.kids.filter(c => c !== n); n.parentNode = null; },
    addEventListener(t, f) { n.listeners[t] = f; },
    click() { n.listeners.click?.(); },
    focus() { n.focused = true; },
    contains(x) { return x === n || n.kids.some(c => c.contains(x)); },
  };
  return n;
}
const doc = { createElement: el, activeElement: null };
const all = n => [n, ...n.kids.flatMap(all)];
const find = (n, cls) => all(n).find(x => x.className.split(' ').includes(cls));
const texts = n => all(n).map(x => x.textContent);
const overlay = box => box.kids.find(c => c.className.includes('room-loader'));

describe('createLoader', () => {
  let box, onRetry;
  beforeEach(() => { vi.useFakeTimers(); box = el('div'); onRetry = vi.fn(); doc.activeElement = null; });
  afterEach(() => vi.useRealTimers());
  const make = (o = {}) => createLoader(box, { title: 'Return', onRetry, doc, ...o });

  it('builds the loading panel with title and line', () => {
    make();
    const o = overlay(box);
    expect(texts(o)).toContain('Return');
    expect(texts(o)).toContain('Entering the room…');
    expect(o.dataset.state).toBe('loading');
    expect(o.attrs.role).toBe('status');
  });
  it('progress fills the bar, clamped and rounded', () => {
    const l = make();
    const fill = find(overlay(box), 'room-loader-fill');
    l.progress(0.456); expect(fill.style['--p']).toBe(0.46);
    l.progress(2); expect(fill.style['--p']).toBe(1);
    l.progress(-1); expect(fill.style['--p']).toBe(0);
  });
  it('REASONS copy is exact', () => {
    expect(REASONS).toEqual({
      'no-webgl': 'This browser or device has no WebGL.',
      load: 'The 3D files did not load. Check your connection.',
      scene: 'The 3D view could not start.',
      lost: 'The 3D view was interrupted.',
    });
  });
  it('fail shows the heading, reason and Try again', () => {
    const l = make();
    l.fail('no-webgl');
    const o = overlay(box);
    expect(o.dataset.state).toBe('failed');
    expect(texts(o)).toContain('This room needs 3D graphics');
    expect(find(o, 'room-loader-reason').textContent).toBe(REASONS['no-webgl']);
    expect(texts(o)).toContain('Try again');
    l.fail('nonsense');
    expect(find(overlay(box), 'room-loader-reason').textContent).toBe(REASONS.scene);
  });
  it('Try again calls onRetry, and loading() brings the panel back', () => {
    const l = make();
    l.fail('load');
    all(overlay(box)).find(x => x.tag === 'button').click();
    expect(onRetry).toHaveBeenCalledTimes(1);
    l.loading();
    expect(overlay(box).dataset.state).toBe('loading');
    expect(find(overlay(box), 'room-loader-fill').style['--p']).toBe(0);
  });
  it('moves focus to Try again only when focus was inside the room', () => {
    const l = make();
    l.fail('load');
    const btn = all(overlay(box)).find(x => x.tag === 'button');
    expect(btn.focused).toBeUndefined();
    const l2 = make();
    doc.activeElement = el('button'); box.append(doc.activeElement);
    l2.fail('load');
    expect(all(box).filter(x => x.tag === 'button' && x.focused)).toHaveLength(1);
  });
  it('done fades then removes after 300 ms; immediately when reduceMotion', () => {
    const l = make();
    l.done();
    expect(overlay(box).dataset.state).toBe('done');
    vi.advanceTimersByTime(299); expect(overlay(box)).toBeTruthy();
    vi.advanceTimersByTime(2); expect(overlay(box)).toBeUndefined();
    const b2 = el('div');
    createLoader(b2, { title: 'x', onRetry, doc, reduceMotion: true }).done();
    expect(overlay(b2)).toBeUndefined();
  });
  it('fail after done builds a new overlay', () => {
    const l = make();
    l.done(); vi.advanceTimersByTime(400);
    expect(overlay(box)).toBeUndefined();
    l.fail('lost');
    expect(overlay(box).dataset.state).toBe('failed');
    expect(find(overlay(box), 'room-loader-reason').textContent).toBe(REASONS.lost);
  });
  it('destroy removes the overlay and cancels the removal timer', () => {
    const l = make();
    l.done(); l.destroy();
    expect(overlay(box)).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('has no three import and no 2D canvas', () => {
    const src = readFileSync(new URL('../games/treasure-room/room-loader.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/three|getContext/);
  });
});
