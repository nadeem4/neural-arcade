// The three example rulebooks, shared by the playground presets and the figure.
import { GRID, valueIteration, greedyPolicy } from '../../assets/grid.js';
import { createPolicy, setAction, runPolicy } from './sim.js';

const RIGHT = 3, LEFT = 2;
// Right everywhere, but the cell next to the start sends the agent back: it shuffles between two cells.
const bad = setAction(createPolicy(GRID, RIGHT), 1, LEFT);
// Right everywhere: straight along the top row, into the pit.
const risky = createPolicy(GRID, RIGHT);
// The best route, from value iteration; walls and ends have no action (-1), so they get a harmless 0.
const good = greedyPolicy(GRID, valueIteration(GRID, 0.9), 0.9).map(a => (a < 0 ? 0 : a));

export const RULEBOOKS = [
  { label: 'A bad rulebook', policy: bad },
  { label: 'A risky rulebook', policy: risky },
  { label: 'A good rulebook', policy: good },
].map(r => ({ ...r, result: runPolicy(GRID, r.policy) }));
