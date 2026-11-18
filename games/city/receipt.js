// The trip receipt, the cheat list and what to try next, from the reward and analyzeRoute's result.
import { GOAL_SECONDS } from './presets.js';

const round1 = (n) => Math.round(n * 10) / 10 + 0; // + 0 turns -0 into 0

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Lines for a zero rate with a zero count are left out. Pay per tile is left out whenever its rate is zero.
export function buildReceipt(rewards, a) {
  const lines = [];
  const add = (label, detail, amount) => lines.push({ label, detail, amount: round1(amount) });
  if (a.arrived) add('Fare', 'arrived', rewards.fare);
  if (rewards.time || a.seconds) add('Clock', `${a.seconds} s`, -rewards.time * a.seconds);
  if (rewards.off || a.offTiles) add('Park and footpath', plural(a.offTiles, 'tile'), -rewards.off * a.offTiles);
  if (rewards.red || a.redRuns) add('Red lights', plural(a.redRuns, 'run'), -rewards.red * a.redRuns);
  if (rewards.wrong || a.wrongWays) add('Wrong way', plural(a.wrongWays, 'move'), -rewards.wrong * a.wrongWays);
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
  const tail = rewards.off > 0 ? 'the fine costs less than the time it saves.' : 'nobody fined that.';
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
  const fine = (rate, n, unit) => (rate > 0 ? `the fine was ${rate} ${unit === 'tile' ? `for ${plural(n, 'tile')}` : 'each'} (${round1(rate * n)})` : 'nothing fined it');
  if (!a.arrived) add('never', `Never arrived, so it missed the fare${rewards.fare > 0 ? ` of ${rewards.fare}` : ''}.`);
  if (rewards.perTile > 0 && honest && a.tiles > honest.tiles) {
    const extra = a.tiles - honest.tiles;
    add('circling', `Drove ${plural(extra, 'extra tile')} for ${rewards.perTile} pay each (${round1(rewards.perTile * extra)}).`);
  }
  if (a.parkTiles > 0) add('park', `Cut through the park ${plural(a.parkTiles, 'tile')}; ${fine(rewards.off, a.parkTiles, 'tile')}.`);
  const foot = a.offTiles - a.parkTiles;
  if (foot > 0) add('footpath', `Footpath shortcut ${plural(foot, 'tile')}; ${fine(rewards.off, foot, 'tile')}.`);
  if (a.redRuns > 0) add('red', `Ran ${plural(a.redRuns, 'red light')}; ${fine(rewards.red, a.redRuns, 'each')}.`);
  if (a.wrongWays > 0) add('wrong', `Went the wrong way ${plural(a.wrongWays, 'time')}; ${fine(rewards.wrong, a.wrongWays, 'each')}.`);
  if (saved > 0) add('saved', `Together the cheats saved ${saved} s, worth ${round1(saved * rewards.time)} pay.`);
  return out;
}

// The game page's verdict: names the cheat and the slider to try next. (verdictOf stays as it is for the write-up's recording.)
export function nextStepOf(rewards, a) {
  if (!a.arrived) {
    if (rewards.perTile > 0 && a.seconds > 0 && a.tiles >= a.seconds / 2) {
      return 'It drove extra to earn pay per tile and never dropped the passenger off. Try lowering pay per tile.';
    }
    if (rewards.fare <= 0) return 'It never arrived. Nothing pays it for the drop-off. Try raising the fare.';
    const fines = rewards.off * a.offTiles + rewards.red * a.redRuns + rewards.wrong * a.wrongWays;
    return fines >= rewards.fare
      ? 'It never arrived. The fines outweigh the fare. Try lowering a fine or raising the fare.'
      : 'It never arrived. Try raising the fare.';
  }
  const cheat = (what, rate, fine) => `${what} ${rate > 0 ? 'The fine is too small.' : 'Nothing fines that.'} Try ${rate > 0 ? 'a bigger' : 'the'} ${fine} fine.`;
  if (a.parkTiles > 0) return cheat('It cut across the park.', rewards.off, 'park');
  if (a.offTiles > 0) return cheat('It drove along the footpaths.', rewards.off, 'park');
  if (a.redRuns > 0) return cheat('It ran red lights.', rewards.red, 'red-light');
  if (a.wrongWays > 0) return cheat('It went the wrong way down a one-way street.', rewards.wrong, 'wrong-way');
  return a.seconds < GOAL_SECONDS ? 'Clean, fast and legal. That is a fixed taxi.' : 'Legal, but not fast enough. Try a higher cost per second.';
}

// What to try next on the end card. One cheat: nextStepOf's line. Several fine cheats: all of them named, not only the first.
export function hintOf(rewards, a) {
  const fined = [a.offTiles && 'park and footpath', a.redRuns && 'red-light', a.wrongWays && 'wrong-way'].filter(Boolean);
  if (!a.arrived || fined.length < 2) return nextStepOf(rewards, a);
  return `It used ${fined.length} loopholes. Add or raise the ${fined.slice(0, -1).join(', ')} and ${fined.at(-1)} fines.`;
}
