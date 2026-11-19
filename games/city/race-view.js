// The race on the page: the two meters (left and right), the race bar in the garage and the result banner. Thin DOM code;
// the logic is in race.js. Car A is yellow, car B is pink (TINTS), in the meters and on the minimap.
import { minimapModel, drawMinimap, COLOURS_B } from './minimap.js';
import { meterText } from './meter.js';
import { raceBarLine, bannerLine, TINTS } from './race.js';
import { trueGoal } from './goal.js';
import { GOAL_SECONDS } from './presets.js';
import { signed } from './receipt.js';

const $ = id => document.getElementById(id);
const counts = m => `${m.seconds} s · ${m.counts.tiles} tiles · footpath ${m.counts.off} · red light ${m.counts.red} · wrong way ${m.counts.wrong}`;

// The garage's race bar: hidden until a taxi is picked; Start race waits for two.
export function renderRaceBar(names) {
  $('raceBar').hidden = names.length === 0;
  $('raceLine').textContent = raceBarLine(names);
  $('startRace').disabled = names.length < 2;
}

// The two meters: A in the usual place, B beside it. Each is labelled with its taxi's name.
export function showRaceMeters(on, names = ['', '']) {
  $('meter').hidden = !on; $('meterB').hidden = !on; $('minimap').hidden = !on;
  $('meterLabel').textContent = on ? names[0] : 'this trip';
  $('meterBLabel').textContent = names[1];
  $('meterTotal').style.color = on ? TINTS[0].css : '';
  if (!on) for (const id of ['meter', 'meterB']) $(id).classList.remove('leading');
}

// One frame of the race: both meters, the leader's ring, and both routes on the one minimap.
export function updateRaceHud(world, race, rs) {
  const [a, b] = rs.cars;
  $('meterTotal').textContent = meterText(a.meter.total); $('meterCounts').textContent = counts(a.meter);
  $('meterBTotal').textContent = meterText(b.meter.total); $('meterBCounts').textContent = counts(b.meter);
  $('meter').classList.toggle('leading', rs.leader === 0);
  $('meterB').classList.toggle('leading', rs.leader === 1);
  const c = $('minimap'), ctx = c.getContext('2d'), fit = race.cars.map(x => x.entry.route);
  const model = i => minimapModel(world, race.cars[i].entry.route, rs.cars[i].state.progress, race.cars[i].events, fit);
  drawMinimap(ctx, model(0), c.width);
  drawMinimap(ctx, model(1), c.width, COLOURS_B, { clear: false });
}

// What a taxi did that was against the rules, in words: "ran 3 red lights, went the wrong way on 10 tiles", or "legal".
const did = (t) => {
  if (!t.arrived) return 'did not arrive';
  const out = [
    t.offTiles && `drove ${plural(t.offTiles, 'tile')} on footpaths`,
    t.redRuns && `ran ${plural(t.redRuns, 'red light')}`,
    t.wrongWays && `went the wrong way on ${plural(t.wrongWays, 'tile')}`,
  ].filter(Boolean);
  return out.length ? out.join(', ') : 'legal';
};
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const score = (t, scared) => trueGoal({ analysis: t, scares: scared, goalSeconds: GOAL_SECONDS }).score; // scared: the people that car frightened, as the end card counts them

// The line under the result: each taxi's time and whether it kept to the rules; when the winner broke them, what the city scored.
// A dead heat is not decided by pay, and says so.
export function raceDetailOf(res, t, names, scares = [0, 0]) {
  const line = (i) => `${names[i]}: ${t[i].arrived ? `${t[i].seconds} s, ${did(t[i])}` : did(t[i])}`;
  const heat = res.winner === 'tie' && res.reason === 'time' && t[0].reward !== t[1].reward ? ' Same time, so nobody wins. Pay does not decide a race.' : '';
  let city = '';
  if (res.winner !== 'tie' && did(t[res.winner]) !== 'legal') {
    const w = res.winner, l = 1 - w;
    city = ` ${res.reason === 'time' ? 'Faster, but the' : 'But the'} city scored it ${score(t[w], scares[w])}. ${names[l]} scored ${score(t[l], scares[l])}.`;
  }
  return `${line(0)}. ${line(1)}.${heat}${city}`;
}

// The result banner. It takes focus, so a keyboard or screen reader player lands on the result.
export function showBanner(race, res, names, scares = [0, 0]) {
  const t = race.cars.map(c => c.events.totals);
  $('raceTitle').textContent = bannerLine(res, names);
  $('raceDetail').textContent = raceDetailOf(res, t, names, scares);
  $('raceBanner').hidden = false;
  $('raceBanner').focus({ preventScroll: true });
  return `${$('raceTitle').textContent} ${$('raceDetail').textContent}`; // the live region reads the detail too
}
