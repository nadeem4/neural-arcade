import { describe, it, expect, vi } from 'vitest';
import { mountLessonPage } from '../assets/lesson-page.js';

// A tiny stand-in for the document: just the elements the runtime touches.
function fakeDoc() {
  const levelRoot = { id: 'levelRoot' };
  const attrs = { 'aria-pressed': 'false' };
  const markDone = {
    textContent: 'Mark as done', handler: null,
    setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: k => attrs[k],
    addEventListener(type, fn) { if (type === 'click') this.handler = fn; },
    click() { this.handler(); },
  };
  const watch = { querySelectorAll: () => [] };
  const els = { levelRoot, markDone, watch };
  return { levelRoot, markDone, doc: { getElementById: id => els[id] ?? null } };
}
const store = initial => {
  let v = initial;
  return { getItem: () => v, setItem: (_, x) => { v = x; }, get: () => v };
};

describe('mountLessonPage', () => {
  it('mounts the level, shows saved progress and toggles Mark as done', () => {
    const { doc, levelRoot, markDone } = fakeDoc();
    const mountLevel = vi.fn(() => ({ redraw() {} }));
    const storage = store('["return"]');
    mountLessonPage({ id: 'return', base: '../../', doc, storage, mountLevel });
    expect(mountLevel).toHaveBeenCalledWith(levelRoot, expect.objectContaining({ n: 3, showTitle: false }));
    expect(markDone.getAttribute('aria-pressed')).toBe('true');
    markDone.click();
    expect(storage.get()).toBe('[]');
    expect(markDone.getAttribute('aria-pressed')).toBe('false');
    markDone.click();
    expect(storage.get()).toBe('["return"]');
  });
  it('does nothing and does not throw for an unknown or soon lesson', () => {
    const { doc } = fakeDoc();
    const mountLevel = vi.fn();
    for (const id of ['sarsa', 'nope', undefined]) {
      expect(() => mountLessonPage({ id, base: '../../', doc, storage: store(null), mountLevel })).not.toThrow();
    }
    expect(mountLevel).not.toHaveBeenCalled();
  });
  it('still toggles for the visit when storage is blocked', () => {
    const { doc, markDone } = fakeDoc();
    const blocked = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
    mountLessonPage({ id: 'return', base: '../../', doc, storage: blocked, mountLevel: () => ({}) });
    expect(markDone.getAttribute('aria-pressed')).toBe('false');
    expect(() => markDone.click()).not.toThrow();
    expect(markDone.getAttribute('aria-pressed')).toBe('true');
    markDone.click();
    expect(markDone.getAttribute('aria-pressed')).toBe('false');
  });
  it('ignores garbage saved progress', () => {
    const { doc, markDone } = fakeDoc();
    mountLessonPage({ id: 'return', base: '../../', doc, storage: store('{"x"'), mountLevel: () => ({}) });
    expect(markDone.getAttribute('aria-pressed')).toBe('false');
  });
  it('returns the mounted level so the lamp can redraw it, or null when nothing mounted', () => {
    const { doc } = fakeDoc();
    const handle = { redraw() {} };
    expect(mountLessonPage({ id: 'return', base: '../../', doc, storage: store(null), mountLevel: () => handle })).toBe(handle);
    expect(mountLessonPage({ id: 'sarsa', base: '../../', doc, storage: store(null), mountLevel: () => handle })).toBeNull();
  });
});
