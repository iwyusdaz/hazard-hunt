/**
 * materials.js — procedural pieces of Bay 4 that are not models: the floor
 * light pools (a light map drawn from the high-bay grid), the light cones,
 * dust in the beams, the roof-light sky, the glossy spill, contact shadows
 * and the forklift's blue warning spot. Every surface here carries a texture
 * or a shader (no bare primitives, ui-audit `barePrimitives`).
 * @module hazard/materials
 */
import * as THREE from 'three';
import { BAY, LIGHTS } from './layout.js';

const canvasTex = (w, h, draw, { srgb = true } = {}) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/** Light map for the floor: a warm-white pool under each high-bay light, cooler between. */
export function floorLightMap() {
  const W = 768, H = 512;
  return canvasTex(W, H, (g) => {
    g.fillStyle = 'rgb(40,46,56)';
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (const l of LIGHTS) {
      const u = ((l.x - BAY.minX) / (BAY.maxX - BAY.minX)) * W;
      const v = ((l.z - BAY.minZ) / (BAY.maxZ - BAY.minZ)) * H;
      const r = (6.5 / (BAY.maxX - BAY.minX)) * W;
      const grd = g.createRadialGradient(u, v, 0, u, v, r);
      const k = l.failing ? 0.55 : 1;
      grd.addColorStop(0, `rgba(${200 * k | 0},${196 * k | 0},${184 * k | 0},1)`);
      grd.addColorStop(0.45, `rgba(${110 * k | 0},${110 * k | 0},${106 * k | 0},1)`);
      grd.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = grd;
      g.fillRect(u - r, v - r, r * 2, r * 2);
    }
  });
}

/** Radial soft disc (contact shadows, spots). */
export function radialTexture(inner = 'rgba(0,0,0,0.85)', outer = 'rgba(0,0,0,0)') {
  return canvasTex(128, 128, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, inner);
    grd.addColorStop(1, outer);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, w);
  }, { srgb: false });
}

let _shadowTex = null;
/** A contact shadow under a person or a truck (no shadow-map draw calls). */
export function contactShadow(w, d, opacity = 0.55) {
  _shadowTex ||= radialTexture();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: _shadowTex, transparent: true, opacity, depthWrite: false, color: 0x000000 }));
  m.position.y = 0.012;
  m.renderOrder = 1;
  m.raycast = () => {};
  m.userData.noOutline = true;
  return m;
}

/** The forklift's projected blue warning spot (a real safety light, EU-OSHA good practice). */
export function blueSpot() {
  const t = radialTexture('rgba(90,150,255,1)', 'rgba(20,60,255,0)');
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0x7fb0ff }));
  m.position.y = 0.02;
  m.raycast = () => {};
  m.userData.marker = { label: 'Blue spot on the floor' };
  return m;
}

