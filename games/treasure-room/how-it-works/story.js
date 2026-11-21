// "How it works" for Treasure Room: the words and numbers come from story.json, one seeded run recorded by story-data.js. The figures are
// still images (fig-N.webp) captured from the 3D room (see ../shots.js); nothing is drawn here.
import { wireLamp } from '../../../assets/theme.js';
import { actionArrow, logLine } from '../words.js';

const $ = id => document.getElementById(id);
const S = await (await fetch('../story.json')).json();
const START = S.triples[0].state;
const num = n => (n < 0 ? `−${-n}` : `${n}`);

// ---------- Fig. 1: the agent and the room ----------
$('walkSteps').textContent = S.agent.trace.length;
$('walkTotal').textContent = num(S.agent.total);

// ---------- Fig. 2: state, action, reward ----------
$('triples').innerHTML = S.triples.map(t => `<li>${logLine({ pos: t.state, action: t.action, reward: t.reward })}</li>`).join('');

// ---------- Fig. 3: return and discount ----------
const R = S.returns;
$('shortSteps').textContent = R.shortCells.length - 1;
$('detourSteps').textContent = R.detourCells.length - 1;
$('returnRows').innerHTML = R.gammas.map((g, i) =>
  `<tr><th scope="row">${g}</th><td>${num(R.short[i].total)}</td><td>${num(R.detour[i].total)}</td><td>${num(R.short[i].terms.at(-1))}</td></tr>`).join('');

// ---------- Fig. 4: a policy ----------
$('fixedSteps').textContent = S.policy.fixedRun.cells.length - 1;

// ---------- Fig. 5: value spreads outward ----------
const snaps = S.value.snapshots;
$('settleSweeps').textContent = S.value.settle;
$('startValue').textContent = num(snaps.at(-1).values[START.y * S.room[0].length + START.x]);

// ---------- Fig. 6: the icy floor ----------
const M = S.mdp;
$('dryValue').textContent = num(M.dry.startValue);
$('icyValue').textContent = num(M.icy.startValue);
$('dryPit').textContent = `${M.trips.dry.pit} of them`;
$('icyPit').textContent = `${M.trips.icy.pit} of them`;
document.querySelectorAll('.n-trips').forEach(el => { el.textContent = M.trips.n; });
$('seed').textContent = S.seed;

// ---------- Theme lamp ----------
wireLamp($('lamp'), () => {});
