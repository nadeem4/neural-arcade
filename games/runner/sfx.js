// Coin Runner's sound effects: short beeps made with Web Audio, no audio files.
// This file does not touch Web Audio or storage until asked, so it imports safely anywhere.
export const KEY = 'na-sound', GAIN = 0.15, MIN_GAP = 0.08; // MIN_GAP: seconds before the same sound may play again

// Each note glides from hz to `to` (or holds at hz) over dur seconds; notes play one after another.
export const SOUNDS = {
  jump: { wave: 'square', notes: [{ hz: 260, to: 620, dur: 0.14 }] },
  coin: { wave: 'square', notes: [{ hz: 988, dur: 0.06 }, { hz: 1319, dur: 0.18 }] },
  bump: { wave: 'triangle', notes: [{ hz: 523, to: 784, dur: 0.1 }, { hz: 1047, dur: 0.2 }] },
  stomp: { wave: 'sine', notes: [{ hz: 140, to: 60, dur: 0.14 }] },
  die: { wave: 'sawtooth', notes: [{ hz: 400, to: 70, dur: 0.45 }] },
  fanfare: { wave: 'square', notes: [{ hz: 523, dur: 0.12 }, { hz: 659, dur: 0.12 }, { hz: 784, dur: 0.12 }, { hz: 1047, dur: 0.35 }] },
};

// Which sounds one frame's events call for. Dying or finishing says it all; landing is skipped (too frequent).
export function soundsFor(ev) {
  if (ev.died) return ['die'];
  if (ev.finished) return ['fanfare'];
  const out = [];
  if (ev.jumped) out.push('jump');
  if (ev.bumped) out.push('bump');
  else if (ev.coins > 0) out.push('coin');
  if (ev.stomped) out.push('stomp');
  return out;
}

export function readSound(storage) {
  try { return storage.getItem(KEY) === 'on'; } catch { return false; }
}
export function saveSound(storage, on) {
  try { storage.setItem(KEY, on ? 'on' : 'off'); } catch { /* blocked storage: the choice just is not remembered */ }
}

// start() must come from a user gesture (browsers block audio otherwise). Until start(), and after stop(), play() does nothing.
export function createSfx({ makeContext = () => new (window.AudioContext || window.webkitAudioContext)() } = {}) {
  let ctx = null, master = null, active = false;
  const last = {};
  return {
    start() {
      if (!ctx) { ctx = makeContext(); master = ctx.createGain(); master.gain.value = GAIN; master.connect(ctx.destination); }
      ctx.resume()?.catch(() => {});
      active = true;
    },
    running: () => ctx?.state === 'running',
    stop() {
      if (!active) return;
      active = false; ctx.suspend()?.catch(() => {});
    },
    play(name, volume = 1) {
      const sound = SOUNDS[name];
      if (!active || !sound) return;
      let t = ctx.currentTime;
      if (name in last && t - last[name] < MIN_GAP) return;
      last[name] = t;
      for (const { hz, to = hz, dur } of sound.notes) {
        const osc = ctx.createOscillator(), amp = ctx.createGain();
        osc.type = sound.wave;
        osc.frequency.setValueAtTime(hz, t);
        if (to !== hz) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
        amp.gain.setValueAtTime(0, t);
        amp.gain.linearRampToValueAtTime(volume, t + 0.01);
        amp.gain.linearRampToValueAtTime(0, t + dur);
        osc.connect(amp); amp.connect(master);
        osc.start(t); osc.stop(t + dur);
        t += dur;
      }
    },
  };
}