/** Merged light cones under every high-bay light (one draw call). */
export function lightCones() {
  const geos = [];
  for (const l of LIGHTS) {
    const g = new THREE.CylinderGeometry(0.24, 3.0, l.y - 0.2, 32, 1, true);
    g.translate(l.x, (l.y - 0.2) / 2, l.z);
    const f = new Float32Array(g.attributes.position.count).fill(l.failing ? 1 : 0);
    g.setAttribute('failing', new THREE.BufferAttribute(f, 1));
    geos.push(g);
  }
  const geo = mergeSimple(geos);
  const mat = new THREE.ShaderMaterial({
    // Front faces only: one layer of additive overdraw per cone (GPU budget).
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    uniforms: { uFlicker: { value: 1 }, uStrength: { value: 0.035 } },
    vertexShader: /* glsl */`
      attribute float failing;
      varying float vH; varying float vFail; varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vH = w.y; vFail = failing;
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float uFlicker; uniform float uStrength;
      varying float vH; varying float vFail; varying vec3 vN; varying vec3 vV;
      void main() {
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
        float fall = smoothstep(0.0, 3.5, vH) * (1.0 - smoothstep(6.5, 8.4, vH) * 0.4);
        float k = mix(1.0, uFlicker, vFail);
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * edge * fall * uStrength * k, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.raycast = () => {};
  mesh.renderOrder = 3;
  mesh.name = 'light-cones';
  return mesh;
}

/** Dust motes drifting inside the light cones (animated in the shader). */
export function dustInBeams(count = 2600, seed = 7) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const pos = new Float32Array(count * 3), ph = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const l = LIGHTS[i % LIGHTS.length];
    const y = 0.4 + rnd() * 6.8;
    const rMax = 0.24 + (3.0 - 0.24) * (1 - y / (l.y - 0.2));
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * rMax * 0.9;
    pos.set([l.x + Math.cos(a) * r, y, l.z + Math.sin(a) * r], i * 3);
    ph[i] = rnd() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: 600 }, uAlpha: { value: 0.75 } },
    vertexShader: /* glsl */`
      attribute float phase; uniform float uTime; uniform float uScale; varying float vA;
      void main() {
        vec3 p = position;
        float t = uTime * 0.12 + phase;
        p.x += sin(t * 1.3) * 0.35 + sin(t * 0.37 + phase) * 0.2;
        p.z += cos(t * 1.1) * 0.35;
        p.y += sin(t * 0.7) * 0.25 - mod(uTime * 0.02 + phase, 1.0) * 0.1;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(uScale * 0.018 / -mv.z, 1.5, 7.0);
        vA = 0.55 + 0.45 * sin(t * 3.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uAlpha; varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = 1.0 - smoothstep(0.15, 0.5, length(c));
        gl_FragColor = vec4(vec3(1.0, 0.96, 0.86) * d * vA * uAlpha, 1.0);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.raycast = () => {};
  pts.name = 'dust';
  return pts;
}

/** Roof-light panels: the night sky with slowly drifting cloud (illustrative). */
export function roofSkyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform float uTime; varying vec2 vW;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n(p); p *= 2.03; a *= 0.5; } return v; }
      void main() {
        vec2 p = vW * 0.05 + vec2(uTime * 0.012, uTime * 0.004);
        float c = smoothstep(0.42, 0.78, fbm(p));
        vec3 sky = vec3(0.025, 0.035, 0.06);
        vec3 cloud = vec3(0.16, 0.17, 0.2);
        // Wired glass: a faint grid in the panel.
        vec2 g = abs(fract(vW * 2.0) - 0.5);
        float wire = 1.0 - smoothstep(0.47, 0.5, max(g.x, g.y)) * 0.25;
        gl_FragColor = vec4(mix(sky, cloud, c) * wire, 1.0);
      }`,
  });
}

/** The glossy spill: an irregular patch, darker and wetter than the floor. */
export function spillMesh(w = 2.0, d = 1.5, seed = 3) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const shape = new THREE.Shape();
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = 0.82 + rnd() * 0.18 + 0.08 * Math.sin(a * 3 + 1.2);
    const x = Math.cos(a) * (w / 2) * r, y = Math.sin(a) * (d / 2) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  const geo = new THREE.ShapeGeometry(shape, 6).rotateX(-Math.PI / 2);
  // Re-fit: the patch's box is exactly w x d.
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  geo.scale(w / (b.max.x - b.min.x), 1, d / (b.max.z - b.min.z));
  geo.computeBoundingBox();
  const c = geo.boundingBox.getCenter(new THREE.Vector3());
  geo.translate(-c.x, 0, -c.z);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x0c0b09, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, transparent: true, opacity: 0.88, envMapIntensity: 1.4 });
  mat.userData.surfaceDetail = true; // a liquid film: glossy by nature, it has no texture
  const m = new THREE.Mesh(geo, mat);
  m.position.y = 0.006;
  m.receiveShadow = true;
  m.renderOrder = 1;
  return m;
}

/** Merge geometries that share one attribute layout (position, normal, uv + extras). */
export function mergeSimple(geos) {
  const g0 = geos[0];
  const names = Object.keys(g0.attributes);
  let nv = 0, ni = 0;
  for (const g of geos) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  for (const n of names) {
    const a = g0.attributes[n];
    const arr = new Float32Array(nv * a.itemSize);
    let o = 0;
    for (const g of geos) { const b = g.attributes[n]; for (let i = 0; i < b.count * b.itemSize; i++) arr[o + i] = b.array[i]; o += b.count * b.itemSize; }
    out.setAttribute(n, new THREE.BufferAttribute(arr, a.itemSize));
  }
  const idx = new Uint32Array(ni);
  let io = 0, vo = 0;
  for (const g of geos) {
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.array[i] + vo;
    else for (let i = 0; i < g.attributes.position.count; i++) idx[io++] = i + vo;
    vo += g.attributes.position.count;
  }
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}
