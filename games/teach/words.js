// What the caption on the track says as the game moves between its three steps, so no step starts unannounced.
export const lapDoneNote = n => `Lap complete! Next, step 2: it learns from your ${n} examples.`;
export const learningNote = (pass, total) => `Step 2: learning. Pass ${pass} of ${total}`;
export const drivesNote = () => 'Step 3: now it drives on its own. Take the wheel if it heads for trouble.';
export const retrainNote = (n, corrections) => `Step 2 again: it learns from all ${n} examples, including your ${corrections} corrections.`;
// How one of the brain's drives ended. Two clean laps on your track move it on to a track it has never seen
// (the real test); two clean laps there end the step; a crash means it goes again, so you can take the wheel.
export function testEndNote(end, onNewTrack) {
  if (end !== 'finished') return 'It crashed at the red cross. It goes again in a moment: take the wheel just before the cross, then press Retrain.';
  return onNewTrack
    ? 'Done: two laps on a track it never saw. It learned to drive, not just your track. Try New track, or change the learning rate.'
    : 'Two laps on your track. Now the real test: a track it has never seen.';
}
export const relearnNote = (lr, n) => `New learning rate (${lr}): learning your same ${n} examples again, from scratch.`;
