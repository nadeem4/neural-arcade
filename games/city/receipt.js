// The trip receipt, the cheat list and what to try next, from the reward and analyzeRoute's result.
import { GOAL_SECONDS } from './presets.js';
import { FIELDS } from './reward.js';

const round1 = (n) => Math.round(n * 10) / 10 + 0; // + 0 turns -0 into 0

// A signed amount for the player: + or a real minus, nothing for zero.
export const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : `${n}`);

// The rate card row label for a rate, so every hint names the row the player will see.
const rowOf = (key) => `“${FIELDS.find(f => f.key === key).label}”`;

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Lines for a zero rate with a zero count are left out. Pay per tile is left out whenever its rate is zero.
// `free` marks a line the card did not fine although the taxi did it: the end card says "free" there, not 0.
export function buildReceipt(rewards, a) {
  const lines = [];
  const add = (label, detail, amount, free = false) => lines.push({ label, detail, amount: round1(amount), free });
  if (a.arrived) add('Fare', 'arrived', rewards.fare);
  if (rewards.time || a.seconds) add('Clock', `${a.seconds} s`, -rewards.time * a.seconds);
  if (rewards.off || a.offTiles) add('Footpath', plural(a.offTiles, 'tile'), -rewards.off * a.offTiles, !rewards.off);
  if (rewards.red || a.redRuns) add('Red light', plural(a.redRuns, 'time'), -rewards.red * a.redRuns, !rewards.red);
  if (rewards.wrong || a.wrongWays) add('Wrong way', plural(a.wrongWays, 'tile'), -rewards.wrong * a.wrongWays, !rewards.wrong);
  if (rewards.perTile) add('Per tile', plural(a.tiles, 'tile'), rewards.perTile * a.tiles);
  return { lines, total: round1(a.reward) };
}

// Names only the highest-precedence loophole.
export function verdictOf(rewards, a) {
  if (!a.arrived) {
    if (rewards.perTile > 0 && a.seconds > 0 && a.tiles >= a.seconds / 2) {
      return 'It earns more by driving than by delivering, so it never drops the passenger off.';
    }
    if (rewards.fare <= 0) return 'It never arrived. Nothing pays for the drop-off, so nothing pays it to go there.';
    const fines = rewards.off * a.offTiles + rewards.red * a.redRuns + rewards.wrong * a.wrongWays;
    return fines >= rewards.fare
      ? 'It never arrived. The fines outweigh the fare, so not driving pays best.'
      : 'It never arrived.';
  }
  if (a.offTiles > 0 && rewards.off <= 0) {
    // Every cheat this card leaves free, named together, so the line agrees with the ladder note of the same card.
    const free = [a.parkTiles > 0 ? 'cut across the park' : 'drove along the footpaths'];
    if (a.redRuns > 0 && rewards.red <= 0) free.push('ran red lights');
    if (a.wrongWays > 0 && rewards.wrong <= 0) free.push('went the wrong way down a one-way street');
    const list = free.length > 1 ? `${free.slice(0, -1).join(', ')} and ${free[free.length - 1]}` : free[0];
    return `It ${list}. Nothing fines that.`;
  }
  const tail = 'the fine costs less than the time it saves.';
  if (a.parkTiles > 0) return `It cut across the park: ${tail}`;
  if (a.offTiles > 0) return `It drove along the footpaths: ${tail}`;
  if (a.redRuns > 0) return 'It ran red lights: they cost less than waiting.';
  if (a.wrongWays > 0) return 'It went the wrong way down a one-way street to save time.';
  return 'Legal trip: no fines.';
}

