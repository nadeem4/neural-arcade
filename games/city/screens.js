// Which screen the game is on: map (rate card), training, driving, done (end card), racing, raced (race result). No DOM.
const NEXT = {
  map: { train: 'training', replay: 'driving', race: 'racing' },
  training: { trained: 'driving', failed: 'map' },
  driving: { skip: 'done', arrived: 'done', replay: 'driving', race: 'racing' },
  racing: { finished: 'raced', skip: 'raced', train: 'training', replay: 'driving', race: 'racing' },
  raced: { race: 'racing', replay: 'driving', edit: 'map', train: 'training' },
  done: { again: 'driving', replay: 'driving', edit: 'map', train: 'training', race: 'racing' },
};

// An event that does not apply on this screen leaves it where it is.
export const nextScreen = (state, event) => NEXT[state]?.[event] ?? state;

// The Map view toggle only makes sense while a taxi (or two, in a race) drives.
export const canToggleView = state => state === 'driving' || state === 'racing';
