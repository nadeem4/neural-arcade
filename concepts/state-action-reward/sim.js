// What the agent sees from one cell: its state id and what each of the four actions leads to. Pure, no DOM.
import { ACTIONS, move, stateId } from '../../assets/grid.js';

export function describeCell(grid, pos) {
  return {
    state: stateId(grid, pos),
    options: ACTIONS.map((_, action) => {
      const r = move(grid, pos, action);
      return { action, to: r.pos, reward: r.reward };
    }),
  };
}
