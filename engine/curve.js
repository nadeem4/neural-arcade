// Per-generation bar chart. `max` is the top of the scale, drawn as a dashed reference line.
export function drawBars(ctx, values, { width, height, max, maxLabel, empty, theme, slots = 30 }) {
  ctx.clearRect(0, 0, width, height);
  ctx.font = `400 13px ${theme.body}`;
  ctx.textBaseline = 'middle';
  if (!values.length) {
    ctx.fillStyle = theme.muted; ctx.textAlign = 'left';
    ctx.fillText(empty, 0, height / 2);
    return;
  }
  const shown = values.slice(-slots), offset = values.length - shown.length;
  const top = 14, bottom = height - 22, slot = width / slots, bw = Math.max(2, slot - 3);
  const y = v => bottom - (v / max) * (bottom - top);

  ctx.strokeStyle = theme.rule; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(0, y(max)); ctx.lineTo(width, y(max)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(0, bottom + 0.5); ctx.lineTo(width, bottom + 0.5); ctx.stroke();
  ctx.fillStyle = theme.muted; ctx.textAlign = 'right';
  ctx.fillText(maxLabel, width, y(max) - 8);

  ctx.fillStyle = theme.amber;
  shown.forEach((v, i) => { if (v > 0) ctx.fillRect(i * slot, y(v), bw, bottom - y(v)); });

  ctx.fillStyle = theme.muted;
  ctx.textAlign = 'left'; ctx.fillText(`Gen ${offset + 1}`, 0, height - 8);
  ctx.textAlign = 'right'; ctx.fillText(`Gen ${values.length}`, width, height - 8);
}

// Line chart for a value per step (Teach by Driving's loss per epoch). The scale starts at zero, so a falling line means real progress.
export function drawLine(ctx, values, { width, height, empty, theme, first = 'Start', last = n => `${n}`, format = v => v.toFixed(3), max: top0 }) {
  ctx.clearRect(0, 0, width, height);
  ctx.font = `400 13px ${theme.body}`;
  ctx.textBaseline = 'middle';
  if (!values.length) {
    ctx.fillStyle = theme.muted; ctx.textAlign = 'left';
    ctx.fillText(empty, 0, height / 2);
    return;
  }
  const max = top0 ?? (Math.max(...values) || 1), top = 14, bottom = height - 22; // pass `max` to share a scale across charts
  const x = i => (values.length === 1 ? 0 : (i / (values.length - 1)) * width);
  const y = v => bottom - (v / max) * (bottom - top);
  ctx.strokeStyle = theme.rule; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, bottom + 0.5); ctx.lineTo(width, bottom + 0.5); ctx.stroke();
  ctx.fillStyle = theme.muted; ctx.textAlign = 'left';
  ctx.fillText(format(max), 0, top - 6);

  ctx.strokeStyle = theme.ink; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  ctx.beginPath();
  values.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
  ctx.stroke();
  const end = values.length - 1;
  ctx.fillStyle = theme.ink; ctx.fillRect(x(end) - 3, y(values[end]) - 3, 6, 6);

  ctx.fillStyle = theme.muted;
  ctx.textAlign = 'left'; ctx.fillText(first, 0, height - 8);
  ctx.textAlign = 'right'; ctx.fillText(last(values.length - 1), width, height - 8);
}
