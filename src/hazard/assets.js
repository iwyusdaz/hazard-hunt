/**
 * assets.js — the v3 asset set (public/assets/v3/manifest.json, S4) for Bay 4.
 *
 * - One GLTFLoader with the self-hosted Basis transcoder (vite-plugin-decoders.js,
 *   T-24 patch) and the bundled meshopt decoder; KTX2 textures for decals and
 *   tiling sets.
 * - Each GLB is fetched once and cloned for every placement.
 * - Static props are merged per material at load (`mergeByMaterial`), so a
 *   Poly Haven desk with nine meshes draws once. Nodes a motion system moves
 *   (wheels, a door curtain, a clock hand) are kept apart by name.
 * - Load tiers (plan 10 §7 download gate): tier 0 is what the first view needs
 *   (shell, floor and walls, racking, every task object); tier 1 (characters,
 *   dressing, the HDRI) streams after the learner's first interaction.
 * @module hazard/assets
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export const BASE = import.meta.env?.BASE_URL || './';
/** public/assets/v3/manifest.json "assets", filled by initLoaders(). */
export let MANIFEST = {};

let ktx2 = null, gltf = null;
const glbCache = new Map();
const texCache = new Map();

export async function initLoaders(renderer) {
  if (gltf) return;
  const r = await fetch(`${BASE}assets/v3/manifest.json`);
  if (!r.ok) throw new Error(`asset manifest: HTTP ${r.status}`);
  MANIFEST = (await r.json()).assets;
  ktx2 = new KTX2Loader().setTranscoderPath(`${BASE}decoders/basis/`).detectSupport(renderer);
  gltf = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  ktx2._maxAniso = renderer.capabilities.getMaxAnisotropy();
}

/** Bytes a list of manifest keys costs (for the tier budget test). */
export function bytesOf(keys, man = MANIFEST) {
  let n = 0;
  for (const k of keys) {
    const a = man[k];
    if (!a) continue;
    if (a.file) n += a.bytes;
    if (a.maps) for (const m of Object.values(a.maps)) n += m.bytes;
  }
  return n;
}

/** The glTF scene of a manifest key (cached). */
export function loadGLB(key) {
  const a = MANIFEST[key];
  if (!a?.file) return Promise.reject(new Error(`asset ${key}: not a model in the manifest`));
  if (!glbCache.has(key)) glbCache.set(key, gltf.loadAsync(`${BASE}${a.file}`).then((g) => { g.scene.traverse((m) => { if (m.isMesh) [m.material].flat().forEach(fixMaterial); }); return g; }));
  return glbCache.get(key);
}

/**
 * Draw-call hygiene for the S4 GLBs (every material is exported double-sided):
 * a transparent double-sided material draws twice per frame (back faces, then
 * front), so the shrink film, glass and clear boxes draw once instead
 * (forceSinglePass). Character skin, clothes and eyes are opaque; brows and
 * lashes are alpha cut-outs; hair stays blended (one pass).
 */
function fixMaterial(m) {
  if (!m || m.userData.fixed) return;
  m.userData.fixed = true;
  // Transmission (KHR_materials_transmission) makes three render every opaque
  // object a second time each frame; thin glass and film read the same as
  // plain alpha blending at warehouse distances.
  if (m.transmission > 0) { m.transmission = 0; m.transparent = true; m.opacity = Math.min(m.opacity, 0.35); m.depthWrite = false; }
  if (!m.transparent) return;
  if (/^Human\./.test(m.name) && !/hair|braid|bob|ponytail|short\d|long\d|eyebrow|eyelash/i.test(m.name)) { m.transparent = false; m.depthWrite = true; return; }
  if (/eyebrow|eyelash/i.test(m.name)) { m.transparent = false; m.alphaTest = 0.5; m.depthWrite = true; return; }
  if (m.side === THREE.DoubleSide) m.forceSinglePass = true;
}

/** A KTX2 texture by file path (cached). */
export function loadKTX2(file, { srgb = true, repeat = false } = {}) {
  const k = `${file}|${srgb}|${repeat}`;
  if (!texCache.has(k)) {
    texCache.set(k, ktx2.loadAsync(`${BASE}${file}`).then((t) => {
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = Math.min(8, ktx2._maxAniso || 1);
      t.needsUpdate = true;
      return t;
    }));
  }
  return texCache.get(k);
}

/** A decal texture from the manifest ('decal:<id>'). */
export function loadDecal(id) {
  const a = MANIFEST[`decal:${id}`];
  if (!a) return Promise.reject(new Error(`decal ${id} not in the manifest`));
  return loadKTX2(a.file, { srgb: !/normal/.test(id) });
}

