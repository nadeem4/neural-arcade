// The arcade home: renders the hero, categories and chips from the games data, and plays the hero game's recorded run on the demo stage.
import { CATEGORIES, GAMES, homeModel } from './games.js';
import { heroActionsHtml, stageHeadHtml, categoryHtml, chipsHtml } from './home-view.js';
import { mountSite } from './site.js';

mountSite('');
const model = homeModel(CATEGORIES, GAMES);
document.getElementById('hero-actions').innerHTML = heroActionsHtml(model.hero);
document.getElementById('categories').innerHTML = model.categories.map(categoryHtml).join('');
document.getElementById('chips').innerHTML = chipsHtml(model.chips);

// The demo stage: the hero game's own demo.js plays a recorded run on the canvas and fills the side panel.
// Its words (title, network, what it learns, panel heading, alt text) come from the hero's demo config.
// A hero with no demo (only if no game has one) gets no stage.
const demo = model.hero.demo;
if (!demo) document.querySelector('.stage').hidden = true;
else {
  document.getElementById('stage-head').innerHTML = stageHeadHtml(model.hero);
  document.getElementById('demo').setAttribute('aria-label', demo.alt);
  document.getElementById('panel-title').textContent = demo.panel;
  const { startDemo } = await import(`../${model.hero.path}demo.js`);
  startDemo(document.getElementById('demo'), document.getElementById('moves'));
}
