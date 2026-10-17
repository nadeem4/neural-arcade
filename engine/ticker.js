// A fixed simulation clock: call it once per animation frame with the frame's timestamp and it says how many
// 60 Hz steps to run, so the cars move at the same speed on 60 Hz, 120 Hz and slower screens.
export function makeTicker(hz = 60, maxSteps = 4) {
  const step = 1000 / hz;
  let last = null, acc = 0;
  return now => {
    if (last === null) { last = now; return 1; }
    acc += Math.min(now - last, step * maxSteps); // after a pause, catch up a little, not all at once
    last = now;
    const n = Math.floor(acc / step);
    acc -= n * step;
    return n;
  };
}
