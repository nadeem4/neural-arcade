import { figureHtml } from './figures.js';
document.getElementById('figure').innerHTML = figureHtml(7) + '<figcaption>A real run: the agent acts, the world answers with a reward</figcaption>';