/** A Poly Haven tiling set ('tex:<id>') as { map, normalMap, armMap }. */
export async function loadTiling(id, repeat = [1, 1]) {
  const a = MANIFEST[`tex:${id}`];
  const out = {};
  const keys = { diff: 'map', nor_gl: 'normalMap', arm: 'armMap' };
  await Promise.all(Object.entries(a.maps).map(async ([k, m]) => {
    const t = (await loadKTX2(m.file, { srgb: k === 'diff', repeat: true })).clone();
    t.repeat.set(...repeat);
    t.needsUpdate = true;
    out[keys[k]] = t;
  }));
  return out;
}

/**
 * A fresh copy of a model, merged per material except the named nodes, which
 * stay separate objects (found later with getObjectByName).
 * @param {string} key
 * @param {{ keep?: string[], merge?: boolean, shadows?: boolean, receive?: boolean }} [o]
 */
export async function model(key, o = {}) {
  const g = await loadGLB(key);
  const src = g.scene;
  const skinned = [];
  src.traverse((m) => { if (m.isSkinnedMesh) skinned.push(m); });
  if (skinned.length) throw new Error(`model(${key}) is a character: use character()`);
  const root = new THREE.Group();
  root.name = key;
  const keep = new Set(o.keep || []);
  src.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(src.matrixWorld).invert();
  if (o.merge === false) {
    const c = src.clone(true);
    root.add(c);
  } else {
    // Kept subtrees are cloned with their transform; everything else is merged.
    const kept = [];
    src.traverse((n) => { if (n !== src && keep.has(n.name) && !kept.some((k) => isAncestor(k, n))) kept.push(n); });
    const byMat = new Map();
    const add = (mat, geo) => {
      // Plain painted parts (no texture, not glowing, not see-through) share one
      // material per roughness/metalness step, their colour baked into the
      // vertices: a truck's nine paint and rubber materials draw as two or three.
      const flat = o.flatten !== false && isFlat(mat);
      if (flat) { bakeColour(geo, mat.color); mat = flatMaterial(mat); }
      pushMat(byMat, mat, geo);
    };
    src.traverse((m) => {
      if (!m.isMesh || kept.some((k) => k === m || isAncestor(k, m))) return;
      const geo = normaliseAttrs(m.geometry).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      if (mats.length > 1) {
        for (const grp of geo.groups) add(mats[grp.materialIndex], subGeometry(geo, grp));
      } else add(mats[0], geo);
    });
    for (const [mat, all] of byMat) {
      // mergeGeometries needs one attribute set: group by signature first.
      const sig = new Map();
      for (const g of all) { const s = Object.keys(g.attributes).sort().join(','); if (!sig.has(s)) sig.set(s, []); sig.get(s).push(g); }
      for (const geos of sig.values()) {
        const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
        if (!geo) continue;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = `${key}:${mat.name || 'mat'}`;
        mesh.userData.merged = true;
        root.add(mesh);
      }
    }
    for (const k of kept) {
      const c = k.clone(true);
      new THREE.Matrix4().multiplyMatrices(inv, k.matrixWorld).decompose(c.position, c.quaternion, c.scale);
      root.add(c);
    }
  }
  // Anchors: empty points at the centre of named nodes that are merged away (a seat for the driver).
  for (const name of o.anchors || []) {
    const n = src.getObjectByName(name);
    if (!n) continue;
    const a = new THREE.Object3D();
    a.name = name;
    new THREE.Box3().setFromObject(n).getCenter(a.position).applyMatrix4(inv);
    root.add(a);
  }
  const cast = o.shadows !== false, receive = o.receive !== false;
  root.traverse((m) => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = receive; } });
  return root;
}

const FLAT_SKIP = /lamp|led|lens|glass|screen|diffuser|emitter|beacon|film|clear/i;
/** A material whose look is its colour plus maps it may share with others (no colour map, not glowing or see-through). */
function isFlat(m) {
  return m?.type === 'MeshStandardMaterial' && !m.map && !m.emissiveMap && !m.alphaMap
    && !m.transparent && !m.alphaTest && m.emissive.getHex() === 0 && !m.vertexColors && !FLAT_SKIP.test(m.name);
}
const flatCache = new Map();
const tid = (t) => (t ? t.uuid : '-');
/** One shared material per (roughness step, metalness, shared detail maps, side). */
function flatMaterial(m) {
  const r = Math.round(m.roughness * 10) / 10, mt = Math.round(m.metalness * 2) / 2;
  const k = `${r}|${mt}|${m.side}|${tid(m.normalMap)}|${tid(m.roughnessMap)}|${tid(m.metalnessMap)}|${tid(m.aoMap)}|${m.normalScale?.x ?? 1}`;
  if (!flatCache.has(k)) {
    const f = m.clone();
    Object.assign(f, { name: `flat-r${r}-m${mt}`, vertexColors: true, roughness: r, metalness: mt });
    f.color.set(0xffffff);
    flatCache.set(k, f);
  }
  return flatCache.get(k);
}
function bakeColour(geo, c) {
  const n = geo.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
}

