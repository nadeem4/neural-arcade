// Which screen the game is on: map (rate card), training, driving, done (end card). No DOM.
const NEXT = {
  map: { train: 'training', replay: 'driving' },
  training: { trained: 'driving', failed: 'map' },
  driving: { skip: 'done', arrived: 'done', replay: 'driving' },
  done: { again: 'driving', replay: 'driving', edit: 'map', train: 'training' },
};

// An event that does not apply on this screen leaves it where it is.
export const nextScreen = (state, event) => NEXT[state]?.[event] ?? state;

// The Map view toggle only makes sense while the taxi drives.
export const canToggleView = state => state === 'driving';
