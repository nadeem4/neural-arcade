// Where the old category/ and concepts/ list pages send a visitor. Paths are from the site root; the stubs add the way back up.
import { flatLessons } from './tracks/model.js';

const TRACK_OF_CATEGORY = { 'how-ai-learns': 'neural-networks', 'physical-ai': 'physical-ai', 'reinforcement-learning': 'reinforcement-learning' };

// category/?c=<old category id>: its track page, else All games.
export function categoryTarget(search) {
  const track = TRACK_OF_CATEGORY[new URLSearchParams(search).get('c')];
  return track ? `${track}/` : 'games/';
}

// concepts/#<lesson id>: that lesson's page when it is live, else the home page ('').
export function conceptsTarget(hash) {
  const id = hash.replace(/^#/, '');
  return flatLessons().some(l => l.id === id && l.status === 'live') ? `concepts/${id}/` : '';
}
