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
  it('keeps the camera turn-only', () => {
    expect(src).toMatch(/enablePan\s*:\s*false/);
  });
  it('has no sprite labels (they are one merged mesh, later)', () => {
    expect(src).not.toMatch(/\bnew\s+THREE\.Sprite\b/);
  });
  it('leaves no console output behind', () => {
    expect(src).not.toMatch(/console\.log/);
  });
  it('styles the debug readout', () => {
    expect(read('games/treasure-room/treasure-room.css')).toMatch(/room-debug/);
  });
});
