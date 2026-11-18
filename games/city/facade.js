// three.js glue for building facades: windows drawn in the fragment shader from the per-vertex numbers geometry.js writes
// (wallUv in metres, facA = bay, floor height, fill, seed; facB = shopfront height, window top, glass tint). No textures, so windows
// stay crisp and always scale with the real floor height. Window rows fade to their average when they get smaller than a pixel.
// Which windows are lit is a hash of the window and the building's seed: nothing here reads a clock or an unseeded random.
import * as THREE from './vendor/three.module.min.js';


// Warm light in a lit window, linear rgb.
const LIT = 'vec3(1.0, 0.62, 0.22)';

// detail 2 (desktop) adds floor slab lines and a faint tint per floor; detail 1 (phones) is windows and the shopfront band only.
export function applyFacade(mat, { detail, glow }) {
  mat.vertexColors = true;
  mat.customProgramCacheKey = () => `facade${detail}`;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.winGlow = { value: glow };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 wallUv;
attribute vec4 facA;
attribute vec4 facB;
varying vec2 vWallUv;
varying vec4 vFacA;
varying vec4 vFacB;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vWallUv = wallUv; vFacA = facA; vFacB = facB;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vWallUv;
varying vec4 vFacA;
varying vec4 vFacB;
uniform float winGlow;
float hash21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float fWin = 0.0, fLit = 0.0;
{
  float bay = vFacA.x, flh = vFacA.y, fill = vFacA.z, seed = vFacA.w;
  float shopH = vFacB.x, winTop = vFacB.y, glassy = vFacB.z;
  float u = vWallUv.x, v = vWallUv.y;
  bool shop = v < shopH;
  float cw = shop ? bay * 1.7 : bay;
  float ch = shop ? shopH : flh;
  vec2 cell = vec2(u / cw, v / ch);
  vec2 id = floor(cell), f = fract(cell);
  float on = step(0.001, fill) * step((id.y + 1.0) * ch, winTop + 0.05);
  float wx = shop ? 0.86 : mix(0.38, 0.94, fill);
  float wy = shop ? 0.66 : mix(0.42, 0.86, fill);
  vec2 d = abs(f - vec2(0.5, shop ? 0.45 : 0.5)) - 0.5 * vec2(wx, wy);
  float e = max(fwidth(cell.x), fwidth(cell.y));
  float inWin = 1.0 - smoothstep(-e, e, max(d.x, d.y));
  inWin = mix(inWin, wx * wy, smoothstep(0.08, 0.35, e)) * on;
  vec3 base = diffuseColor.rgb;
  if (shop && on > 0.5) base *= 0.7; // darker ground-floor band
  ${detail >= 2 ? `base *= 0.93 + 0.14 * hash21(vec2(id.y, seed * 91.0)) * on;
  base *= 1.0 - 0.14 * on * (1.0 - smoothstep(0.0, 0.06, f.y)) * (1.0 - smoothstep(0.0, 0.2, e));` : ''}
  vec3 glass = mix(base * 0.22 + vec3(0.012, 0.02, 0.032), vec3(0.07, 0.11, 0.16), glassy * 0.8);
  diffuseColor.rgb = mix(base, glass, inWin);
  fWin = inWin;
  float litFrac = shop ? 0.45 : 0.14;
  fLit = mix(step(hash21(id + seed * 57.0), litFrac), litFrac, smoothstep(0.03, 0.18, e)) * inWin;
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.3, fWin);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += ${LIT} * fLit * winGlow;`);
  };
}

// The merged building geometry as a three.js BufferGeometry.
export function buildingGeometry({ positions, normals, indices, colors, wallUv, facA, facB }) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('wallUv', new THREE.BufferAttribute(wallUv, 2));
  g.setAttribute('facA', new THREE.BufferAttribute(facA, 4));
  g.setAttribute('facB', new THREE.BufferAttribute(facB, 4));
  g.setIndex(new THREE.BufferAttribute(indices, 1));
  g.computeBoundingSphere();
  return g;
}
