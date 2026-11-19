// Pure draw lists for the How it works figures, built from story.json. Cells are [col, row].
const xy = (cols) => (n) => [n % cols, Math.floor(n / cols)];

export function figureModel(story) {
  const { cols, rows, kind, oneway, signals, pickup, dropoff } = story.map;
  const toXY = xy(cols);
  const byKind = {};
  const arrows = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      (byKind[kind[r][c]] ||= []).push([c, r]);
      if ('NESW'.includes(oneway[r][c])) arrows.push({ cell: [c, r], dir: oneway[r][c] });
    }
  }
  const tiles = Object.entries(byKind).map(([k, cells]) => ({ kind: k, cells }));
  const card = (i) => story.cards[i];
  const drawn = (c) => ({ id: c.id, polyline: c.route.cells.map(toXY), receipt: c.receipt, verdict: c.verdict });
  const heatRows = (h) => Array.from({ length: rows }, (_, r) => h.slice(r * cols, (r + 1) * cols));
  return {
    fig1: { cols, rows, tiles, oneway: arrows, signals, pickup, dropoff },
    fig2: { cols, rows, snapshots: story.learning.episodes.map((episode, i) => ({ episode, digits: heatRows(story.learning.heat[i]) })) },
    fig3: [0, 1, 2].map(i => drawn(card(i))),
    fig4: { loop: drawn(card(4)), legal: drawn(card(3)) },
    fig5: story.cards.map(c => ({ id: c.id, score: c.city.score, scared: c.city.scared, arrived: c.city.arrived, onTime: c.city.onTime, seconds: c.analysis.seconds })),
  };
}
