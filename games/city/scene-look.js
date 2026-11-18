// three.js glue for the street's look: the sky dome with sun glow and clouds, environment light, the light rig, and lit windows on the buildings. Everything is painted at runtime.
import * as THREE from './vendor/three.module.min.js';
import { domeRadius } from './scene-math.js';
import { windowPattern, skyColours, sunDirection, sunUv, cloudLayout } from './sky.js';

const WIN_COLS = 8, WIN_ROWS = 16, WIN_W = 3, WIN_H = 3.5; // windows 3 m apart, floors 3.5 m: a repeat is 24 m wide and 56 m tall
const LIT = '#F4C76B';

// Late-afternoon tuning, all in one place.
export const EXPOSURE = 1.0, ENV_INTENSITY = 0.55, HEMI_INTENSITY = 0.35, SUN_INTENSITY = 2.4, CLOUD_OPACITY = 0.8, CLOUD_TINT = '#FFF1E0', WINDOW_GLOW = 0.6;

// The sky: an inside-out sphere painted once with the gradient and a glow where the sun is, plus a few cloud sprites on it.
// The same dome (alone in its own scene) feeds PMREMGenerator.fromScene, so the light on the city matches the sky above it.
export function createSky({ radius, cx, cz, cloudCount }) {
  const { top, bottom, sunGlow } = skyColours();
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height / 2); // zenith to horizon over the top half; the lower half is the horizon colour
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = bottom; ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);
  const { u, v } = sunUv(sunDirection());
  for (const dx of [-canvas.width, 0, canvas.width]) { // drawn three times so the glow wraps across the texture seam
    const gx = u * canvas.width + dx, gy = v * canvas.height;
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, 90);
    glow.addColorStop(0, sunGlow); glow.addColorStop(0.15, sunGlow + 'CC'); glow.addColorStop(1, sunGlow + '00');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const domeR = domeRadius(radius);
  const mat = new THREE.MeshBasicMaterial({ map, side: THREE.BackSide, fog: false, depthWrite: false });
  const geo = new THREE.SphereGeometry(domeR, 32, 16);
  const dome = new THREE.Mesh(geo, mat);
  dome.position.set(cx, 0, cz); dome.renderOrder = -2;
  const envScene = new THREE.Scene();
  const envDome = new THREE.Mesh(geo, mat);
  envDome.scale.setScalar(1 / domeR); // unit radius, so it sits inside PMREM's near/far range
  envScene.add(envDome);

  const cc = document.createElement('canvas');
  cc.width = cc.height = 128;
  const cctx = cc.getContext('2d');
  for (const [x, y, r] of [[48, 70, 34], [74, 62, 40], [96, 72, 28], [64, 78, 36]]) { // a few overlapping soft puffs
    const p = cctx.createRadialGradient(x, y, 0, x, y, r);
    p.addColorStop(0, 'rgba(255,255,255,0.9)'); p.addColorStop(1, 'rgba(255,255,255,0)');
    cctx.fillStyle = p; cctx.fillRect(0, 0, 128, 128);
  }
  const cloudTex = new THREE.CanvasTexture(cc);
  cloudTex.colorSpace = THREE.SRGBColorSpace;
  const cloudMat = new THREE.SpriteMaterial({ map: cloudTex, color: CLOUD_TINT, opacity: CLOUD_OPACITY, transparent: true, fog: false, depthWrite: false });
  const clouds = cloudLayout(cloudCount).map(({ dir, size }) => {
    const s = new THREE.Sprite(cloudMat);
    s.position.set(cx + dir[0] * domeR * 0.9, dir[1] * domeR * 0.9, cz + dir[2] * domeR * 0.9);
    s.scale.setScalar(size * domeR * 2); s.renderOrder = -1;
    return s;
  });
  const group = new THREE.Group();
  group.add(dome, ...clouds);
  // Environment lighting from the dome: call once with the renderer, after the dome is built.
  const environment = (renderer) => {
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(envScene, 0.04, 0.1, 10);
    pm.dispose();
    return rt;
  };
  return { group, environment, dispose() { map.dispose(); cloudTex.dispose(); mat.dispose(); cloudMat.dispose(); geo.dispose(); } };
}

// The light rig: a soft hemisphere fill and the low warm sun, with shadows sized by the quality tier. The shadow box is placed by scene.js each frame.
export function lightRig(scene, tier) {
  const c = skyColours();
  scene.add(new THREE.HemisphereLight(c.hemiSky, c.hemiGround, HEMI_INTENSITY));
  const sun = new THREE.DirectionalLight(c.sun, SUN_INTENSITY);
  sun.castShadow = true;
  sun.shadow.mapSize.set(tier.shadowSize, tier.shadowSize);
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);
  return sun;
}

// Lit windows on a MeshStandardMaterial: the shader reads a small shared canvas by world position (wall faces only), so the
// existing building geometry needs no UVs. Nearest magnification keeps edges crisp; mipmaps average to a soft glow far away.
export function addWindows(mat, { cell, glow }) {
  const canvas = document.createElement('canvas');
  canvas.width = WIN_COLS * cell; canvas.height = WIN_ROWS * cell;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = LIT;
  const padX = cell * 0.27, padY = cell * 0.25; // a window is about 1.4 m by 1.8 m in its 3 m by 3.5 m bay
  windowPattern('reward-city', WIN_COLS, WIN_ROWS).forEach((row, r) => row.forEach((on, c) => {
    if (on) ctx.fillRect(c * cell + padX, r * cell + padY, cell - 2 * padX, cell - 2 * padY);
  }));
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.generateMipmaps = true; map.minFilter = THREE.LinearMipmapLinearFilter; map.magFilter = THREE.NearestFilter; // crisp up close, soft glow far away
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
  return { dispose() { map.dispose(); } };
}
