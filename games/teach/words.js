// What the caption on the track says as the game moves between its three steps, so no step starts unannounced.
export const lapDoneNote = n => `Lap complete! Next, step 2: it learns from your ${n} examples.`;
export const learningNote = (pass, total) => `Step 2: learning. Pass ${pass} of ${total}`;
export const drivesNote = () => 'Step 3: now it drives on its own. Take the wheel if it heads for trouble.';
export const retrainNote = (n, corrections) => `Step 2 again: it learns from all ${n} examples, including your ${corrections} corrections.`;
export const testEndNote = finished => finished
  ? 'Two laps on its own! It drives again in a moment.'
  : 'It crashed at the red cross. It tries again in a moment.';
