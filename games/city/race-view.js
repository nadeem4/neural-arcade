// The race on the page: the two meters (left and right), the race bar in the garage and the result banner. Thin DOM code;
// the logic is in race.js. Car A is yellow, car B is pink (TINTS), in the meters and on the minimap.
import { minimapModel, drawMinimap, COLOURS_B } from './minimap.js';
import { meterText } from './meter.js';
import { raceBarLine, bannerLine, TINTS } from './race.js';

const $ = id => document.getElementById(id);
const signed = n => (n > 0 ? '+' : '') + n;
const counts = m => `${m.seconds} s · ${m.counts.tiles} tiles · off ${m.counts.off} · red ${m.counts.red} · wrong ${m.counts.wrong}`;

// The garage's race bar: hidden until a taxi is picked; START RACE waits for two.
export function renderRaceBar(names) {
  $('raceBar').hidden = names.length === 0;
  $('raceLine').textContent = raceBarLine(names);
  $('startRace').disabled = names.length < 2;
}

// The two meters: A in the usual place, B beside it. Each is labelled with its taxi's name.
export function showRaceMeters(on, names = ['', '']) {
  $('meter').hidden = !on; $('meterB').hidden = !on; $('minimap').hidden = !on;
  $('meterLabel').textContent = on ? names[0] : 'earned this trip';
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

// The result banner. It takes focus, so a keyboard or screen reader player lands on the result.
export function showBanner(race, res, names) {
  const t = race.cars.map(c => c.events.totals);
  $('raceTitle').textContent = bannerLine(res, names);
  const line = (i) => `${names[i]}: ${t[i].arrived ? `${t[i].seconds} s` : 'did not arrive'}, earned ${signed(Math.round(t[i].reward * 10) / 10 + 0)}`;
  $('raceDetail').textContent = `${line(0)}. ${line(1)}.`;
  $('raceBanner').hidden = false;
  $('raceBanner').focus({ preventScroll: true });
  return $('raceTitle').textContent;
}
