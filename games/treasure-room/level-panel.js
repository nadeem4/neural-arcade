// One Treasure Room level (room, readouts, panel, (i) buttons) mounted into any element: the game page mounts it.
// The (i) icon is an SVG <symbol id="i"> that the host page must define once.
import { createRoomHost } from './room-host.js';
import { createLoader } from './room-loader.js';
import { OVERLAYS_FOR_LEVEL } from './room-overlays.js';
import { markersFor } from './room-markers.js';
import { createMarkerLayer } from './room-markers-view.js';
import { roomForLevel } from './sim.js';
import { levelById, assumesHtml } from './levels.js';
import { INFO, MARKER_INFO } from './words.js';
import { lessonOfLevel, flatLessons } from '../../assets/tracks/model.js';
import * as levelAgent from './level-agent.js';
import * as levelTriples from './level-triples.js';
import * as levelReturn from './level-return.js';
import * as levelPolicy from './level-policy.js';
import * as levelValue from './level-value.js';
import * as levelMdp from './level-mdp.js';

const views = { loop: levelAgent, state: levelTriples, return: levelReturn, policy: levelPolicy, value: levelValue, mdp: levelMdp };
// The built levels in track order: the game's level order is the lessons' order.
export const BUILT_LEVELS = flatLessons().filter(l => l.game === 'treasure-room' && l.level in views).map(l => l.level);

