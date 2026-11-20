import { triesHtml, wireTries } from '../../assets/concept-page.js';
import { presets, mountPlayground } from './play.js';
import { figureHtml } from './figures.js';
document.getElementById('figure').innerHTML = figureHtml(7) + '<figcaption>A real run: the agent acts, the world answers with a reward</figcaption>';
document.getElementById('tries').innerHTML = triesHtml(presets);
const { apply } = mountPlayground(document.getElementById('playground'));
wireTries(document.getElementById('tries'), presets, apply);
