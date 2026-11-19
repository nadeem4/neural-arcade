import { describe, it, expect } from 'vitest';
import { createSound, TONES } from '../games/city/sound.js';

function stubFactory() {
  const log = { made: 0, osc: 0, started: 0 };
  const node = () => ({ connect() {}, frequency: { value: 0, setValueAtTime() {}, }, gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, start() { log.started++; }, stop() {} });
  const factory = () => {
    log.made++;
    return { currentTime: 0, destination: {}, state: 'running', resume() {}, createOscillator() { log.osc++; return node(); }, createGain: node };
  };
  return { log, factory };
}

describe('TONES', () => {
  it('has a distinct frequency for each of tick, fine, red, fare and horn', () => {
    expect(Object.keys(TONES).sort()).toEqual(['fare', 'fine', 'horn', 'red', 'tick']);
    const freqs = Object.values(TONES).map((t) => t.freq);
    expect(new Set(freqs).size).toBe(5);
    for (const t of Object.values(TONES)) { expect(t.ms).toBeGreaterThan(0); expect(typeof t.type).toBe('string'); }
  });
});

describe('createSound', () => {
  it('makes no audio calls when muted, and never even creates the context', () => {
    const { log, factory } = stubFactory();
    const s = createSound({ muted: true, reducedMotion: false, ctxFactory: factory });
    s.play('fine'); s.unlock();
    expect(log).toEqual({ made: 0, osc: 0, started: 0 });
  });
  it('a horn is silent when muted or under reduced motion, and plays otherwise', () => {
    for (const opts of [{ muted: true }, { reducedMotion: true }]) {
      const { log, factory } = stubFactory();
      createSound({ ctxFactory: factory, ...opts }).play('horn');
      expect(log.made + log.osc).toBe(0);
    }
    const { log, factory } = stubFactory();
    createSound({ ctxFactory: factory }).play('horn');
    expect(log.started).toBe(1);
  });
  it('makes no audio calls under reduced motion', () => {
    const { log, factory } = stubFactory();
    const s = createSound({ muted: false, reducedMotion: true, ctxFactory: factory });
    s.play('red');
    expect(log.made + log.osc).toBe(0);
  });
  it('creates the context on the first play and reuses it', () => {
    const { log, factory } = stubFactory();
    const s = createSound({ muted: false, reducedMotion: false, ctxFactory: factory });
    expect(log.made).toBe(0);
    s.play('tick'); s.play('fare');
    expect(log.made).toBe(1);
    expect(log.osc).toBe(2);
    expect(log.started).toBe(2);
  });
  it('can be muted and unmuted later, and ignores an unknown kind or a failing factory', () => {
    const { log, factory } = stubFactory();
    const s = createSound({ muted: false, reducedMotion: false, ctxFactory: factory });
    s.setMuted(true); s.play('fine');
    expect(log.osc).toBe(0);
    s.setMuted(false); s.play('nope');
    expect(log.osc).toBe(0);
    expect(() => createSound({ muted: false, reducedMotion: false, ctxFactory: () => { throw new Error('x'); } }).play('fine')).not.toThrow();
    expect(() => createSound({ muted: false, reducedMotion: false, ctxFactory: () => null }).play('fine')).not.toThrow();
  });
});
