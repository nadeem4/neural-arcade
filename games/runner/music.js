// Coin Runner's music: a four-bar chiptune loop (square lead, triangle bass) made with Web Audio, no audio files.
// This file does not touch Web Audio or storage until asked, so it imports safely anywhere.
export const BPM = 112, BEATS = 16, GAIN = 0.08, KEY = 'na-sound';
const n = (midi, beats) => ({ midi, beats });
// C, Am, F, G: one bar each.
export const TUNE = [n(72, 1), n(76, 1), n(79, 1), n(76, 1), n(69, 1), n(72, 1), n(76, 1), n(72, 1),
  n(65, 1), n(69, 1), n(72, 1), n(69, 1), n(67, 1), n(71, 1), n(74, 1), n(null, 1)];
export const BASS = [n(48, 2), n(55, 2), n(57, 2), n(52, 2), n(53, 2), n(60, 2), n(55, 2), n(59, 2)];

export const midiToHz = m => 440 * 2 ** ((m - 69) / 12);

// One loop as timed notes. A rest makes a gap and no event.
export function schedule(bpm, start) {
  const beat = 60 / bpm, out = [];
  for (const [voice, notes] of [['lead', TUNE], ['bass', BASS]]) {
    let t = start;
    for (const { midi, beats } of notes) {
      if (midi !== null) out.push({ time: t, hz: midiToHz(midi), dur: beats * beat, voice });
      t += beats * beat;
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

export function readSound(storage) {
  try { return storage.getItem(KEY) === 'on'; } catch { return false; }
}
export function saveSound(storage, on) {
  try { storage.setItem(KEY, on ? 'on' : 'off'); } catch { /* blocked storage: the choice just is not remembered */ }
}

const LOOKAHEAD = 1.5; // seconds of music queued ahead of the clock
// start() must come from a user gesture (browsers block audio otherwise). stop() freezes the clock, so start() carries on.
export function createPlayer({ makeContext = () => new (window.AudioContext || window.webkitAudioContext)() } = {}) {
  let ctx = null, master = null, timer = null, next = 0;
  const pump = () => {
    while (next < ctx.currentTime + LOOKAHEAD) {
      for (const e of schedule(BPM, next)) {
        const osc = ctx.createOscillator(), amp = ctx.createGain();
        osc.type = e.voice === 'lead' ? 'square' : 'triangle';
        osc.frequency.value = e.hz;
        const peak = e.voice === 'lead' ? 0.5 : 0.9, end = e.time + e.dur;
        amp.gain.setValueAtTime(0, e.time);
        amp.gain.linearRampToValueAtTime(peak, e.time + 0.02);
        amp.gain.linearRampToValueAtTime(0, end - 0.02);
        osc.connect(amp); amp.connect(master);
        osc.start(e.time); osc.stop(end);
      }
      next += (BEATS * 60) / BPM;
    }
  };
  return {
    start() {
      if (timer) return;
      if (!ctx) { ctx = makeContext(); master = ctx.createGain(); master.gain.value = GAIN; master.connect(ctx.destination); next = ctx.currentTime + 0.05; }
      ctx.resume();
      pump(); timer = setInterval(pump, 100);
    },
    stop() {
      if (!timer) return;
      clearInterval(timer); timer = null; ctx.suspend();
    },
  };
}
