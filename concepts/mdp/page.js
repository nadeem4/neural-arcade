import { triesHtml, wireTries } from '../../assets/concept-page.js';
import { presets, mountPlayground } from './play.js';
import { figureHtml } from './figures.js';
document.getElementById('figure').innerHTML = figureHtml() + '<figcaption>One seeded run of twenty days, and the odds that drive it</figcaption>';
document.getElementById('tries').innerHTML = triesHtml(presets);
const { apply } = mountPlayground(document.getElementById('playground'));
wireTries(document.getElementById('tries'), presets, apply);
