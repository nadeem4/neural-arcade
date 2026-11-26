import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const src = read('games/treasure-room/room-scene.js');

// room-scene.js needs WebGL, so Node can only guard its source; the behaviour is checked in a browser.
describe('room-scene.js source guards', () => {
  it('draws repeated parts instanced and loads nothing from the network', () => {
    expect(src).toMatch(/InstancedMesh/);
    expect(src).not.toMatch(/https?:/);
  });
  it('lets go of the GPU on destroy and survives a lost context', () => {
    expect(src).toMatch(/forceContextLoss/);
    expect(src).toMatch(/webglcontextlost/);
  });
  it('uses the pure maths for near walls, picking and taps', () => {
    expect(src).toMatch(/nearSides\(/);
    expect(src).toMatch(/rayToCell\(/);
    expect(src).toMatch(/isTap\(/);
  });
  it('removes its canvas if the renderer cannot be created', () => {
    expect(src).toMatch(/catch \(err\) \{ canvas\.remove\(\); throw err; \}/);
  });
  it('lets go of the renderer and canvas if the character cannot be built', () => {
    expect(src).toMatch(/try \{ ch = character\?\.spawn\(room, null\) \?\? null; \}\s*catch \(err\) \{[\s\S]*?forceContextLoss[\s\S]*?renderer\.dispose\(\)[\s\S]*?canvas\.remove\(\)[\s\S]*?throw err/);
  });
  it('fits the camera to the real room outline, not a sphere', () => {
    expect(src).toMatch(/fitOutline\(/);
    expect(src).toMatch(/outlineCorners\(/);
    expect(src).not.toMatch(/fitDistance/);
  });
  it('keeps the camera turn-only', () => {
    expect(src).toMatch(/enablePan\s*:\s*false/);
  });
  it('does not zoom, so scrolling the page over the room scrolls the page', () => {
    expect(src).toMatch(/enableZoom\s*:\s*false/);
  });
  it('has no sprite labels (they are one merged mesh, later)', () => {
    expect(src).not.toMatch(/\bnew\s+THREE\.Sprite\b/);
  });
  it('moves the rogue by the pure tween rules, and never advances the mixer with reduced motion', () => {
    expect(src).toMatch(/moveStyle\(/);
    expect(src).toMatch(/atTreasure\(/);
    expect(src).toMatch(/!reduceMotion\) character\.update\(|!reduceMotion\) ch\.update\(/);
    expect(src).toMatch(/character\?\.destroy\(\)|ch\?\.destroy\(\)|ch\.destroy\(\)/);
  });
  it('the host loads the rogue with the scene', () => {
    expect(read('games/treasure-room/room-host.js')).toMatch(/loadCharacter\(\)/);
  });
  it('leaves no console output behind', () => {
    expect(src).not.toMatch(/console\.log/);
  });
  it('has arrow and trail mesh layers, instanced, with no per-item clones', () => {
    const m = read('games/treasure-room/room-overlay-meshes.js');
    expect(m).toMatch(/arrows\(ctx\)/);
    expect(m).toMatch(/trail\(ctx\)/);
    expect(m).toMatch(/InstancedMesh/);
    expect(m).toMatch(/--signal/);
    expect(m).not.toMatch(/new\s+THREE\.Sprite|\.clone\(/);
  });
  it('scales the chest coin stack by treasureScale', () => {
    expect(src).toMatch(/treasureScale/);
  });
  it('styles the debug readout', () => {
    expect(read('games/treasure-room/treasure-room.css')).toMatch(/room-debug/);
  });
  it('drops a drag when the loop pauses, so a hidden tab cannot keep it at full rate', () => {
    expect(src).toMatch(/if \(document\.hidden \|\| !visible\) \{[^}]*dragging = false/);
  });
});

describe('level labels wiring (source guards)', () => {
  const host = read('games/treasure-room/room-host.js');
  const view = read('games/treasure-room/room-markers-view.js');
  it('the scene projects the labels after each render', () => {
    expect(src).toMatch(/setMarkers/);
    expect(src).toMatch(/projectPoint\(/);
    expect(src).toMatch(/AGENT_HEAD_Y/);
  });
  it('the host passes the layer on and replays it when the scene is built', () => {
    expect(host).toMatch(/setMarkers\(layer\)/);
    expect(host).toMatch(/scene\.setMarkers\(markers\)/);
  });
  it('the markers are buttons wired with aria-expanded and aria-controls, never disabled', () => {
    expect(view).toMatch(/aria-expanded/);
    expect(view).toMatch(/aria-controls/);
    expect(view).not.toMatch(/disabled/);
  });
  it('clicks on a label stop at the layer so the room never moves the agent', () => {
    expect(view).toMatch(/layer\.addEventListener\('click', e => e\.stopPropagation\(\)/);
  });
  it('hover and the keyboard close work on the whole wrapper, and the open card measures itself', () => {
    expect(view).toMatch(/wrap\.addEventListener\('pointerenter'/);
    expect(view).toMatch(/focusout/);
    expect(view).toMatch(/offsetHeight/);
    expect(view).toMatch(/offsetWidth/);
  });
  it('card text goes in with textContent, never innerHTML', () => {
    expect(view).toMatch(/textContent/);
    expect(view).not.toMatch(/innerHTML/);
  });
  it('the view listens for Escape and outside presses through one AbortController', () => {
    expect(view).toMatch(/AbortController/);
    expect(view).toMatch(/Escape/);
    expect(view).toMatch(/pointerdown/);
    expect(view).toMatch(/cardReduce\(/);
  });
});
