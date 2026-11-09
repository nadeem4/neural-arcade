import { describe, it, expect, vi } from 'vitest';
import { SOUNDS, soundsFor, readSound, saveSound, createSfx } from '../games/runner/sfx.js';

const fakeStorage = (init = {}) => { const m = { ...init }; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, m }; };
const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
const ev = (o = {}) => ({ coins: 0, died: false, finished: false, stomped: false, bumped: false, jumped: false, landed: false, ...o });

describe('the sounds', () => {
  it('has one sound per event, each with a wave and notes that sweep between audible pitches', () => {
    expect(Object.keys(SOUNDS).sort()).toEqual(['bump', 'coin', 'die', 'fanfare', 'jump', 'stomp']);
    for (const s of Object.values(SOUNDS)) {
      expect(['square', 'triangle', 'sine', 'sawtooth']).toContain(s.wave);
      expect(s.notes.length).toBeGreaterThan(0);
      for (const n of s.notes) { expect(n.hz).toBeGreaterThan(20); expect(n.to ?? n.hz).toBeGreaterThan(20); expect(n.dur).toBeGreaterThan(0); }
    }
  });
  it('jump rises, stomp is low, die falls, the fanfare has 3 to 4 notes, ding and pling differ', () => {
    const J = SOUNDS.jump.notes[0]; expect(J.to).toBeGreaterThan(J.hz);
    expect(SOUNDS.stomp.notes[0].hz).toBeLessThan(200);
    const D = SOUNDS.die.notes[0]; expect(D.to).toBeLessThan(D.hz);
    expect(SOUNDS.fanfare.notes.length).toBeGreaterThanOrEqual(3); expect(SOUNDS.fanfare.notes.length).toBeLessThanOrEqual(4);
    expect(SOUNDS.coin).not.toEqual(SOUNDS.bump);
  });
});

describe('soundsFor', () => {
  it('maps each event flag to its sound and ignores landing', () => {
    expect(soundsFor(ev())).toEqual([]);
    expect(soundsFor(ev({ landed: true }))).toEqual([]);
    expect(soundsFor(ev({ jumped: true }))).toEqual(['jump']);
    expect(soundsFor(ev({ coins: 1 }))).toEqual(['coin']);
    expect(soundsFor(ev({ coins: 1, bumped: true }))).toEqual(['bump']);
    expect(soundsFor(ev({ stomped: true }))).toEqual(['stomp']);
  });
  it('lets died and finished win over everything else', () => {
    expect(soundsFor(ev({ died: true, jumped: true, coins: 1, stomped: true }))).toEqual(['die']);
    expect(soundsFor(ev({ finished: true, coins: 1 }))).toEqual(['fanfare']);
    expect(soundsFor(ev({ died: true, finished: true }))).toEqual(['die']);
  });
  it('combines a ground coin with a stomp or jump', () => {
    expect(soundsFor(ev({ jumped: true, coins: 1 })).sort()).toEqual(['coin', 'jump']);
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
    const node = () => ({ connect() {}, gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, start() {}, stop() {}, type: '' });
    return { currentTime: 0, destination: {}, state: 'running', created: 0, resumed: 0, suspended: 0, peaks: [],
      createOscillator() { this.created++; return node(); },
      createGain() { const g = node(); const self = this; g.gain.linearRampToValueAtTime = (v) => self.peaks.push(v); return g; },
      resume() { this.resumed++; return Promise.resolve(); }, suspend() { this.suspended++; return Promise.resolve(); } };
  };
  it('makes no context before start and plays nothing', () => {
    const ctx = fakeCtx(); const make = vi.fn(() => ctx);
    const p = createSfx({ makeContext: make });
    p.play('jump', 1);
    expect(make).not.toHaveBeenCalled(); expect(ctx.created).toBe(0);
    p.start(); p.start();
    expect(make).toHaveBeenCalledTimes(1); expect(ctx.resumed).toBeGreaterThan(0);
  });
  it('plays after start, is a no-op after stop, and plays again after start', () => {
    const ctx = fakeCtx(); const p = createSfx({ makeContext: () => ctx });
    p.start(); p.play('jump', 1); expect(ctx.created).toBe(1);
    p.stop(); expect(ctx.suspended).toBe(1);
    ctx.currentTime = 5; p.play('jump', 1); expect(ctx.created).toBe(1);
    p.start(); p.play('jump', 1); expect(ctx.created).toBe(2);
  });
  it('plays one oscillator per note, and ignores unknown names', () => {
    const ctx = fakeCtx(); const p = createSfx({ makeContext: () => ctx });
    p.start(); p.play('fanfare', 1); expect(ctx.created).toBe(SOUNDS.fanfare.notes.length);
    expect(() => p.play('nope', 1)).not.toThrow();
  });
  it('rate-limits the same sound to once per 80 ms but not different sounds', () => {
    const ctx = fakeCtx(); const p = createSfx({ makeContext: () => ctx });
    p.start(); p.play('coin', 1); ctx.currentTime = 0.05; p.play('coin', 1);
    expect(ctx.created).toBe(SOUNDS.coin.notes.length);
    p.play('jump', 1); expect(ctx.created).toBe(SOUNDS.coin.notes.length + SOUNDS.jump.notes.length);
    ctx.currentTime = 0.1; p.play('coin', 1);
    expect(ctx.created).toBe(2 * SOUNDS.coin.notes.length + SOUNDS.jump.notes.length);
  });
  it('scales loudness by the volume given', () => {
    const a = fakeCtx(), b = fakeCtx();
    const pa = createSfx({ makeContext: () => a }), pb = createSfx({ makeContext: () => b });
    pa.start(); pb.start(); pa.play('jump', 1); pb.play('jump', 0.4);
    expect(Math.max(...b.peaks)).toBeCloseTo(0.4 * Math.max(...a.peaks), 6);
  });
  it('tolerates resume and suspend that return nothing or reject', () => {
    const ctx = fakeCtx(); ctx.resume = () => Promise.reject(new Error('x')); ctx.suspend = () => undefined;
    const p = createSfx({ makeContext: () => ctx });
    expect(() => { p.start(); p.stop(); }).not.toThrow();
    expect(p.running()).toBe(true);
  });
});
