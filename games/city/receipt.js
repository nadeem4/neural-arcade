// The trip receipt and the one-sentence verdict, from the pay slip and analyzeRoute's result.
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
    if (rewards.fare <= 0) return 'It never arrived. Nothing pays it for the drop-off, so it has no reason to go there.';
    const fines = rewards.off * a.offTiles + rewards.red * a.redRuns + rewards.wrong * a.wrongWays;
    return fines >= rewards.fare
      ? 'It never arrived. The fines outweigh the fare, so not driving looks like the best deal.'
      : 'It never arrived.';
  }
  const tail = rewards.off > 0 ? 'the fine costs less than the time it saves.' : 'nobody fined that.';
  if (a.parkTiles > 0) return `It cut across the park: ${tail}`;
  if (a.offTiles > 0) return `It drove along the footpaths: ${tail}`;
  if (a.redRuns > 0) return 'It ran red lights: they cost less than waiting.';
  if (a.wrongWays > 0) return 'It went the wrong way down a one-way street to save time.';
  return 'Legal trip: no fines.';
}