export function levelPanelHtml({ showTitle = true } = {}) {
  return `
    <div class="stage">
      <div class="stage-head"><span class="live"><i></i><b>The room</b></span>
        <span class="stage-tools"><button class="info" type="button" aria-expanded="false" aria-controls="info-room" aria-label="Explain the room" title="What is this?"><svg aria-hidden="true"><use href="#i"/></svg></button></span></div>
      <p class="info-text" id="info-room" data-info="room" hidden></p>
      <div class="stage-body">
        <div class="room" id="roomBox" data-label="A five by five room. The robot starts on the left, the treasure is at the bottom right, there is a pit in the middle and two walls.">
          <div class="tilegrid" id="tiles" data-levels="policy" hidden></div>
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
        <div id="levelAssumes"></div>
        <p class="lesson-line" id="status"></p>
      </section>
      <section data-levels="loop" aria-labelledby="sh">
        <h2><span id="sh">What the AI sees</span> <button class="info" type="button" aria-expanded="false" aria-controls="info-sees" aria-label="Explain what the AI sees" title="What is this?"><svg aria-hidden="true"><use href="#i"/></svg></button></h2>
        <p class="info-text" id="info-sees" data-info="ai" hidden></p>
        <output class="sees" id="sees">Nothing yet</output>
        <div class="arrows" aria-hidden="true"><span id="arrowOut">action &rarr;</span><span id="arrowBack">&larr; position and reward</span></div>
      </section>
      <section data-levels="state" aria-labelledby="lh" hidden>
        <h2><span id="lh">Log</span> <button class="info" type="button" aria-expanded="false" aria-controls="info-log" aria-label="Explain the log" title="What is this?"><svg aria-hidden="true"><use href="#i"/></svg></button></h2>
        <p class="info-text" id="info-log" data-info="log" hidden></p>
        <ol class="log" id="log" aria-live="off"></ol>
      </section>
      <section class="controls" data-levels="return" aria-labelledby="rh" hidden>
        <h2><span id="rh">Coin or chest</span> <button class="info" type="button" aria-expanded="false" aria-controls="info-route" aria-label="Explain routes" title="What is this?"><svg aria-hidden="true"><use href="#i"/></svg></button></h2>
        <p class="info-text" id="info-route" data-info="route" hidden></p>
        <nav class="steps" id="stepTabs" aria-label="Lesson steps">${levelReturn.tabsHtml(1)}</nav>
        <div data-step-view="1">
          <p>Every move costs 1. The coin pays 2, the chest pays 10. Send the robot down each route and add up what it collects.</p>
          <div class="routes" role="group" aria-label="Routes">
            <button type="button" id="sendCoin">Coin route</button>
            <button type="button" id="sendChest">Chest route</button>
          </div>
          <output class="tally" id="tally"></output>
          <div class="vs">
            <div id="boxcoin"><small>Coin route total</small><b id="vcoin">?</b></div>
            <div id="boxchest"><small>Chest route total</small><b id="vchest">?</b></div>
          </div>
          <p id="hint1">That total is the return. Try both.</p>
        </div>
        <div data-step-view="2" hidden>
          <p>A reward one step later counts as 90% of the same reward now. That 0.9 is the discount.</p>
          <table class="disc"><thead><tr><th>10 points, steps later</th><th>counts as</th></tr></thead><tbody id="discRows"></tbody></table>
          <p>The chest is the 6th reward on its route, so it counts 0.9&#8309; of 10 = 5.9. Look at it shrink in the room. The coin, 2nd on its route, counts 1.8.</p>
        </div>
        <div data-step-view="3" hidden>
          <label class="gamma-row" for="gamma">Discount <output id="gammaOut">0.90</output>
            <button class="info" type="button" aria-expanded="false" aria-controls="info-gamma" aria-label="Explain the discount" title="What is this?"><svg aria-hidden="true"><use href="#i"/></svg></button></label>
          <p class="info-text" id="info-gamma" data-info="gamma" hidden></p>
          <input class="gamma" type="range" id="gamma" min="0.1" max="1" step="0.01" value="0.9">
          <div class="vs">
            <div id="box3coin"><small>Coin route return</small><b id="ret3coin"></b></div>
            <div id="box3chest"><small>Chest route return</small><b id="ret3chest"></b></div>
          </div>
          <p class="pick" aria-live="polite">Robot picks: <em id="pick"></em></p>
          <p id="hint3"></p>
        </div>
      </section>
      <section class="controls" data-levels="policy" aria-labelledby="ah" hidden>
        <h2><span id="ah">Arrows</span> <button class="info" type="button" aria-expanded="false" aria-controls="info-arrows" aria-label="Explain the arrows" title="What is this?"><svg aria-hidden="true"><use href="#i"/></svg></button></h2>
        <p class="info-text" id="info-arrows" data-info="arrows" hidden></p>
        <div class="row-btns">
          <button class="btn primary" type="button" id="go">Go</button>
          <button class="btn" type="button" id="fix">Let the AI fix it</button>
          <button class="btn" type="button" id="resetArrows">Reset arrows</button>
        </div>
      </section>
      <section class="controls" data-levels="value" aria-labelledby="vh" hidden>
        <h2><span id="vh">Sweep the values</span> <button class="info" type="button" aria-expanded="false" aria-controls="info-sweep" aria-label="Explain sweeping" title="What is this?"><svg aria-hidden="true"><use href="#i"/></svg></button></h2>
        <p class="info-text" id="info-sweep" data-info="sweep" hidden></p>
        <div class="row-btns">
          <button class="btn primary" type="button" id="sweep">Sweep</button>
          <button class="btn" type="button" id="sweep10">Sweep x10</button>
          <button class="btn" type="button" id="walkUp">Walk uphill</button>
          <button class="btn" type="button" id="resetSweeps">Reset</button>
        </div>
        <p class="why" id="walkUpWhy"></p>
        <output class="sweep-info" id="sweepInfo">Sweep 0</output>
        <label class="gamma-row" for="valueGamma">Discount <output id="valueGammaOut">0.90</output>
          <button class="info" type="button" aria-expanded="false" aria-controls="info-vgamma" aria-label="Explain the discount" title="What is this?"><svg aria-hidden="true"><use href="#i"/></svg></button></label>
        <p class="info-text" id="info-vgamma" data-info="gamma" hidden></p>
        <input class="gamma" type="range" id="valueGamma" min="0.1" max="1" step="0.05" value="0.9">
        <p id="valueGammaHint"></p>
        <p class="heat-legend"><i class="heat-bar" aria-hidden="true"></i> faint = worse, bright = better</p>
      </section>
      <section class="controls" data-levels="mdp" aria-labelledby="mh" hidden>
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
      <section class="controls" data-levels="loop state" aria-labelledby="ph">
        <h2><span id="ph">Move</span> <button class="info" type="button" aria-expanded="false" aria-controls="info-reward" aria-label="Explain the rewards" title="What is this?"><svg aria-hidden="true"><use href="#i"/></svg></button></h2>
        <p class="info-text" id="info-reward" data-info="reward" hidden></p>
        <nav class="steps" id="loopTabs" aria-label="Lesson steps" data-levels="loop">${levelAgent.tabsHtml}</nav>
        <p id="stepHint" data-levels="loop"></p>
        <div class="pad" id="pad" role="group" aria-labelledby="ph">
          <button type="button" data-move="0" aria-label="Up">&uarr;</button>
          <button type="button" data-move="2" aria-label="Left">&larr;</button>
          <button type="button" data-move="1" aria-label="Down">&darr;</button>
          <button type="button" data-move="3" aria-label="Right">&rarr;</button>
        </div>
        <div class="row-btns">
          <button class="btn primary" type="button" id="stepBtn" hidden>Step</button>
          <button class="btn primary" type="button" id="handover" data-levels="state">Let the AI play</button>
          <button class="btn" type="button" id="restart">Restart</button>
          <button class="info" type="button" aria-expanded="false" aria-controls="info-restart" aria-label="Explain restart" title="What is this?"><svg aria-hidden="true"><use href="#i"/></svg></button>
        </div>
        <p class="info-text" id="info-restart" data-info="restart" hidden></p>
        <div class="turn" id="turn" hidden><p id="turnSends"></p><p id="turnAnswers"></p></div>
      </section>
    </aside>
`;
}

