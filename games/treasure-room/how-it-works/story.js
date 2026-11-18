// "How it works" for Treasure Room: every figure comes from story.json, one seeded run recorded by story-data.js, so
// the pictures match the words on every visit. The figures are still, so they only redraw on resize and theme change.
import { wireLamp } from '../../../assets/theme.js';
import { makeGrid } from '../../../assets/grid.js';
import { sizeCanvas } from '../../racer/track-view.js';
import { drawRoom } from '../room-view.js';
import { heatOf } from '../level-value.js';
import { actionArrow, logLine } from '../words.js';

const $ = id => document.getElementById(id);
const S = await (await fetch('../story.json')).json();
const room = makeGrid(S.room);
const START = S.triples[0].state;
const num = n => (n < 0 ? `−${-n}` : `${n}`);

function draw(canvas, opts = {}) {
  const { dpr, w } = sizeCanvas(canvas, 1), ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, w);
  drawRoom(ctx, room, { cell: w / room.w, ...opts });
}

const draws = [];
const add = (id, opts) => { draws.push(() => draw($(id), opts)); draws.at(-1)(); };

// ---------- Fig. 1: the agent and the room ----------
const walkCells = [START, ...S.agent.trace.map(t => t.pos)];
$('walkSteps').textContent = S.agent.trace.length;
$('walkTotal').textContent = num(S.agent.total);
add('canvasRoom', { agent: START, ghost: walkCells });

// ---------- Fig. 2: state, action, reward ----------
$('triples').innerHTML = S.triples.map(t => `<li>${logLine({ pos: t.state, action: t.action, reward: t.reward })}</li>`).join('');

// ---------- Fig. 3: return and discount ----------
const R = S.returns;
$('shortSteps').textContent = R.shortCells.length - 1;
$('detourSteps').textContent = R.detourCells.length - 1;
$('returnRows').innerHTML = R.gammas.map((g, i) =>
  `<tr><th scope="row">${g}</th><td>${num(R.short[i].total)}</td><td>${num(R.detour[i].total)}</td><td>${num(R.short[i].terms.at(-1))}</td></tr>`).join('');
add('canvasRoutes', { agent: START, ghost: [R.shortCells, R.detourCells] });

// ---------- Fig. 4: a policy ----------
for (const [id, key] of [['policyBad', 'bad'], ['policyFixed', 'fixed']]) {
  const run = S.policy[`${key}Run`];
  $(id).setAttribute('aria-label', `Arrows for each tile. ${run.outcome === 'treasure' ? `The robot reaches the treasure in ${run.cells.length - 1} steps.` : 'The robot never reaches the treasure.'}`);
  add(id, { agent: START, policy: S.policy[key], ghost: run.cells });
}
$('fixedSteps').textContent = S.policy.fixedRun.cells.length - 1;

// ---------- Fig. 5: value spreads outward ----------
const snaps = S.value.snapshots, minis = $('sweepGrids');
snaps.forEach(sn => {
  const d = document.createElement('div');
  d.className = 'mini';
  d.innerHTML = `<canvas class="grid" role="img" aria-label="Values after ${sn.sweep} sweeps"></canvas><p class="mini-cap">Sweep ${sn.sweep}</p>`;
  minis.append(d);
  const canvas = d.querySelector('canvas');
  draws.push(() => draw(canvas, { values: sn.values, heat: heatOf(sn.values, room) }));
  draws.at(-1)();
});
$('settleSweeps').textContent = S.value.settle;
$('startValue').textContent = num(snaps.at(-1).values[START.y * room.w + START.x]);
let at = -1;
$('stepThrough').addEventListener('click', () => {
  at = (at + 1) % snaps.length;
  [...minis.children].forEach((d, i) => d.classList.toggle('on', i === at));
  const sn = snaps[at], good = sn.values.filter(v => v > 0).length;
  $('stepNote').textContent = `After ${sn.sweep} sweep${sn.sweep === 1 ? '' : 's'}: ${good} tile${good === 1 ? '' : 's'} worth more than 0.`;
});

// ---------- Fig. 6: the icy floor ----------
const M = S.mdp;
for (const [id, key] of [['planDry', 'dry'], ['planIcy', 'icy']]) {
  $(id).setAttribute('aria-label', `The best route on a ${key === 'dry' ? 'dry' : 'icy'} floor${M[key].pitAdjacent ? ', passing next to the pit' : ', keeping away from the pit'}.`);
  add(id, { agent: START, ghost: M[key].cells, ice: key === 'icy' });
}
$('dryValue').textContent = num(M.dry.startValue);
$('icyValue').textContent = num(M.icy.startValue);
$('dryPit').textContent = `${M.trips.dry.pit} of them`;
$('icyPit').textContent = `${M.trips.icy.pit} of them`;
document.querySelectorAll('.n-trips').forEach(el => { el.textContent = M.trips.n; });
$('seed').textContent = S.seed;

// ---------- Redraw on resize and theme change ----------
const redraw = () => draws.forEach(fn => fn());
new ResizeObserver(redraw).observe(document.body);
wireLamp($('lamp'), redraw);
