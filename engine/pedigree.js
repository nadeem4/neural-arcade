// Pedigree chart: the leader on the bottom row, its parents above, their parents above that.
// Each node gets a horizontal span; parents split their child's span, so a family stays together.

export function layoutPedigree(tree, { width, rows }) {
  const nodes = [], links = [];
  const place = (t, depth, a, b) => {
    const node = { ...t.node, row: rows - 1 - depth, x: (a + b) / 2 };
    nodes.push(node);
    const k = t.parents.length;
    t.parents.forEach((p, i) => {
      const parent = place(p, depth + 1, a + ((b - a) * i) / k, a + ((b - a) * (i + 1)) / k);
      links.push({ from: parent, to: node });
    });
    return node;
  };
  if (tree) place(tree, 0, 0, width);
  return { nodes, links };
}

export function scoreLabel(pct) {
  const laps = Math.round(pct) / 100;
  return `${laps} ${laps === 1 ? 'lap' : 'laps'}`;
}

// Node marks: square = kept unchanged, circle = bred from two parents, diamond = random newcomer.
export function markPath(kind, x, y, r) {
  if (kind === 'kept') return `M${x - r} ${y - r}h${2 * r}v${2 * r}h${-2 * r}Z`;
  if (kind === 'new') return `M${x} ${y - r * 1.25}L${x + r * 1.25} ${y}L${x} ${y + r * 1.25}L${x - r * 1.25} ${y}Z`;
  return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
}

export function pedigreeSvg(tree, { width, rowGap = 88, rows = 3, r = 13 }) {
  const { nodes, links } = layoutPedigree(tree, { width, rows });
  const top = 22, y = row => top + row * rowGap, height = top + (rows - 1) * rowGap + 40;
  let s = `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Pedigree of the leading car" style="--row-gap:${rowGap}px">`;
  if (!links.length) {
    s += `<text class="ped-empty" x="${width / 2}" y="${y(0) + 6}" text-anchor="middle">No parents yet: a random newcomer.</text>`;
  }
  s += '<g class="ped-links">';
  for (const { from, to } of links) {
    const y1 = y(from.row) + r + 26, y2 = y(to.row) - r - 5, mid = (y1 + y2) / 2;
    s += `<path class="ped-link" d="M${from.x} ${y1}V${mid}H${to.x}V${y2}"/>`;
  }
  s += '</g>';
  for (let row = 0; row < rows; row++) {
    s += `<g class="ped-row ped-row-${rows - 1 - row}">`;
    for (const n of nodes.filter(n => n.row === row)) {
      const cls = ['ped-node', n.live ? 'is-leader' : '', n.crashed ? 'is-crashed' : ''].join(' ');
      s += `<path class="${cls}" d="${markPath(n.kind, n.x, y(n.row), r)}"/>`;
      if (n.crashed) s += `<path class="ped-strike" d="M${n.x - r - 3} ${y(n.row) + r + 3}L${n.x + r + 3} ${y(n.row) - r - 3}"/>`;
      s += `<text class="ped-score" data-id="${n.id}" x="${n.x}" y="${y(n.row) + r + 19}" text-anchor="middle">${scoreLabel(n.score)}</text>`;
    }
    s += '</g>';
  }
  return s + '</svg>';
}

// Score text only, so a live redraw does not rebuild (or re-animate) the chart.
export function updateScores(container, tree) {
  const walk = t => { if (!t) return; const el = container.querySelector(`.ped-score[data-id="${t.node.id}"]`);
    if (el) el.textContent = scoreLabel(t.node.score); t.parents.forEach(walk); };
  walk(tree);
}