export const tileSelector = (x, y) => `[data-x="${x}"][data-y="${y}"]`;

// A tile's own click (or Enter on it) bubbles up to the room box; it must not be forwarded again.
export function forwardTap({ e, box, tiles, host }) {
  if (box.dataset.room !== '3d' || tiles.hidden || tiles.contains(e.target)) return;
  const c = host.cellAt(e);
  if (c) tiles.querySelector(tileSelector(c.x, c.y))?.click();
}

// Keyboard focus on a tile shows the ring on that cell in the room; leaving the grid clears it.
export function wireTileFocus({ tiles, host }) {
  tiles.addEventListener('focusin', e => {
    const { x, y } = e.target.dataset ?? {};
    if (x !== undefined) host.setFocus({ x: Number(x), y: Number(y) });
  });
  tiles.addEventListener('focusout', () => host.setFocus(null));
}

// The level's lesson name; an unbuilt id reads as the first level, like the mount.
export const levelName = id => lessonOfLevel('treasure-room', BUILT_LEVELS.includes(id) ? id : BUILT_LEVELS[0]).title;

// Mounts level id into root and returns { id, redraw(), destroy(), host }. An unbuilt id falls back to the first level.
// The room is drawn by a room host in 3D; a loader panel shows progress, or a failure with Try again (see room-host.js, room-loader.js).
// The caller redraws on a theme change (handle.redraw).
export function mountLevelPlay(root, { id, title = '', showTitle = true } = {}) {
  root.innerHTML = levelPanelHtml({ showTitle });
  const $ = id => root.querySelector(`#${id}`);
  const box = $('roomBox'), tiles = $('tiles');
  const arrows = [$('arrowOut'), $('arrowBack')];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let view = null;

  id = BUILT_LEVELS.includes(id) ? id : BUILT_LEVELS[0];
  const room = roomForLevel(id);
  // The loader comes first: the host reports its first state synchronously inside createRoomHost.
  let host, markers = null;
  const loader = createLoader(box, { title: title || levelName(id), onRetry: () => host.retry(), reduceMotion: reduceMotion.matches });
  host = createRoomHost({
    box, room, reduceMotion: reduceMotion.matches,
    onState: (state, reason) => { markers?.setShown(state === '3d'); if (state === 'loading') loader.loading(); else if (state === '3d') loader.done(); else loader.fail(reason); },
    onProgress: loader.progress,
  });
  host.setOverlays(OVERLAYS_FOR_LEVEL[id]);
  const list = markersFor(id, room);
  markers = list.length ? createMarkerLayer({ box, markers: list, info: MARKER_INFO }) : null;
  markers?.setShown(host.mode() === '3d');
  host.setMarkers(markers);

  // ui.canvas is the room box, so a click on the 3D canvas reaches the level.
  const ui = {
    canvas: box, room, panel: $('levelPanel'), tiles,
    draw: host.draw,
    cellAt: host.cellAt,
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

  const level = levelById(id);
  root.querySelectorAll('[data-levels]').forEach(el => { el.hidden = !el.dataset.levels.split(' ').includes(id); });
  if (showTitle) $('levelTitle').textContent = title;
  $('levelBrief').textContent = level.brief;
  $('levelAssumes').innerHTML = assumesHtml(level);
  $('status').textContent = level.lesson;
  root.querySelectorAll('.info-text[data-info]').forEach(p => { p.textContent = INFO[p.dataset.info]; });
  root.querySelectorAll('.info').forEach(btn => btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    $(btn.getAttribute('aria-controls')).hidden = !open;
  }));

  const redraw = () => view?.redraw();
  // Watch the room box, not root: the game page lays root out with display: contents, which has no box to observe.
  const resize = new ResizeObserver(() => { host.resize(); redraw(); });
  resize.observe(box);

  // In 3D the tile buttons sit under the picture and take no pointer, so a tap on the room clicks the tile it lands on.
  box.addEventListener('click', e => forwardTap({ e, box, tiles, host }));
  wireTileFocus({ tiles, host });

  host.resize();
  view = views[id].mount(ui);

  return {
    id, redraw, host,
    destroy() {
      view?.destroy();
      view = null;
      host.destroy();
      markers?.destroy();
      loader.destroy();
      resize.disconnect();
      root.innerHTML = '';
    },
  };
}
