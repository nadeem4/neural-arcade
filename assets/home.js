// The arcade home: renders Continue, the three tracks and the Play / Read / Watch line from the track configs and saved progress,
// and plays the hero game's recorded run on the demo stage.
import { GAMES, heroOf } from './games.js';
import { TRACKS } from './tracks/index.js';
import { loadProgress, continueTarget } from './tracks/progress.js';
import { heroActionsHtml, stageHeadHtml, continueHtml, trackRowHtml, flowHtml } from './home-view.js';
import { mountSite } from './site.js';

mountSite('');
const done = loadProgress();
document.getElementById('continue').innerHTML = continueHtml(continueTarget(done));
document.getElementById('tracks').innerHTML = TRACKS.map(t => trackRowHtml(t, done)).join('');
document.getElementById('flow').innerHTML = flowHtml();

// The demo stage: the hero game's own demo.js plays a recorded run on the canvas and fills the side panel.
// Its words (title, network, what it learns, panel heading, alt text) come from the hero's demo config.
// A hero with no demo (only if no game has one) gets no stage.
const hero = heroOf(GAMES);
document.getElementById('hero-actions').innerHTML = heroActionsHtml(hero);
const demo = hero.demo;
if (!demo) document.querySelector('.stage').hidden = true;
else {
  document.getElementById('stage-head').innerHTML = stageHeadHtml(hero);
  document.getElementById('demo').setAttribute('aria-label', demo.alt);
  document.getElementById('panel-title').textContent = demo.panel;
  const { startDemo } = await import(`../${hero.path}demo.js`);
  startDemo(document.getElementById('demo'), document.getElementById('moves'));
}
