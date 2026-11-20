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
  it('keeps the camera turn-only', () => {
    expect(src).toMatch(/enablePan\s*:\s*false/);
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
  it('styles the debug readout', () => {
    expect(read('games/treasure-room/treasure-room.css')).toMatch(/room-debug/);
  });
});
