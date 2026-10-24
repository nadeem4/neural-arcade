import { weightIndex } from './tinynet.js';

// Draws any small dense net: lines are weights, brightness is the signal flowing through them now
// (|weight × incoming activation|). Solid lines push up, dashed lines push down. Node fill is activation;
// a dash through a node marks a negative value. Optional `heads` title the columns; `inWords`/`outWords`
// turn a value into plain words for newcomers.
export function drawBrain(ctx, { sizes, genome, acts, inLabels = [], outLabels = [], heads = [], inWords, outWords, theme, width, height }) {
  ctx.clearRect(0, 0, width, height);
  if (!genome) return;
  // Narrow panels (phones) move the output text under the network, so nothing runs off the edge.
  const below = !!outWords && width < 380, foot = below ? 62 : 0;
  const left = inLabels.length ? Math.min(inWords ? 128 : 96, width * (below ? 0.4 : 0.36)) : 16;
  const right = outLabels.length && !below ? Math.min(inWords ? 112 : 92, width * 0.3) : 16;
  const top = heads.length ? 22 : 0, mid = top + (height - top - foot) / 2;
  const xs = sizes.map((_, l) => left + ((width - left - right) * l) / (sizes.length - 1));
  const ys = sizes.map(n => {
    const gap = Math.min(34, (height - top - foot - 24) / Math.max(1, n - 1));
    return Array.from({ length: n }, (_, i) => mid + (i - (n - 1) / 2) * gap);
  });

  for (let l = 0; l < sizes.length - 1; l++) {
    for (let j = 0; j < sizes[l + 1]; j++) {
      for (let i = 0; i < sizes[l]; i++) {
        const w = genome[weightIndex(sizes, l, i, j)];
        ctx.globalAlpha = 0.06 + 0.9 * Math.min(1, Math.abs(w * acts[l][i]));
        ctx.strokeStyle = theme.ink;
        ctx.setLineDash(w >= 0 ? [] : [4, 4]);
        ctx.lineWidth = 0.6 + 1.6 * Math.min(1, Math.abs(w) / 2);
        ctx.beginPath(); ctx.moveTo(xs[l], ys[l][i]); ctx.lineTo(xs[l + 1], ys[l + 1][j]); ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);

  for (let l = 0; l < sizes.length; l++) {
    for (let i = 0; i < sizes[l]; i++) {
      const a = acts[l][i], x = xs[l], y = ys[l][i];
      ctx.fillStyle = theme.ground;
      ctx.fillRect(x - 7, y - 7, 14, 14);
      ctx.globalAlpha = Math.min(1, Math.abs(a));
      ctx.fillStyle = theme.ink;
      ctx.fillRect(x - 7, y - 7, 14, 14);
      ctx.globalAlpha = 1;
      if (a < -0.05) { ctx.fillStyle = theme.ground; ctx.fillRect(x - 4, y - 1, 8, 2); }
      ctx.strokeStyle = theme.ink; ctx.lineWidth = 1.2;
      ctx.strokeRect(x - 7, y - 7, 14, 14);
    }
  }

  ctx.textBaseline = 'middle';
  const last = sizes.length - 1, num = v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`;
  if (heads.length) {
    ctx.font = `600 11px ${theme.body}`; ctx.fillStyle = theme.muted;
    const hx = [0, xs[Math.floor(last / 2) || 1], width], align = ['left', 'center', 'right'];
    heads.forEach((t, i) => {
      // Narrow: "What it does" moves down to head the outputs written under the network.
      if (below && i === 2) { ctx.textAlign = 'left'; ctx.fillText(t.toUpperCase(), 0, height - 56); return; }
      ctx.textAlign = align[i]; ctx.fillText(t.toUpperCase(), hx[i], 8);
    });
  }
  ctx.font = `500 ${below ? 12 : 13}px ${theme.body}`;
  ctx.fillStyle = theme.muted; ctx.textAlign = 'right';
  inLabels.forEach((t, i) => ctx.fillText(inWords ? `${t} · ${inWords(i, acts[0][i])}` : t, xs[0] - 14, ys[0][i]));
  ctx.textAlign = 'left';
  outLabels.forEach((t, k) => {
    const v = acts[last][k], x = below ? (width / outLabels.length) * k : xs[last] + 14, y = below ? height - 30 : ys[last][k];
    ctx.fillStyle = theme.ink; ctx.fillText(outWords ? `${t} ${num(v)}` : t, x, y - 9);
    ctx.fillStyle = outWords ? theme['amber-ink'] || theme.amber : theme.muted;
    ctx.fillText(outWords ? outWords(k, v) : num(v), x, y + 9);
  });
}