// Every cheat the trip used, each with its own computed reason: [{ kind, reason }].
// honest is the honest route's analysis (or null); it gives the seconds a cheat saved. Order: never, circling, park, footpath, red, wrong.
export function cheatsOf(rewards, a, honest) {
  const out = [];
  const add = (kind, reason) => out.push({ kind, reason });
  const saved = honest ? Math.max(0, honest.seconds - a.seconds) : 0;
  // "The fine was 20 a tile (−60)." or "Nothing fined it." (them, for red lights)
  const fine = (rate, n, per, them = false) => (rate > 0 ? `The fine was ${rate} ${per} (${signed(-round1(rate * n))}).` : `Nothing fined ${them ? 'them' : 'it'}.`);
  if (!a.arrived) add('never', `Never arrived, so it missed the fare${rewards.fare > 0 ? ` of ${rewards.fare}` : ''}.`);
  if (rewards.perTile > 0 && honest && a.tiles > honest.tiles) {
    const extra = a.tiles - honest.tiles;
    add('circling', `Drove ${plural(extra, 'extra tile')} for ${rewards.perTile} pay each (${round1(rewards.perTile * extra)}).`);
  }
  if (a.parkTiles > 0) add('park', `Cut through the park on ${plural(a.parkTiles, 'tile')}. ${fine(rewards.off, a.parkTiles, 'a tile')}`);
  const foot = a.offTiles - a.parkTiles;
  if (foot > 0) add('footpath', `Drove ${plural(foot, 'tile')} on footpaths. ${fine(rewards.off, foot, 'a tile')}`);
  if (a.redRuns > 0) add('red', `Ran ${plural(a.redRuns, 'red light')}. ${fine(rewards.red, a.redRuns, 'each', a.redRuns > 1)}`);
  if (a.wrongWays > 0) add('wrong', `Went the wrong way on ${plural(a.wrongWays, 'tile')}. ${fine(rewards.wrong, a.wrongWays, 'each')}`);
  if (saved > 0) add('saved', `Together the cheats saved ${saved} s, worth ${round1(saved * rewards.time)} pay.`);
  return out;
}

// The game page's verdict: names the cheat and the rate card row to change next. (verdictOf stays as it is for the write-up's recording.)
export function nextStepOf(rewards, a) {
  if (!a.arrived) {
    if (rewards.perTile > 0 && a.seconds > 0 && a.tiles >= a.seconds / 2) {
      return `It drove extra to earn pay per tile and never dropped the passenger off. Lower ${rowOf('perTile')} on the rate card.`;
    }
    if (rewards.fare <= 0) return `It never arrived. Nothing pays it for the drop-off. Raise ${rowOf('fare')} on the rate card.`;
    const fines = rewards.off * a.offTiles + rewards.red * a.redRuns + rewards.wrong * a.wrongWays;
    return fines >= rewards.fare
      ? `It never arrived. The fines outweigh the fare. Lower a fine or raise ${rowOf('fare')} on the rate card.`
      : `It never arrived. Raise ${rowOf('fare')} on the rate card.`;
  }
  const cheat = (what, rate, key) => `${what} ${rate > 0 ? 'The fine is too small.' : 'Nothing fines that.'} Raise ${rowOf(key)} on the rate card.`;
  if (a.parkTiles > 0) return cheat('It cut across the park.', rewards.off, 'off');
  if (a.offTiles > 0) return cheat('It drove along the footpaths.', rewards.off, 'off');
  if (a.redRuns > 0) return cheat('It ran red lights.', rewards.red, 'red');
  if (a.wrongWays > 0) return cheat('It went the wrong way down a one-way street.', rewards.wrong, 'wrong');
  return a.seconds < GOAL_SECONDS ? 'Clean, fast and legal. That is a fixed taxi.' : `Legal, but not fast enough. Raise ${rowOf('time')} on the rate card.`;
}

// What to try next on the end card. One cheat: nextStepOf's line. Several fine cheats: all of them named, not only the first.
export function hintOf(rewards, a) {
  const fined = [a.offTiles && 'footpath', a.redRuns && 'red light', a.wrongWays && 'wrong way'].filter(Boolean);
  if (!a.arrived || fined.length < 2) return nextStepOf(rewards, a);
  return `It used ${fined.length} loopholes. Add or raise the ${fined.slice(0, -1).join(', ')} and ${fined.at(-1)} fines.`;
}
