// three.js glue for the street's look: the sky gradient and lit windows on the buildings. No new files: both are painted at runtime.
import * as THREE from './vendor/three.module.min.js';
import { windowPattern } from './sky.js';

const WIN_COLS = 8, WIN_ROWS = 16, WIN_W = 4, WIN_H = 4.5; // a repeat of the texture is 32 m wide and 72 m tall
const LIT = '#F4C76B';

// A vertical gradient as the scene background; repaint(colours) redraws it when the theme changes.
export function createSky(colours) {
  const canvas = document.createElement('canvas');
  canvas.width = 2; canvas.height = 256;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const repaint = ({ top, bottom }) => {
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 2, 256);
    tex.needsUpdate = true;
  };
  repaint(colours);
  return { texture: tex, repaint };
}

// Lit windows on a MeshStandardMaterial: the shader reads a small shared canvas by world position (wall faces only), so the
// existing building geometry needs no UVs. Mipmaps average the windows into a soft glow far away, so nothing shimmers.
export function addWindows(mat, { phone, glow }) {
  const cell = phone ? 4 : 8;
  const canvas = document.createElement('canvas');
  canvas.width = WIN_COLS * cell; canvas.height = WIN_ROWS * cell;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = LIT;
  const pad = Math.max(1, cell / 4);
  windowPattern('reward-city', WIN_COLS, WIN_ROWS).forEach((row, r) => row.forEach((on, c) => {
    if (on) ctx.fillRect(c * cell + pad, r * cell + pad, cell - 2 * pad, cell - 2 * pad);
  }));
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.generateMipmaps = true; map.minFilter = THREE.LinearMipmapLinearFilter;
  const uniforms = { winMap: { value: map }, winGlow: { value: glow } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp;\nvarying vec3 vWn;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(position, 1.0)).xyz;\nvWn = normalize(mat3(modelMatrix) * normal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWp;\nvarying vec3 vWn;\nuniform sampler2D winMap;\nuniform float winGlow;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec3 wn = normalize(vWn);
        float wall = step(abs(wn.y), 0.5);
        vec2 wuv = vec2(dot(vWp.xz, vec2(-wn.z, wn.x)) / ${(WIN_COLS * WIN_W).toFixed(1)}, vWp.y / ${(WIN_ROWS * WIN_H).toFixed(1)});
        totalEmissiveRadiance += texture2D(winMap, wuv).rgb * wall * winGlow;`);
  };
  return { setGlow(v) { uniforms.winGlow.value = v; }, dispose() { map.dispose(); } };
}
