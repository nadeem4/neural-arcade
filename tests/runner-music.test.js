import { describe, it, expect, vi } from 'vitest';
import { midiToHz, TUNE, BASS, schedule, readSound, saveSound, createPlayer } from '../games/runner/music.js';

const total = a => a.reduce((n, x) => n + x.beats, 0);
const fakeStorage = (init = {}) => { const m = { ...init }; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, m }; };
const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

describe('the tune', () => {
  it('converts midi to Hz', () => { expect(midiToHz(69)).toBe(440); expect(midiToHz(57)).toBe(220); });
  it('is four bars of 4/4, in a friendly range', () => {
    expect(total(TUNE)).toBe(16);
    expect(total(BASS)).toBe(16);
    for (const n of [...TUNE, ...BASS]) expect(n.midi === null || (n.midi >= 48 && n.midi <= 84)).toBe(true);
  });
  it('schedules notes in order from the start time to the end of the loop, skipping rests', () => {
    const ev = schedule(120, 10);
    expect(ev[0].time).toBe(10);
    for (let i = 1; i < ev.length; i++) expect(ev[i].time).toBeGreaterThanOrEqual(ev[i - 1].time);
    const last = Math.max(...ev.map(e => e.time + e.dur));
    expect(last).toBeCloseTo(10 + (16 * 60) / 120, 6);
    expect(ev.length).toBe([...TUNE, ...BASS].filter(n => n.midi !== null).length);
    for (const e of ev) { expect(['lead', 'bass']).toContain(e.voice); expect(e.hz).toBeGreaterThan(0); }
  });
});

describe('the sound preference', () => {
  it('is muted unless on was saved', () => {
    expect(readSound(fakeStorage())).toBe(false);
    expect(readSound(fakeStorage({ 'na-sound': 'junk' }))).toBe(false);
    expect(readSound(fakeStorage({ 'na-sound': 'on' }))).toBe(true);
    expect(readSound(broken)).toBe(false);
  });
  it('saves on and off under na-sound, and survives blocked storage', () => {
    const st = fakeStorage();
    saveSound(st, true); expect(st.m['na-sound']).toBe('on');
    saveSound(st, false); expect(st.m['na-sound']).toBe('off');
    expect(() => saveSound(broken, true)).not.toThrow();
  });
});

describe('the player', () => {
  const fakeCtx = () => {
    const node = () => ({ connect() {}, gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} }, frequency: { value: 0 }, start() {}, stop() {}, type: '' });
    return { currentTime: 0, destination: {}, state: 'running', created: 0, resumed: 0, suspended: 0,
      createOscillator() { this.created++; return node(); }, createGain: node,
      resume() { this.resumed++; return Promise.resolve(); }, suspend() { this.suspended++; return Promise.resolve(); } };
  };
  it('plays nothing before start, makes the context once, and suspends on stop', () => {
    vi.useFakeTimers();
    const ctx = fakeCtx(); const make = vi.fn(() => ctx);
    const p = createPlayer({ makeContext: make });
    expect(make).not.toHaveBeenCalled();
    p.start(); p.start();
    expect(make).toHaveBeenCalledTimes(1);
    expect(ctx.created).toBeGreaterThan(0);
    const before = ctx.created; ctx.currentTime = 8; vi.advanceTimersByTime(500);
    expect(ctx.created).toBeGreaterThan(before);
    p.stop(); expect(ctx.suspended).toBe(1);
    const after = ctx.created; vi.advanceTimersByTime(2000);
    expect(ctx.created).toBe(after);
    vi.useRealTimers();
  });
  it('start after stop reuses the context and schedules from now on', () => {
    vi.useFakeTimers();
    const ctx = fakeCtx(); const make = vi.fn(() => ctx);
    const p = createPlayer({ makeContext: make });
    p.start(); p.stop(); ctx.currentTime = 30;
    const times = []; const orig = ctx.createOscillator;
    ctx.createOscillator = function () { const o = orig.call(this); o.start = t => times.push(t); return o; };
    p.start();
    expect(make).toHaveBeenCalledTimes(1);
    expect(times.length).toBeGreaterThan(0);
    for (const t of times) expect(t).toBeGreaterThanOrEqual(30);
    p.stop(); vi.useRealTimers();
  });
  it('tolerates resume and suspend that return nothing or reject', () => {
    const ctx = fakeCtx(); ctx.resume = () => Promise.reject(new Error('x')); ctx.suspend = () => undefined;
    const p = createPlayer({ makeContext: () => ctx });
    expect(() => { p.start(); p.stop(); }).not.toThrow();
    expect(p.running()).toBe(true);
  });
});
