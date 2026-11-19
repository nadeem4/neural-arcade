// What the city actually wanted from the trip, as a score out of 100. Pure, no DOM.
// The taxi is paid by the reward you write; this score is the real goal, so the two can drift apart.
export const ARRIVE_POINTS = 60;   // it got there
export const ON_TIME_POINTS = 20;  // and under the goal time, legally
export const CLEAN_POINTS = 20;    // arrived with no park, red-light or wrong-way moves
export const SCARE_MAX = 30;       // the most scared people can take off, so a trip that arrives never scores as low as one that never does
export const SCARE_COST = 5;       // per scared person (people.js)

const clamp0 = (n) => Math.max(0, n);
const scareCost = (n) => Math.min(SCARE_MAX, SCARE_COST * n);
const countOf = (s) => (Array.isArray(s) ? s.length : s | 0);

function score({ arrived, seconds, off, red, wrong, scares, goalSeconds }) {
  const clean = off + red + wrong === 0;
  const onTime = arrived && clean && seconds < goalSeconds; // the goal is a legal trip under the time
  const parts = {
    arrive: arrived ? ARRIVE_POINTS : 0,
    onTime: onTime ? ON_TIME_POINTS : 0,
    clean: arrived && clean ? CLEAN_POINTS : 0, // a clean trip has to arrive
    scared: scares ? -scareCost(scares) : 0,
  };
  return { arrived, onTime, violations: { off, red, wrong }, scared: scares, score: clamp0(parts.arrive + parts.onTime + parts.clean + parts.scared), parts };
}

// The end value, from the trip's analysis (analyzeRoute / tripEvents totals) and the people it scared.
export function trueGoal({ analysis, scares = [], goalSeconds }) {
  const a = analysis;
  return score({ arrived: a.arrived, seconds: a.seconds, off: a.offTiles, red: a.redRuns, wrong: a.wrongWays, scares: countOf(scares), goalSeconds });
}

// The live value, `f` steps into the drive: the best final score still possible, so it starts at 100 and only falls.
// Arriving is assumed until the last step, where it equals trueGoal's (a trip that never arrived drops to its true score).
export function goalAt(events, scaresSoFar, f, goalSeconds) {
  const whole = Math.min(events.steps.length, Math.max(0, Math.floor(f)));
  const scares = countOf(scaresSoFar);
  let off = 0, red = 0, wrong = 0, arrived = false;
  for (let i = 0; i < whole; i++) {
    const s = events.steps[i];
    if (s.off) off++;
    if (s.red) red++;
    if (s.wrong) wrong++;
    if (s.done) arrived = true;
  }
  if (whole >= events.steps.length) return score({ arrived, seconds: whole, off, red, wrong, scares, goalSeconds }).score;
  const clean = off + red + wrong === 0;
  const onTime = clean && whole < goalSeconds;
  return clamp0(ARRIVE_POINTS + (onTime ? ON_TIME_POINTS : 0) + (clean ? CLEAN_POINTS : 0) - scareCost(scares));
}
