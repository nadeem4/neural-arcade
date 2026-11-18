// Level 2 (state, action, reward): the same play as level 1, with every step written as a line and a reward tag floating on the tile.
import { mountPlay } from './level-agent.js';
import { logLine } from './words.js';
import { tagTone } from './room-view.js';

const KEEP = 8;

export const appendLog = (log, entry) => [...log, logLine(entry)].slice(-KEEP);

export const tagsFor = entry => entry
  ? [{ x: entry.pos.x, y: entry.pos.y, text: entry.reward > 0 ? `+${entry.reward}` : `−${-entry.reward}`, tone: tagTone(entry.reward) }]
  : [];

export function mount(ui) {
  let log = [];
  return mountPlay(ui, {
    handover: 'Let the AI play',
    onStep: {
      record(s) {
        log = appendLog(log, s.lastStep);
        ui.setLog(log);
        ui.say(log[log.length - 1]);
      },
      tags: s => (s.lastStep ? tagsFor({ pos: s.pos, reward: s.lastStep.reward }) : []),
    },
    onRestart() { log = []; ui.setLog(log); },
  });
}