function isAncestor(a, n) { for (let p = n.parent; p; p = p.parent) if (p === a) return true; return false; }
function pushMat(map, mat, geo) { if (!map.has(mat)) map.set(mat, []); map.get(mat).push(geo); }
function subGeometry(geo, grp) {
  const g = new THREE.BufferGeometry();
  for (const [n, a] of Object.entries(geo.attributes)) g.setAttribute(n, a);
  const idx = geo.index.array.slice(grp.start, grp.start + grp.count);
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
/** mergeGeometries needs the same attribute set and non-interleaved, de-quantised data. */
function normaliseAttrs(g) {
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'uv1', 'tangent', 'color']) {
    const a = g.getAttribute(name);
    if (!a) continue;
    const n = a.count, s = a.itemSize, arr = new Float32Array(n * s);
    for (let i = 0; i < n; i++) for (let k = 0; k < s; k++) arr[i * s + k] = a.getComponent(i, k);
    out.setAttribute(name, new THREE.BufferAttribute(arr, s));
  }
  if (g.index) out.setIndex(new THREE.BufferAttribute(Uint32Array.from(g.index.array), 1));
  return out;
}

/**
 * Draw repeated placements of one model as one mesh per material (fewer draw
 * calls). The first root takes the merged meshes of every placement,
 * re-expressed in its own frame; the other roots keep only their kept
 * (animated) nodes. `userData.restSize` records one placement's size, computed
 * from its geometry before batching, for the scale check (catalog.js
 * measureObject). Call after every root is placed.
 * @param {THREE.Object3D[]} roots
 */
export function batchPlacements(roots) {
  const r0 = roots[0];
  for (const r of roots) r.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(r0).getSize(new THREE.Vector3());
  const inv0 = new THREE.Matrix4().copy(r0.matrixWorld).invert();
  const byKey = new Map();
  for (const r of roots) {
    for (const m of [...r.children]) {
      if (!m.isMesh || !m.userData.merged) continue;
      const g = m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv0, m.matrixWorld));
      const k = `${m.material.uuid}|${Object.keys(g.attributes).sort().join(',')}|${g.index ? 1 : 0}`;
      if (!byKey.has(k)) byKey.set(k, { mat: m.material, cast: m.castShadow, receive: m.receiveShadow, name: m.name, geos: [] });
      byKey.get(k).geos.push(g);
      m.removeFromParent();
    }
  }
  for (const b of byKey.values()) {
    const geo = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
    const mesh = new THREE.Mesh(geo, b.mat);
    Object.assign(mesh, { name: b.name, castShadow: b.cast, receiveShadow: b.receive });
    mesh.userData.merged = true;
    r0.add(mesh);
  }
  r0.userData.restSize = [size.x, size.y, size.z].map((v) => +v.toFixed(3));
  return r0;
}

/**
 * Instanced copies of a (merged) model: one InstancedMesh per material for all
 * placements. `matrices` are world matrices of each copy's root.
 */
export async function instanced(key, matrices, o = {}) {
  const proto = await model(key, o);
  const group = new THREE.Group();
  group.name = `${key}×${matrices.length}`;
  proto.updateMatrixWorld(true);
  proto.traverse((m) => {
    if (!m.isMesh) return;
    const im = new THREE.InstancedMesh(m.geometry, m.material, matrices.length);
    const local = m.matrixWorld;
    matrices.forEach((mx, i) => im.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(mx, local)));
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = m.castShadow; im.receiveShadow = m.receiveShadow;
    im.computeBoundingSphere();
    im.computeBoundingBox?.();
    im.name = m.name;
    group.add(im);
  });
  return group;
}

/** A character: a skinned clone with its mixer and named clips. */
export async function character(key) {
  const { clone } = await import('three/addons/utils/SkeletonUtils.js');
  const g = await loadGLB(key);
  const root = clone(g.scene);
  root.name = key;
  root.traverse((m) => {
    if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; m.frustumCulled = false; }
  });
  const mixer = new THREE.AnimationMixer(root);
  const clips = Object.fromEntries(g.animations.map((c) => [c.name, c]));
  return { root, mixer, clips };
}

/** Bottom-centre of an object's local bounding box (for grounding). */
export function localBox(obj) {
  obj.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  obj.traverse((m) => {
    if (!m.isMesh) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    tmp.copy(m.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    box.union(tmp);
  });
  return box;
}
