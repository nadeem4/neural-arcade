// One Treasure Room level (room, readouts, panel, (i) buttons) mounted into any element: the game page mounts it.
// The (i) icon is an SVG <symbol id="i"> that the host page must define once.
import { sizeCanvas } from '../racer/track-view.js';
import { ROOM } from './sim.js';
import { levelByN } from './levels.js';
import { INFO } from './words.js';
import { drawRoom, cellAt } from './room-view.js';
import * as levelAgent from './level-agent.js';
import * as levelTriples from './level-triples.js';
import * as levelReturn from './level-return.js';
import * as levelPolicy from './level-policy.js';
import * as levelValue from './level-value.js';
import * as levelMdp from './level-mdp.js';

const views = { 1: levelAgent, 2: levelTriples, 3: levelReturn, 4: levelPolicy, 5: levelValue, 6: levelMdp }; // the levels built so far
export const BUILT_LEVELS = Object.keys(views).map(Number);

export function levelPanelHtml({ showTitle = true } = {}) {
  return `
    <div class="stage">
      <div class="stage-head"><span class="live"><i></i><b>The room</b></span>
        <span class="stage-tools"><button class="info" type="button" aria-expanded="false" aria-controls="info-room" aria-label="Explain the room" title="What is this?"><svg aria-hidden="true"><use href="#i"/></svg></button></span></div>
      <p class="info-text" id="info-room" data-info="room" hidden></p>
      <div class="stage-body">
        <div class="room">
          <canvas id="stage" role="img" aria-label="A five by five room. The robot starts on the left, the treasure is at the bottom right, there is a pit in the middle and two walls."></canvas>
          <div class="tilegrid" id="tiles" data-levels="4" hidden></div>
        </div>
      </div>
      <p class="say" id="say" aria-live="off"></p>
      <dl class="readouts">
        <div><dt>Steps</dt><dd class="num" id="steps">0</dd></div>
        <div><dt>Score</dt><dd class="num" id="score">0</dd></div>
      </dl>
    </div>

    <aside class="panel" id="levelPanel" aria-label="Controls">
      <section>
        ${showTitle ? '<h2><span id="levelTitle"></span></h2>' : ''}
        <p id="levelBrief"></p>
        <p class="lesson-line" id="status"></p>
      </section>
      <section data-levels="1" aria-labelledby="sh">
        <h2><span id="sh">What the AI sees</span> <button class="info" type="button" aria-expanded="false" aria-controls="info-sees" aria-label="Explain what the AI sees" title="What is this?"><svg aria-hidden="true"><use href="#i"/></svg></button></h2>
        <p class="info-text" id="info-sees" data-info="ai" hidden></p>
        <output class="sees" id="sees">Nothing yet</output>
        <div class="arrows" aria-hidden="true"><span id="arrowOut">action &rarr;</span><span id="arrowBack">&larr; position and reward</span></div>
      </section>
      <section data-levels="2" aria-labelledby="lh" hidden>
        <h2><span id="lh">Log</span> <button class="info" type="button" aria-expanded="false" aria-controls="info-log" aria-label="Explain the log" title="What is this?"><svg aria-hidden="true"><use href="#i"/></svg></button></h2>
        <p class="info-text" id="info-log" data-info="log" hidden></p>
        <ol class="log" id="log" aria-live="off"></ol>
      </section>
      <section class="controls" data-levels="3" aria-labelledby="rh" hidden>
        <h2><span id="rh">Route and discount</span> <button class="info" type="button" aria-expanded="false" aria-controls="info-route" aria-label="Explain routes" title="What is this?"><svg aria-hidden="true"><use href="#i"/></svg></button></h2>
        <p class="info-text" id="info-route" data-info="route" hidden></p>
        <div class="routes" id="routes" role="group" aria-label="Routes">
          <button type="button" data-route="short">Short way</button>
          <button type="button" data-route="detour">Detour</button>
          <button type="button" data-route="pit">Risky way</button>
          <button type="button" id="clear">Draw my own</button>
          <button type="button" id="walk" class="primary">Walk it</button>
        </div>
        <label class="gamma-row" for="gamma">Discount <output id="gammaOut">0.90</output>
          <button class="info" type="button" aria-expanded="false" aria-controls="info-gamma" aria-label="Explain the discount" title="What is this?"><svg aria-hidden="true"><use href="#i"/></svg></button></label>
        <p class="info-text" id="info-gamma" data-info="gamma" hidden></p>
        <input class="gamma" type="range" id="gamma" min="0.1" max="1" step="0.05" value="0.9">
        <p id="gammaHint"></p>
        <output class="sum" id="sum"></output>
        <output class="compare" id="compare"></output>
      </section>
      <section class="controls" data-levels="4" aria-labelledby="ah" hidden>
        <h2><span id="ah">Arrows</span> <button class="info" type="button" aria-expanded="false" aria-controls="info-arrows" aria-label="Explain the arrows" title="What is this?"><svg aria-hidden="true"><use href="#i"/></svg></button></h2>
        <p class="info-text" id="info-arrows" data-info="arrows" hidden></p>
        <div class="row-btns">
          <button class="btn primary" type="button" id="go">Go</button>
          <button class="btn" type="button" id="fix">Let the AI fix it</button>
          <button class="btn" type="button" id="resetArrows">Reset arrows</button>
        </div>
      </section>
      <section class="controls" data-levels="5" aria-labelledby="vh" hidden>
        <h2><span id="vh">Sweep the values</span> <button class="info" type="button" aria-expanded="false" aria-controls="info-sweep" aria-label="Explain sweeping" title="What is this?"><svg aria-hidden="true"><use href="#i"/></svg></button></h2>
        <p class="info-text" id="info-sweep" data-info="sweep" hidden></p>
        <div class="row-btns">
          <button class="btn primary" type="button" id="sweep">Sweep</button>
          <button class="btn" type="button" id="sweep10">Sweep x10</button>
          <button class="btn" type="button" id="walkUp">Walk uphill</button>
          <button class="btn" type="button" id="resetSweeps">Reset</button>
        </div>
        <output class="sweep-info" id="sweepInfo">Sweep 0</output>
        <label class="gamma-row" for="valueGamma">Discount <output id="valueGammaOut">0.90</output>
          <button class="info" type="button" aria-expanded="false" aria-controls="info-vgamma" aria-label="Explain the discount" title="What is this?"><svg aria-hidden="true"><use href="#i"/></svg></button></label>
        <p class="info-text" id="info-vgamma" data-info="gamma" hidden></p>
        <input class="gamma" type="range" id="valueGamma" min="0.1" max="1" step="0.05" value="0.9">
        <p id="valueGammaHint"></p>
        <p class="heat-legend"><i class="heat-bar" aria-hidden="true"></i> faint = worse, bright = better</p>
      </section>
      <section class="controls" data-levels="6" aria-labelledby="mh" hidden>
        <h2><span id="mh">The floor</span> <button class="info" type="button" aria-expanded="false" aria-controls="info-ice" aria-label="Explain the icy floor" title="What is this?"><svg aria-hidden="true"><use href="#i"/></svg></button></h2>
        <p class="info-text" id="info-ice" data-info="ice" hidden></p>
        <div class="row-btns">
          <button class="btn" type="button" id="dry" aria-pressed="true">Dry floor</button>
          <button class="btn" type="button" id="icy" aria-pressed="false">Icy floor</button>
          <button class="btn primary" type="button" id="walkPlan">Walk the plan</button>
        </div>
        <p id="floorNote"></p>
        <div class="row-btns">
          <button class="btn" type="button" id="trips">Run 20 trips</button>
          <button class="btn" type="button" id="showMdp">Show the MDP</button>
          <button class="info" type="button" aria-expanded="false" aria-controls="info-tags" aria-label="Explain the five parts" title="What is this?"><svg aria-hidden="true"><use href="#i"/></svg></button>
        </div>
        <p class="info-text" id="info-tags" data-info="tags" hidden></p>
        <output class="sum" id="tripsOut"></output>
        <ul class="tags" id="tags"></ul>
      </section>
      <section class="controls" data-levels="1 2" aria-labelledby="ph">
        <h2><span id="ph">Move</span> <button class="info" type="button" aria-expanded="false" aria-controls="info-reward" aria-label="Explain the rewards" title="What is this?"><svg aria-hidden="true"><use href="#i"/></svg></button></h2>
        <p class="info-text" id="info-reward" data-info="reward" hidden></p>
        <div class="pad" role="group" aria-labelledby="ph">
          <button type="button" data-move="0" aria-label="Up">&uarr;</button>
          <button type="button" data-move="2" aria-label="Left">&larr;</button>
          <button type="button" data-move="1" aria-label="Down">&darr;</button>
          <button type="button" data-move="3" aria-label="Right">&rarr;</button>
        </div>
        <div class="row-btns">
          <button class="btn primary" type="button" id="handover">Let the AI play</button>
          <button class="btn" type="button" id="restart">Restart</button>
          <button class="info" type="button" aria-expanded="false" aria-controls="info-restart" aria-label="Explain restart" title="What is this?"><svg aria-hidden="true"><use href="#i"/></svg></button>
        </div>
        <p class="info-text" id="info-restart" data-info="restart" hidden></p>
      </section>
    </aside>
`;
}

