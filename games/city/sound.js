// Drive sounds: short WebAudio blips, no files. Silent when muted or under reduced motion.
// The context is created on first use (after a click on Train, so browsers allow it).
export const TONES = {
  tick: { freq: 660, ms: 40, type: 'sine' },
  fine: { freq: 220, ms: 180, type: 'square' },
  red: { freq: 140, ms: 260, type: 'sawtooth' },
  fare: { freq: 880, ms: 320, type: 'triangle' },
};

const defaultFactory = () => new (globalThis.AudioContext || globalThis.webkitAudioContext)();

export function createSound({ muted = false, reducedMotion = false, ctxFactory = defaultFactory } = {}) {
  let ctx = null, off = muted, failed = false;
  const silent = () => off || reducedMotion || failed;
  const context = () => {
    if (!ctx && !failed) {
      try { ctx = ctxFactory() || null; } catch { ctx = null; }
      if (!ctx) failed = true; else if (ctx.state === 'suspended') ctx.resume?.();
    }
    return ctx;
  };
  return {
    setMuted(m) { off = !!m; },
    unlock() { if (!silent()) context(); },
    play(kind) {
      const tone = TONES[kind];
      if (!tone || silent()) return;
      const c = context();
      if (!c) return;
      const osc = c.createOscillator(), gain = c.createGain(), t = c.currentTime;
      osc.type = tone.type; osc.frequency.value = tone.freq;
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + tone.ms / 1000);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(t); osc.stop(t + tone.ms / 1000);
    },
  };
}