// Mounts level n into root and returns { n, redraw(), destroy() }. An unbuilt n falls back to level 1.
// The caller redraws on a theme change (handle.redraw).
export function mountLevelPlay(root, { n, title = '', showTitle = true } = {}) {
  root.innerHTML = levelPanelHtml({ showTitle });
  const $ = id => root.querySelector(`#${id}`);
  const canvas = $('stage'), ctx = canvas.getContext('2d');
  const arrows = [$('arrowOut'), $('arrowBack')];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let view = null, size = { dpr: 1, w: 0 };

  const ui = {
    canvas, room: ROOM, panel: $('levelPanel'), tiles: $('tiles'),
    draw(opts) {
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      ctx.clearRect(0, 0, size.w, size.w);
      drawRoom(ctx, ROOM, { cell: size.w / ROOM.w, ...opts });
    },
    cellAt(e) {
      const r = canvas.getBoundingClientRect();
      return cellAt(r.width, ROOM, e.clientX - r.left, e.clientY - r.top);
    },
    say: t => { $('say').textContent = t; },
    readout(steps, score) { $('steps').textContent = steps; $('score').textContent = score; },
    sees: t => { $('sees').textContent = t; },
    setLog(lines) {
      $('log').replaceChildren(...lines.map(l => Object.assign(document.createElement('li'), { textContent: l })));
    },
    flash() { // the two arrows light for a moment on every step; with reduced motion they stay dark
      if (reduceMotion.matches) return;
      for (const a of arrows) { a.classList.add('lit'); setTimeout(() => a.classList.remove('lit'), 300); }
    },
  };

  n = BUILT_LEVELS.includes(n) ? n : BUILT_LEVELS[0];
  const level = levelByN(n);
  root.querySelectorAll('[data-levels]').forEach(el => { el.hidden = !el.dataset.levels.split(' ').includes(String(n)); });
  if (showTitle) $('levelTitle').textContent = title;
  $('levelBrief').textContent = level.brief;
  $('status').textContent = level.lesson;
  root.querySelectorAll('.info-text[data-info]').forEach(p => { p.textContent = INFO[p.dataset.info]; });
  root.querySelectorAll('.info').forEach(btn => btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    $(btn.getAttribute('aria-controls')).hidden = !open;
  }));

  const redraw = () => view?.redraw();
  // Watch the canvas, not root: the game page lays root out with display: contents, which has no box to observe.
  const resize = new ResizeObserver(() => { size = sizeCanvas(canvas, 1); redraw(); });
  resize.observe(canvas);

  size = sizeCanvas(canvas, 1);
  view = views[n].mount(ui);

  return {
    n, redraw,
    destroy() {
      view?.destroy();
      view = null;
      resize.disconnect();
      root.innerHTML = '';
    },
  };
}
