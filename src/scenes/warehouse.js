/**
 * Warehouse scene (v2.0.0): Northwind Logistics Bay 4 (night shift).
 * Combines the verified 19 inspectable hazard/distractor/neutral cues across three zones
 * with animated-movie stylized characters (`createAnimatedCharacter`), 8 curated Poly Haven
 * CC0 3D models (`ModelLibrary`), volumetric high-bay light shafts, floating dust motes,
 * a patrolling perimeter utility cart with proximity safety stop, an animated packing
 * conveyor, and glowing floor viewpoint rings (`AmbientLifeManager`).
 * 1 unit = 1 meter. Fixed viewpoints per zone with smooth glide, WASD walk, and free look.
 * @module scenes/warehouse
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { AmbientLifeManager } from '../v2/ambient-life.js';
import { createAnimatedCharacter } from '../v2/stylized-character.js';
import { ModelLibrary } from '../v2/model-placer.js';
import { groundProp } from '../v2/cinematic-grade.js';

const MAT = {
  concrete: new THREE.MeshStandardMaterial({ color: 0x8a8d8f, roughness: 0.92, metalness: 0.02 }),
  paintedLine: new THREE.MeshStandardMaterial({ color: 0xffd100, roughness: 0.65 }),
  steelBlue: new THREE.MeshStandardMaterial({ color: 0x2e5f8a, roughness: 0.55, metalness: 0.35 }),
  steelOrange: new THREE.MeshStandardMaterial({ color: 0xff6a13, roughness: 0.55, metalness: 0.3 }),
  cardboard: new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.95 }),
  palletWood: new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 0.9 }),
  darkPlastic: new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.6 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x181a1d, roughness: 0.95 }),
  hiVis: new THREE.MeshStandardMaterial({ color: 0xffd100, roughness: 0.75 }),
  darkTrous: new THREE.MeshStandardMaterial({ color: 0x30363d, roughness: 0.9 }),
  truckBody: new THREE.MeshStandardMaterial({ color: 0xd7263d, roughness: 0.45, metalness: 0.25 }),
  doorGrey: new THREE.MeshStandardMaterial({ color: 0x6f7780, roughness: 0.5, metalness: 0.5 }),
  exitGreen: new THREE.MeshStandardMaterial({ color: 0x1e8a4c, roughness: 0.6, emissive: 0x0d3a20 }),
  shrinkWrap: new THREE.MeshStandardMaterial({ color: 0xcfd8e0, roughness: 0.35, metalness: 0.05, transparent: true, opacity: 0.55 }),
  // Dark albedo + moderate roughness so the spill reads as a dark glossy patch rather
  // than a white specular highlight (visual review V5); IBL is damped on this material.
  spill: new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 0.26, metalness: 0.0, envMapIntensity: 0.35 }),
  innerSheath: new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.8 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xc8743a, roughness: 0.35, metalness: 0.9 }),
  rampYellow: new THREE.MeshStandardMaterial({ color: 0xffd100, roughness: 0.72 }),
  blade: new THREE.MeshStandardMaterial({ color: 0xc9ced3, roughness: 0.25, metalness: 0.95 }),
  scuff: new THREE.MeshStandardMaterial({ color: 0xc9772e, roughness: 0.5, metalness: 0.6 }),
  mirror: new THREE.MeshStandardMaterial({ color: 0xb8c6d0, roughness: 0.06, metalness: 1.0 }),
  hit: new THREE.MeshBasicMaterial({ visible: false }),
  wall: new THREE.MeshStandardMaterial({ color: 0x9ea4aa, roughness: 0.94 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x383e45, roughness: 0.9 }),
};

/** Camera field of view used by the app (app.js sets the same value). */
export const VIEW_FOV = 65;

export class Warehouse {
  /**
   * @param {THREE.Scene} scene
   * @param {object} [opts]
   * @param {boolean} [opts.headless] skip texture/model loading and canvas textures (unit tests in Node)
   * @param {boolean} [opts.reducedMotion] disable non-essential ambient animation
   */
  constructor(scene, { headless = false, reducedMotion = false } = {}) {
    this.scene = scene;
    this.headless = headless;
    this.inspectables = new Map(); // id -> { mesh, label, focus: Vector3, box: Box3, proxy }
    this._workers = [];
    this._characterCtrls = [];
    this._truck = null;
    this.viewpointRings = [];
    this.viewpointProxies = [];
    this._build();
    if (!headless) this._applyTextures();
    this._mergeStatic();
    this._buildHitProxies();
    this._initAmbientLife({ reducedMotion });
    if (!headless) this._loadPolyHavenModels();
  }

  /**
   * One invisible box per inspectable (its bounds plus a 0.25 m margin, at least
   * 0.6 m on each side) so thin or small items are easy to pick, and so the pick
   * resolves to one id. The clear-aisle floor is low priority: any other item hit
   * by the same ray wins (visual review V9).
   */
  _buildHitProxies() {
    this.scene.updateMatrixWorld(true);
    this.proxies = [];
    for (const [id, entry] of this.inspectables) {
      const box = entry.boxOverride ? entry.boxOverride.clone() : new THREE.Box3().setFromObject(entry.mesh);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      box.expandByScalar(0.25);
      for (const axis of ['x', 'y', 'z']) {
        if (size[axis] + 0.5 < 0.6) { box.min[axis] = center[axis] - 0.3; box.max[axis] = center[axis] + 0.3; }
      }
      const s = box.getSize(new THREE.Vector3());
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(s.x, s.y, s.z), MAT.hit);
      proxy.position.copy(box.getCenter(new THREE.Vector3()));
      proxy.userData.inspectable = id;
      proxy.userData.lowPriority = !!entry.lowPriority;
      proxy.castShadow = proxy.receiveShadow = false;
      this.scene.add(proxy);
      proxy.updateMatrixWorld(true);
      entry.box = box;
      entry.proxy = proxy;
      if (!entry.focus) entry.focus = center;
      this.proxies.push(proxy);
    }
    // Hover / focus outline: a safety-yellow box drawn on top of the scene.
    this.outline = new THREE.Box3Helper(new THREE.Box3(), 0xffd100);
    this.outline.material.depthTest = false;
    this.outline.material.transparent = true;
    this.outline.renderOrder = 999;
    this.outline.visible = false;
    this.scene.add(this.outline);
  }

  /**
   * Resolve a ray to an inspectable id. Low-priority items (the clear floor) only
   * win when nothing else is on the ray.
   * @param {THREE.Raycaster} ray
   * @param {Set<string>} [active] only these ids can be picked
   */
  pick(ray, active) {
    const hits = ray.intersectObjects(this.proxies, false)
      .filter((h) => !active || active.has(h.object.userData.inspectable));
    const strong = hits.find((h) => !h.object.userData.lowPriority);
    return (strong || hits[0])?.object.userData.inspectable ?? null;
  }

  /**
   * Resolve a ray to a floor viewpoint ring id (`dock`, `main`, etc.) if hit.
   * @param {THREE.Raycaster} ray
   */
  pickViewpoint(ray) {
    if (!this.viewpointProxies.length) return null;
    const hits = ray.intersectObjects(this.viewpointProxies, false);
    return hits[0]?.object.userData.viewId ?? null;
  }

  /** Show the outline around one inspectable (or hide it with null). */
  highlight(id) {
    const entry = id ? this.inspectables.get(id) : null;
    if (!entry?.box) { this.outline.visible = false; return; }
    this.outline.box.copy(entry.box);
    this.outline.visible = true;
  }

  /**
   * Where a world point lands from a viewpoint: NDC coordinates, distance, and
   * whether it is inside the frame (with a 10% margin so it is not cut at the edge).
   */
  static project(view, point, aspect = 16 / 10, fov = VIEW_FOV) {
    const cam = new THREE.PerspectiveCamera(fov, aspect, 0.1, 200);
    cam.position.set(...view.pos);
    cam.rotation.set(view.pitch || 0, view.yaw, 0, 'YXZ');
    cam.updateMatrixWorld(true);
    const p = new THREE.Vector3().copy(point).project(cam);
    const dist = cam.position.distanceTo(point);
    const inside = Math.abs(p.x) <= 0.9 && Math.abs(p.y) <= 0.9 && p.z > -1 && p.z < 1;
    return { inside, ndc: p, dist };
  }

  /** The best of a zone's views for an inspectable: in frame and nearest. */
  bestView(id, viewIds, aspect) {
    const focus = this.inspectables.get(id)?.focus;
    if (!focus) return viewIds[0];
    let best = null;
    for (const v of viewIds) {
      const r = Warehouse.project(Warehouse.VIEWS[v], focus, aspect);
      if (r.inside && (!best || r.dist < best.dist)) best = { v, dist: r.dist };
    }
    return best?.v ?? viewIds[0];
  }

  /** Yaw and pitch (LookController convention) that aim from `pos` at an inspectable. */
  aimAt(id, pos) {
    const f = this.inspectables.get(id)?.focus;
    if (!f) return null;
    const dx = f.x - pos.x, dy = f.y - pos.y, dz = f.z - pos.z;
    return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
  }

  /** Yellow ramped cable cover: a wedge profile extruded across the cable. */
  _ramp(x, z) {
    const shape = new THREE.Shape();
    shape.moveTo(-0.28, 0); shape.lineTo(-0.1, 0.07); shape.lineTo(0.1, 0.07); shape.lineTo(0.28, 0); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.0, bevelEnabled: false });
    geo.translate(0, 0, -0.5);
    const ramp = new THREE.Mesh(geo, MAT.rampYellow);
    ramp.rotation.y = Math.PI / 2; // profile across the cable, length along it
    ramp.position.set(x, 0, z);
    ramp.castShadow = ramp.receiveShadow = true;
    // Black end stripes so it reads as a standard yellow/black cable protector.
    const g = new THREE.Group();
    g.add(ramp);
    for (const sx of [-0.45, 0.45]) g.add(this._box(0.08, 0.072, 0.4, MAT.rubber, x + sx, 0.036, z));
    return g;
  }

  /**
   * Merge every static mesh that is neither inspectable nor animated into one
   * mesh per material (draw-call budget: ≤ 300 on Medium). Inspectables stay
   * separate so raycasting can identify them; trucks and workers stay separate
   * because the replay and ambient life systems move them.
   */
  _mergeStatic() {
    this.scene.updateMatrixWorld(true);
    const keep = new Set();
    const markTree = (o) => o.traverse((c) => keep.add(c));
    for (const { mesh } of this.inspectables.values()) markTree(mesh);
    for (const w of this._workers) markTree(w);
    for (const o of this.scene.children) if (o.userData.dynamic) markTree(o);
    const byMaterial = new Map();
    this.scene.traverse((o) => {
      if (!o.isMesh || keep.has(o) || o.material.transparent) return;
      if (!byMaterial.has(o.material)) byMaterial.set(o.material, []);
      byMaterial.get(o.material).push(o);
    });
    for (const [material, meshes] of byMaterial) {
      if (meshes.length < 2) continue;
      const geos = meshes.map((m) => {
        const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld);
        for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
        return g;
      });
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      for (const g of geos) g.dispose();
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = meshes.some((m) => m.castShadow);
      mesh.receiveShadow = true;
      for (const m of meshes) m.removeFromParent();
      this.scene.add(mesh);
    }
  }

  /** Apply a quality preset: real-time shadows only when the preset has a shadow map. */
  applyPreset(renderer, def) {
    this._renderer = renderer;
    const on = def.shadowMapSize > 0;
    renderer.shadowMap.enabled = on;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = on;
    if (on && this.keyLight.shadow.mapSize.x !== def.shadowMapSize) {
      this.keyLight.shadow.mapSize.set(def.shadowMapSize, def.shadowMapSize);
      this.keyLight.shadow.map?.dispose();
      this.keyLight.shadow.map = null;
      renderer.shadowMap.needsUpdate = true;
    }
    this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }

  /**
   * CC0 PBR maps from Poly Haven (1k JPG; see ATTRIBUTION.md). Applied to the shared
   * floor, rack-steel and pallet materials. The spill keeps its own glossy material,
   * so the matte textured floor makes its sheen easier to see.
   */
  _applyTextures() {
    const base = `${import.meta.env.BASE_URL}assets/tex/`;
    const loader = new THREE.TextureLoader();
    const set = (mat, prefix, repeat, { normalScale = 1 } = {}) => {
      const load = (file, srgb) => {
        const t = loader.load(base + file);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repeat[0], repeat[1]);
        t.anisotropy = 4;
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        return t;
      };
      if (prefix.color) {
        mat.map = load(prefix.color, true);
        mat.color.set(0xffffff); // the color map carries the albedo
      }
      mat.normalMap = load(prefix.normal, false);
      mat.normalScale.set(normalScale, normalScale);
      mat.roughnessMap = load(prefix.rough, false);
      mat.needsUpdate = true;
    };
    // Floor plane is 64 m x 44 m; one texture tile per ~3 m.
    set(MAT.concrete, {
      color: 'concrete_floor_worn_001_color-6e40c0fc90.jpg',
      normal: 'concrete_floor_worn_001_normal-523bd94a1b.jpg',
      rough: 'concrete_floor_worn_001_rough-069efe4ca0.jpg',
    }, [21, 15], { normalScale: 0.6 });
    // Uprights keep their painted blue (the plate's color map reads near-black at this
    // scale); the normal and roughness maps add wear and scuffing.
    set(MAT.steelBlue, {
      normal: 'blue_metal_plate_normal-970f0273c9.jpg',
      rough: 'blue_metal_plate_rough-37168cf571.jpg',
    }, [1, 4], { normalScale: 0.5 });
    set(MAT.palletWood, {
      color: 'wood_planks_grey_color-d758be23e8.jpg',
      normal: 'wood_planks_grey_normal-5e570e57d6.jpg',
      rough: 'wood_planks_grey_rough-ef640502ce.jpg',
    }, [1, 1], { normalScale: 0.8 });
  }

  _add(mesh, { inspectable = null, label = null } = {}) {
    this.scene.add(mesh);
    if (inspectable) this.inspectables.set(inspectable, { mesh, label });
    return mesh;
  }

  _box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  _build() {
    // Floor with painted walkway
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(64, 44), MAT.concrete);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    for (const z of [-4.5, 4.5]) {
      const line = this._box(64, 0.005, 0.15, MAT.paintedLine, 0, 0.003, z);
      line.castShadow = false;
      this.scene.add(line);
    }

    // Perimeter walls + roof (dimmed so cues read clearly)
    const wallN = this._box(64, 9, 0.3, MAT.wall, 0, 4.5, -22);
    const wallS = this._box(64, 9, 0.3, MAT.wall, 0, 4.5, 22);
    const wallW = this._box(0.3, 9, 44, MAT.wall, -32, 4.5, 0);
    const wallE = this._box(0.3, 9, 44, MAT.wall, 32, 4.5, 0);
    for (const w of [wallN, wallS, wallW, wallE]) w.receiveShadow = true;
    this.scene.add(wallN, wallS, wallW, wallE);
    const roof = this._box(64, 0.2, 44, MAT.roof, 0, 9, 0);
    roof.castShadow = false;
    this.scene.add(roof);

    // Overhead structural steel ceiling trusses for warehouse depth
    for (let z = -16; z <= 16; z += 8) {
      const truss = this._box(62, 0.28, 0.22, MAT.doorGrey, 0, 8.65, z);
      truss.castShadow = false;
      this.scene.add(truss);
    }

    // Dock doors (north wall) — one is the blocked-exit hazard context
    for (let i = -2; i <= 2; i++) {
      this.scene.add(this._box(4.4, 4.6, 0.15, MAT.doorGrey, i * 7, 2.3, -21.7));
    }
    const exitSign = this._box(1.4, 0.4, 0.08, MAT.exitGreen, 14, 3.4, -21.5);
    this._add(exitSign, { inspectable: null });

    // Racking bays (receiving/packing zone: x from -30 to 12)
    for (let bay = 0; bay < 6; bay++) this._rack(-29 + bay * 7, -12);
    // Aisle racking (assessed zone: two rows forming an aisle at x>14)
    for (let bay = 0; bay < 3; bay++) this._rack(16 + bay * 6, -8);
    for (let bay = 0; bay < 3; bay++) this._rack(16 + bay * 6, 8);

    // Charging area (west): charger + frayed supply cable (hazard), and a second cable
    // run under a yellow ramped cable cover (distractor), clear of the frayed plug end.
    const frayed = new THREE.Group();
    frayed.add(this._box(1.6, 1.4, 0.5, MAT.darkPlastic, -28, 0.7, 10));
    const cable = this._box(6.0, 0.06, 0.12, MAT.rubber, -24.8, 0.04, 10.9);
    frayed.add(cable);
    // Split insulation near the plug end: a pale inner-sheath section with copper
    // strands splayed out (about 5 cm thick bundle so it reads at 4–6 m).
    frayed.add(this._box(0.34, 0.08, 0.14, MAT.innerSheath, -21.65, 0.05, 10.9));
    for (let i = 0; i < 5; i++) {
      const strand = this._box(0.32, 0.025, 0.025, MAT.copper, -21.6 + i * 0.03, 0.09 + (i % 2) * 0.03, 10.84 + i * 0.035);
      strand.rotation.set(0, (i - 2) * 0.45, 0.35 + i * 0.12);
      strand.castShadow = false;
      frayed.add(strand);
    }
    frayed.add(this._box(0.22, 0.12, 0.16, MAT.darkPlastic, -21.25, 0.07, 10.9)); // plug
    this.scene.add(frayed);
    this._add(frayed, { inspectable: 'hazard-frayed-cable', label: 'Battery charger and cable (charging area)' });

    const ramped = new THREE.Group();
    ramped.add(this._box(11.5, 0.05, 0.1, MAT.rubber, -26.2, 0.03, 13)); // second cable run
    ramped.add(this._ramp(-24.5, 13));
    this.scene.add(ramped);
    this._add(ramped, { inspectable: 'distractor-ramped-cable', label: 'Ramped charging cable (charging area)' });

    // Packing station (east): one cutting machine on the bench. The WEST end has its
    // orange guard fitted (distractor); the EAST end shows empty guard brackets and an
    // exposed blade (hazard). Same machine, only the guard differs.
    const bench = this._box(6, 0.9, 1.2, MAT.palletWood, 26, 0.45, 14);
    this.scene.add(bench);
    const machine = this._box(1.8, 0.8, 1.0, MAT.darkPlastic, 25.6, 1.3, 14);
    this.scene.add(machine);
    const guarded = new THREE.Group();
    guarded.add(this._box(0.3, 0.12, 0.12, MAT.steelOrange, 24.6, 1.6, 13.6)); // bracket
    guarded.add(this._box(0.06, 0.55, 1.1, MAT.steelOrange, 24.55, 1.25, 14)); // guard panel
    guarded.add(this._box(0.3, 0.12, 0.12, MAT.steelOrange, 24.6, 1.6, 14.4)); // bracket
    this.scene.add(guarded);
    this._add(guarded, { inspectable: 'distractor-guarded-machine', label: 'Guarded machine (packing station)' });
    const unguarded = new THREE.Group();
    unguarded.add(this._box(0.3, 0.12, 0.12, MAT.steelOrange, 26.6, 1.6, 13.6)); // empty bracket
    unguarded.add(this._box(0.3, 0.12, 0.12, MAT.steelOrange, 26.6, 1.6, 14.4)); // empty bracket
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.02, 32), MAT.blade);
    blade.rotation.z = Math.PI / 2;
    blade.position.set(26.62, 1.3, 14);
    unguarded.add(blade);
    this.scene.add(unguarded);
    this._add(unguarded, { inspectable: 'hazard-missing-guard', label: 'Packing bench with cutting machine' });

    // Receiving dock props
    this._palletStack(-8, -18, 3, true); // wrapped tall stack (about 3 m) — distractor
    this._add(this.scene.children[this.scene.children.length - 1], { inspectable: 'distractor-secured-stack', label: 'Wrapped tall pallet stack (receiving)' });
    this._palletStack(2, -18, 1, false);

    // Spill: dark, glossy, irregular outline (not a circle) about 2 m across.
    const spillShape = new THREE.Shape();
    const lobes = [1.0, 0.82, 1.12, 0.7, 0.95, 1.18, 0.78, 1.05, 0.88, 1.1, 0.74, 0.96];
    const pts = lobes.map((r, i) => {
      const a = (i / lobes.length) * Math.PI * 2;
      return new THREE.Vector2(Math.cos(a) * r * 1.15, Math.sin(a) * r * 0.75);
    });
    spillShape.moveTo(pts[0].x, pts[0].y);
    spillShape.splineThru([...pts.slice(1), pts[0]]); // smooth, irregular puddle edge
    const spill = new THREE.Mesh(new THREE.ShapeGeometry(spillShape, 6), MAT.spill);
    spill.rotation.x = -Math.PI / 2;
    spill.position.set(-4, 0.012, -10);
    this._add(spill, { inspectable: 'hazard-spill', label: 'Dark glossy patch on the floor (receiving)' });

    // Trip hazard: hose stretched across the walkway
    const hose = this._box(7, 0.09, 0.18, MAT.rubber, -12, 0.05, 2.2);
    hose.rotation.y = 0.5;
    this._add(hose, { inspectable: 'hazard-trip-hose', label: 'Hose stretched across the walkway (main floor)' });

    // Blocked fire exit (assessed zone): boxes in front of the east-side exit
    this._palletStack(29.6, -2, 2, false, true);
    const blocked = this.scene.children[this.scene.children.length - 1];
    this._add(blocked, { inspectable: 'hazard-blocked-exit', label: 'Boxes in front of the east fire exit' });
    const exitSignE = this._box(1.4, 0.4, 0.08, MAT.exitGreen, 31.7, 3.4, -2);
    this._add(exitSignE);

    // Damaged upright (assessed zone): stays blue like every other upright; it reads by
    // SHAPE — a kink at mid-height bulging into the aisle — with a small bare-metal
    // scuff at the impact point (visual review V8).
    const rackGroup = this.scene.getObjectByName(`rack-${16}-8`);
    rackGroup?.children.find((c) => c.name === 'upright-0')?.removeFromParent();
    const bent = new THREE.Group();
    bent.add(this._box(0.12, 2.4, 0.12, MAT.steelBlue, 16, 1.2, 8));
    const k1 = this._box(0.12, 0.62, 0.12, MAT.steelBlue, 16, 2.68, 7.86);
    k1.rotation.x = -0.5;
    const k2 = this._box(0.12, 0.62, 0.12, MAT.steelBlue, 16, 3.22, 7.86);
    k2.rotation.x = 0.5;
    bent.add(k1, k2, this._box(0.12, 2.5, 0.12, MAT.steelBlue, 16, 4.75, 8));
    bent.add(this._box(0.135, 0.16, 0.02, MAT.scuff, 16, 2.95, 7.71));
    this.scene.add(bent);
    this._add(bent, { inspectable: 'hazard-damaged-upright', label: 'Bent rack upright (aisle)' });

    // Pallet overhang (assessed zone): a loaded pallet on the second beam level of the
    // x=22 bay, rotated and pushed about 0.5 m past the rack front into the aisle.
    const overhang = new THREE.Group();
    overhang.add(this._pallet(0, 0, 0), this._box(1.5, 0.8, 1.1, MAT.cardboard, 0, 0.5, 0));
    overhang.position.set(23.4, 2.2, 7.4);
    overhang.rotation.y = 0.3;
    this.scene.add(overhang);
    this._add(overhang, { inspectable: 'hazard-overhang', label: 'Pallet overhanging the rack beam (aisle)' });

    // Unwrapped carton stack leaning about 12° on the second beam level (x=16 bay).
    const leaning = new THREE.Group();
    for (let i = 0; i < 3; i++) leaning.add(this._box(0.55, 0.5, 0.55, MAT.cardboard, (i % 2) * 0.04, 0.25 + i * 0.5, 0));
    leaning.position.set(18.4, 2.12, 7.75);
    leaning.rotation.z = 0.21;
    this.scene.add(leaning);
    this._add(leaning, { inspectable: 'hazard-leaning-stack', label: 'Leaning stack of boxes (aisle)' });

    // Animated-movie stylized warehouse characters (v2.0.0)
    this._worker(-14, -6, 0.9, false, {
      id: 'worker-1',
      name: 'Associate Maya',
      skinColor: 0xd99b78,
      hairColor: 0x2a1d17,
      hatColor: 0xffd100,
      topColor: 0x243b55,
      prop: 'clipboard',
    });
    // Replay-only pedestrian: hidden during the hunt (realism review R3).
    this.replayPedestrian = this._worker(20, 0, -2.4, true, {
      id: 'replay-pedestrian',
      name: 'Order Picker Alex',
      skinColor: 0xc68662,
      hairColor: 0x231914,
      hatColor: 0xffd100,
      topColor: 0x2b5070,
      initialAction: 'walk',
    });
    this.replayPedestrian.visible = false;
    this._worker(-8, 15, 2.2, false, {
      id: 'worker-2',
      name: 'Associate Devon',
      skinColor: 0x8d583c,
      hairColor: 0x181311,
      hatColor: 0xffd100,
      topColor: 0x2e4c6d,
      prop: 'tablet',
    });
    this.supervisorSam = this._worker(11, -10, -0.6, false, {
      id: 'supervisor-sam',
      name: 'Supervisor Sam',
      skinColor: 0xe2ab8b,
      hairColor: 0x4a3525,
      hatColor: 0xf4f6f8,
      topColor: 0x1e3a5f,
      prop: 'clipboard',
      glasses: true,
    });

    // Reach truck (medium detail, primitives)
    this._truck = this._buildTruck();
    // Parked truck (practice-zone neutral item) stands in the charging area, where
    // its zone is; the replay uses its own truck, hidden during the hunt (R4).
    const parked = this._buildTruck();
    parked.position.set(-25, 0, 6);
    parked.rotation.y = 0.3;
    // Lockout card on the cab (cue: keys removed, card shows lockout).
    const card = this._box(0.22, 0.3, 0.02, new THREE.MeshStandardMaterial({ color: 0xd7263d, roughness: 0.7 }), 0, 1.7, 0.72);
    card.castShadow = false;
    parked.add(card);
    groundProp(parked, { contactShadow: !this.headless });
    this.scene.add(parked);
    this._add(parked, { inspectable: 'neutral-parked-truck', label: 'Parked reach truck (charging area)' });
    this._truck.position.set(10, 0, 2);
    this._truck.rotation.y = Math.PI / 2;
    this._truck.visible = false;
    this._truck.userData.dynamic = true;
    this.scene.add(this._truck);

    // Clear aisle floor between the rack rows (assessed zone, neutral item). No visible
    // mesh: a hit proxy marks the floor area, at LOW pick priority so it never steals
    // clicks from the exit, overhang or truck behind or above it.
    const aisleFloor = new THREE.Object3D();
    aisleFloor.position.set(23, 0, 0);
    this.scene.add(aisleFloor);
    this._add(aisleFloor, { inspectable: 'neutral-empty-aisle-end', label: 'Aisle floor between the rack rows' });
    Object.assign(this.inspectables.get('neutral-empty-aisle-end'), {
      lowPriority: true,
      focus: new THREE.Vector3(23, 0, 0),
      boxOverride: new THREE.Box3(new THREE.Vector3(17, -0.05, -1.4), new THREE.Vector3(29, 0.08, 1.4)),
    });

    this._buildDockExtras();
    this._buildTransferZone();

    // Pole-mounted convex mirror at the blind corner (north aisle end). It is tilted
    // about 40° upward so it shows the roof structure, not the cross-aisle (V7).
    const mirror = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.4, 10), MAT.darkPlastic);
    pole.position.set(14.8, 1.7, -1.6);
    const head = new THREE.Group();
    head.position.set(14.8, 3.55, -1.6);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.75, 28, 12, 0, Math.PI * 2, 0, 0.62), MAT.mirror);
    dome.rotation.x = Math.PI / 2; // dome faces +z before tilting
    dome.position.z = -0.6;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.04, 8, 28), new THREE.MeshStandardMaterial({ color: 0xffd100, roughness: 0.6 }));
    rim.position.z = -0.03;
    const back = new THREE.Mesh(new THREE.CircleGeometry(0.46, 28), MAT.darkPlastic);
    back.rotation.y = Math.PI;
    back.position.z = -0.04;
    head.add(dome, rim, back);
    // Faces the aisle-north viewpoint but is pitched ~40° up, so it shows the roof.
    head.rotation.set(-0.7, 2.07, 0, 'YXZ');
    mirror.add(pole, head);
    this.scene.add(mirror);
    this._add(mirror, { inspectable: 'hazard-misaligned-mirror', label: 'Convex mirror at the aisle end (misaligned)' });
    this.inspectables.get('hazard-misaligned-mirror').focus = new THREE.Vector3(14.8, 3.4, -1.6);

    // Lighting: cold industrial LED high-bay palette + shadow-casting key light
    this.scene.add(new THREE.AmbientLight(0xd4e0ec, 0.58));
    const hemi = new THREE.HemisphereLight(0xe8f1f5, 0x4b5056, 0.55);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xe8f1f5, 1.55);
    key.position.set(18, 12, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -34; key.shadow.camera.right = 34;
    key.shadow.camera.top = 24; key.shadow.camera.bottom = -24;
    key.shadow.camera.far = 60;
    key.shadow.bias = -0.0004;
    this.scene.add(key);
    this.keyLight = key;
    for (const [x, z] of [[-20, -14], [0, -14], [-20, 8], [8, 8], [24, 14]]) {
      const lamp = new THREE.Mesh(
        new THREE.CircleGeometry(0.55, 16),
        new THREE.MeshStandardMaterial({ color: 0xe8f1f5, emissive: 0xe8f1f5, emissiveIntensity: 1.5 }),
      );
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(x, 8.8, z);
      this.scene.add(lamp);
    }
  }

  /** Practice-zone dock hazards that are visible from inside the building. */
  _buildDockExtras() {
    // Door at x = -7: trailer backed up, but the dock-lock signal shows red (not secured).
    const trailerInterior = this._box(4.2, 4.2, 0.1, new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.9 }), -7, 2.3, -21.6);
    trailerInterior.castShadow = false;
    this.scene.add(trailerInterior);
    const trailerFloor = this._box(4.2, 0.12, 1.2, MAT.palletWood, -7, 1.22, -21.2);
    this.scene.add(trailerFloor);
    // Dock signal housing: a wall-mounted box (0.6 × 1.2 m) with hoods over a lit red
    // lamp and an unlit green lamp, sized to read from the dock viewpoint (V6).
    const signal = new THREE.Group();
    signal.add(this._box(0.6, 1.2, 0.18, MAT.darkPlastic, -4.2, 2.2, -21.55));
    const red = new THREE.Mesh(new THREE.CircleGeometry(0.19, 20), new THREE.MeshStandardMaterial({ color: 0xd7263d, emissive: 0xd7263d, emissiveIntensity: 2.5 }));
    red.position.set(-4.2, 2.48, -21.45);
    const green = new THREE.Mesh(new THREE.CircleGeometry(0.19, 20), new THREE.MeshStandardMaterial({ color: 0x1d4d2a, roughness: 0.6 }));
    green.position.set(-4.2, 1.92, -21.45);
    for (const y of [2.7, 2.14]) signal.add(this._box(0.46, 0.04, 0.16, MAT.darkPlastic, -4.2, y, -21.38));
    signal.add(red, green);
    this.scene.add(signal);
    this._add(signal, { inspectable: 'hazard-unchocked-trailer', label: 'Open dock door with a trailer and a red dock signal' });
  }

  /** Transfer zone: outbound staging lane on the south side (no hints). */
  _buildTransferZone() {
    // Walkway through the lane: two yellow lines running toward the south wall.
    const lineA = this._box(0.15, 0.005, 10, MAT.paintedLine, 2.5, 0.003, 16.5);
    const lineB = this._box(0.15, 0.005, 10, MAT.paintedLine, 5.5, 0.003, 16.5);
    lineA.castShadow = lineB.castShadow = false;
    this.scene.add(lineA);
    this._add(lineB, { inspectable: 't-neutral-clear-line', label: 'Walkway through the staging lane' });

    // A second reach truck, loaded too high to see over, parked across the walkway line.
    const truck2 = this._buildTruck();
    for (let i = 0; i < 3; i++) truck2.add(this._box(1.0, 0.75, 1.0, MAT.cardboard, 0, 1.3 + i * 0.78, -1.75));
    truck2.position.set(5.2, 0, 18);
    truck2.rotation.y = Math.PI * 0.55;
    this.scene.add(truck2);
    this._add(truck2, { inspectable: 't-hazard-straddle-load', label: 'Loaded truck parked across the walkway' });

    // Battery-change bay door on the south wall, blocked by a wheeled cage; eyewash beside it.
    this.scene.add(this._box(3.2, 3.4, 0.15, MAT.doorGrey, -3, 1.7, 21.7));
    const cage = new THREE.Group();
    const wire = new THREE.MeshStandardMaterial({ color: 0x9aa3ab, roughness: 0.4, metalness: 0.7, wireframe: true });
    cage.add(this._box(1.2, 1.6, 0.8, wire, 0, 0.9, 0));
    for (const [wx, wz] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 10), MAT.rubber);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.08, wz);
      cage.add(w);
    }
    cage.position.set(-3, 0, 20.9);
    this.scene.add(cage);
    // Eyewash station: white wall cabinet with a green sign panel above and an empty,
    // tipped-over wash bottle on top (V14).
    const station = new THREE.Group();
    station.add(this._box(0.55, 0.7, 0.22, new THREE.MeshStandardMaterial({ color: 0xeef0f0, roughness: 0.6 }), -0.6, 1.35, 21.75));
    station.add(this._box(0.5, 0.3, 0.03, MAT.exitGreen, -0.6, 2.05, 21.84));
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0xdfe8ee, roughness: 0.3, transparent: true, opacity: 0.45 }));
    bottle.rotation.z = Math.PI / 2;
    bottle.position.set(-0.6, 1.78, 21.72);
    station.add(bottle);
    cage.add(station);
    station.position.set(3, 0, -20.9); // cage-local offset back to world placement
    this._add(cage, { inspectable: 't-hazard-charging-block', label: 'Battery bay door and eyewash station' });

    // Black-and-yellow striped self-closing gate at the lane entrance (controlled condition).
    let stripes = null;
    if (!this.headless) {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 32;
      const g = c.getContext('2d');
      for (let i = -2; i < 10; i++) {
        g.fillStyle = i % 2 ? '#111111' : '#ffd100';
        g.beginPath();
        g.moveTo(i * 16, 32); g.lineTo(i * 16 + 16, 32); g.lineTo(i * 16 + 32, 0); g.lineTo(i * 16 + 16, 0);
        g.fill();
      }
      stripes = new THREE.CanvasTexture(c);
      stripes.colorSpace = THREE.SRGBColorSpace;
    }
    const gate = new THREE.Group();
    const bar = this._box(2.4, 0.18, 0.08, new THREE.MeshStandardMaterial(stripes ? { map: stripes, roughness: 0.6 } : { color: 0xffd100, roughness: 0.6 }), 1.2, 1.0, 0);
    const post = this._box(0.12, 1.2, 0.12, MAT.darkPlastic, 0, 0.6, 0);
    gate.add(bar, post);
    gate.position.set(2.6, 0, 11.6);
    gate.rotation.y = -0.6;
    this.scene.add(gate);
    this._add(gate, { inspectable: 't-distractor-striped-gate', label: 'Striped swing gate at the lane entrance' });
  }

  _rack(x, z) {
    const g = new THREE.Group();
    g.name = `rack-${x}-${z}`;
    for (let i = 0; i < 2; i++) {
      const upright = this._box(0.12, 6, 0.12, MAT.steelBlue, x + i * 2.8, 3, z);
      upright.name = `upright-${i}`;
      g.add(upright);
    }
    for (const y of [2.05, 4.15]) {
      const beam = this._box(2.9, 0.14, 0.1, MAT.steelOrange, x + 1.4, y, z);
      g.add(beam);
      // pallet + boxes on each level
      const pallet = this._pallet(x + 1.4, y + 0.08, z);
      g.add(pallet);
      const box = this._box(1.6, 0.9, 1.1, MAT.cardboard, x + 1.4, y + 0.6, z);
      g.add(box);
    }
    // floor-level pallet
    g.add(this._pallet(x + 1.4, 0.08, z));
    this.scene.add(g);
    return g;
  }

  _pallet(x, y, z) {
    const p = new THREE.Group();
    const deck = this._box(2.2, 0.1, 1.4, MAT.palletWood, 0, 0, 0);
    p.add(deck);
    for (const sx of [-0.9, 0, 0.9]) p.add(this._box(0.16, 0.08, 1.4, MAT.palletWood, sx, -0.09, 0));
    p.position.set(x, y, z);
    return p;
  }

  _palletStack(x, z, levels, wrapped, blocked = false) {
    const g = new THREE.Group();
    g.add(this._pallet(0, 0.08, 0));
    for (let l = 0; l < levels; l++) {
      for (let i = 0; i < 3; i++) {
        const b = this._box(0.85, 0.85, 0.85, MAT.cardboard, -0.6 + i * 0.62, 0.55 + l * 0.9, 0);
        b.rotation.y = (i % 2) * 0.06;
        g.add(b);
      }
    }
    if (wrapped) {
      const wrap = this._box(2.3, levels * 0.92 + 0.3, 1.5, MAT.shrinkWrap, 0, (levels * 0.92) / 2 + 0.15, 0);
      g.add(wrap);
    }
    if (blocked) g.rotation.y = 0.5;
    g.position.set(x, 0, z);
    this.scene.add(g);
    return g;
  }

  /**
   * Create an articulated animated-movie stylized warehouse character (`createAnimatedCharacter`)
   * with hardhat, reflective hi-vis vest, blinking, breathing, and hand props.
   */
  _worker(x, z, yaw = 0, laneOffender = false, charOpts = {}) {
    const ctrl = createAnimatedCharacter({
      id: charOpts.id || `worker-${this._workers.length + 1}`,
      name: charOpts.name || 'Warehouse Associate',
      height: charOpts.height || 1.73,
      skinColor: charOpts.skinColor ?? 0xd99b78,
      hairColor: charOpts.hairColor ?? 0x2a1d17,
      hairStyle: 'hardhat',
      hatColor: charOpts.hatColor ?? 0xffd100,
      outfit: 'hivis',
      topColor: charOpts.topColor ?? 0x243b55,
      bottomColor: charOpts.bottomColor ?? 0x25303b,
      prop: charOpts.prop || 'none',
      glasses: Boolean(charOpts.glasses),
      initialAction: charOpts.initialAction || 'idle',
    });
    const g = ctrl.root;
    g.userData.dynamic = true;
    if (laneOffender) {
      // Trolley being pushed out into the aisle (replay context)
      const trolley = this._box(0.48, 0.72, 0.62, MAT.steelOrange, 0, 0.42, 0.58);
      g.add(trolley);
    }
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    this.scene.add(g);
    this._workers.push(g);
    this._characterCtrls.push(ctrl);
    return g;
  }

  _buildTruck() {
    const g = new THREE.Group();
    const body = this._box(1.1, 1.0, 2.0, MAT.truckBody, 0, 0.75, 0);
    const mast = this._box(0.14, 2.6, 0.14, MAT.darkPlastic, 0, 1.55, -1.0);
    const carriage = this._box(1.0, 0.5, 0.1, MAT.darkPlastic, 0, 1.0, -1.2);
    const counterweight = this._box(1.15, 0.6, 0.5, MAT.darkPlastic, 0, 0.55, 1.1);
    const roofPost1 = this._box(0.08, 1.1, 0.08, MAT.darkPlastic, -0.45, 1.85, 0.3);
    const roofPost2 = this._box(0.08, 1.1, 0.08, MAT.darkPlastic, 0.45, 1.85, 0.3);
    const roofTop = this._box(1.0, 0.06, 1.0, MAT.darkPlastic, 0, 2.4, 0.2);
    const seat = this._box(0.6, 0.5, 0.5, MAT.rubber, 0, 1.35, 0.45);
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.08, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: 0xff6a13, emissive: 0xff6a13, emissiveIntensity: 1.6, roughness: 0.25 }),
    );
    beacon.position.set(0, 2.49, 0.2);
    g.add(body, mast, carriage, counterweight, roofPost1, roofPost2, roofTop, seat, beacon);
    const wheelMat = MAT.rubber;
    for (const [wx, wz] of [[-0.55, -0.7], [0.55, -0.7], [-0.5, 0.8], [0.5, 0.8]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 14), wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.22, wz);
      w.castShadow = true;
      g.add(w);
    }
    return g;
  }

  /**
   * Initialize v2.0.0 AmbientLifeManager systems:
   *  1. Animated-movie character breathing, blinking, and gaze tracking
   *  2. Volumetric skylight / high-bay LED shafts
   *  3. Floating warehouse dust motes
   *  4. Patrolling perimeter utility tug with flashing amber beacon & proximity safety stop
   *  5. Animated packing-line roller conveyor + moving parcel tote
   *  6. Glowing 3D floor viewpoint rings at each Warehouse.VIEWS stand point
   */
  _initAmbientLife({ reducedMotion = false } = {}) {
    this.life = new AmbientLifeManager(this.scene, { reducedMotion, seed: 404 });
    for (const c of this._characterCtrls) {
      this.life.addCharacter(c);
    }

    // Volumetric light shafts under high-bay luminaires
    this.life.addLightShafts({
      positions: [
        [-20, 6.2, -14],
        [0, 6.2, -14],
        [-20, 6.2, 8],
        [8, 6.2, 8],
        [24, 6.2, 14],
      ],
      rotation: [0, 0, -0.16],
      radiusTop: 0.45,
      radiusBottom: 1.85,
      height: 5.2,
      color: 0xe8f1f5,
      opacity: 0.085,
    });

    // Floating warehouse dust motes
    this.life.addParticleVolume({
      name: 'warehouse-dust-motes',
      center: [0, 2.8, 0],
      extents: [54, 4.8, 36],
      count: 220,
      color: 0xe8f1f5,
      size: 0.058,
      opacity: 0.42,
      drift: [0.07, 0.025, 0.05],
    });

    // Patrolling background utility cart on a safe perimeter loop (yields when camera is within 4 m)
    const { cart, wheels, beaconMesh } = this._buildPatrolCart();
    this.patrolCart = cart;
    this.scene.add(cart);
    this.life.addSplineMover(
      cart,
      [
        [-26, 0, -15.5],
        [9, 0, -15.5],
        [9, 0, -6.2],
        [-26, 0, -6.2],
      ],
      {
        closed: true,
        speed: 1.65,
        startU: 0.15,
        stopRadius: 4.0,
        wheels,
        beaconMesh,
      },
    );

    // Animated roller conveyor and reciprocating tote beside the packing bench
    this._buildConveyor();

    // Glowing floor rings at each of the 7 zone viewpoints
    this._buildViewpointRings();
  }

  _buildPatrolCart() {
    const cart = new THREE.Group();
    cart.name = 'ambient-patrol-cart';
    cart.userData.dynamic = true;

    const chassis = this._box(0.95, 0.36, 1.55, MAT.steelOrange, 0, 0.32, 0);
    const mast = this._box(0.75, 0.85, 0.12, MAT.darkPlastic, 0, 0.88, 0.62);
    const tote = this._box(0.78, 0.48, 0.88, MAT.cardboard, 0, 0.74, -0.18);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xffd100,
      emissive: 0xff6a13,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    const beaconMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 12), beaconMat);
    beaconMesh.position.set(0, 1.38, 0.62);
    cart.add(chassis, mast, tote, beaconMesh);

    const wheels = [];
    for (const [wx, wz] of [[-0.46, -0.52], [0.46, -0.52], [-0.46, 0.52], [0.46, 0.52]]) {
      const wheelPivot = new THREE.Group();
      wheelPivot.position.set(wx, 0.16, wz);
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 12), MAT.rubber);
      w.rotation.z = Math.PI / 2;
      wheelPivot.add(w);
      cart.add(wheelPivot);
      wheels.push(wheelPivot);
    }
    groundProp(cart, { contactShadow: !this.headless });
    return { cart, wheels, beaconMesh };
  }

  _buildConveyor() {
    const conv = new THREE.Group();
    conv.name = 'ambient-packing-conveyor';
    conv.userData.dynamic = true;
    conv.position.set(26, 0, 16.1);

    // Side rails + legs
    conv.add(
      this._box(4.4, 0.1, 0.08, MAT.steelBlue, 0, 0.78, -0.38),
      this._box(4.4, 0.1, 0.08, MAT.steelBlue, 0, 0.78, 0.38),
      this._box(0.1, 0.78, 0.76, MAT.darkPlastic, -2.0, 0.39, 0),
      this._box(0.1, 0.78, 0.76, MAT.darkPlastic, 2.0, 0.39, 0),
    );

    const rollerMat = new THREE.MeshStandardMaterial({ color: 0xb8c2cc, roughness: 0.32, metalness: 0.75 });
    for (let i = -8; i <= 8; i++) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.68, 10), rollerMat);
      r.rotation.x = Math.PI / 2;
      r.position.set(i * 0.24, 0.80, 0);
      conv.add(r);
      this.life.addOscillator(r, { axis: 'z', mode: 'spin', amplitude: 2.5 });
    }

    const tote = this._box(0.56, 0.34, 0.48, MAT.cardboard, 0, 1.01, 0);
    conv.add(tote);
    this.life.addOscillator(tote, { axis: 'x', mode: 'bob', amplitude: 1.25, frequency: 0.18 });
    this.scene.add(conv);
  }

  _buildViewpointRings() {
    const ringGroup = new THREE.Group();
    ringGroup.name = 'viewpoint-floor-rings';
    ringGroup.userData.dynamic = true;
    this.scene.add(ringGroup);

    for (const [viewId, v] of Object.entries(Warehouse.VIEWS)) {
      const [vx, , vz] = v.pos;
      const g = new THREE.Group();
      g.position.set(vx, 0.015, vz);

      const outer = new THREE.Mesh(
        new THREE.RingGeometry(0.32, 0.44, 28),
        new THREE.MeshBasicMaterial({
          color: 0xffd100,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
        }),
      );
      outer.rotation.x = -Math.PI / 2;
      g.add(outer);

      const beacon = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.08, 0),
        new THREE.MeshStandardMaterial({
          color: 0xffd100,
          emissive: 0xff6a13,
          emissiveIntensity: 0.75,
          roughness: 0.25,
        }),
      );
      beacon.position.y = 0.26;
      g.add(beacon);

      const proxy = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.45, 12), MAT.hit);
      proxy.position.set(vx, 0.22, vz);
      proxy.userData.viewId = viewId;
      proxy.userData.viewLabel = v.label;
      this.scene.add(proxy);
      proxy.updateMatrixWorld(true);
      this.viewpointProxies.push(proxy);

      ringGroup.add(g);
      this.viewpointRings.push({ viewId, group: g, outer, beacon, phase: this.viewpointRings.length * 0.9 });
    }
  }

  /**
   * Asynchronously load and place the 8 curated Poly Haven CC0 models into the warehouse
   * without blocking startup or altering the synchronous inspectable hit proxies.
   */
  async _loadPolyHavenModels() {
    this.models = new ModelLibrary();
    this.modelGroup = new THREE.Group();
    this.modelGroup.name = 'polyhaven-cc0-props';
    this.modelGroup.userData.dynamic = true;
    this.scene.add(this.modelGroup);

    const placements = [
      // WetFloorSign_01 staged at the north dock safety post & south staging post (away from the unguarded spill)
      { id: 'WetFloorSign_01', position: [-11.5, 0, -19.5], rotationY: 0.35, targetHeight: 0.68 },
      { id: 'WetFloorSign_01', position: [-6.5, 0, 19.2], rotationY: -0.4, targetHeight: 0.68 },
      // cardboard_box_01 on staging pallets and beside the packing bench
      { id: 'cardboard_box_01', position: [1.8, 0.15, -17.8], rotationY: 0.2, targetHeight: 0.46, contactShadow: false },
      { id: 'cardboard_box_01', position: [23.2, 0, 14.9], rotationY: -0.5, targetHeight: 0.48 },
      // Barrel_01 in the receiving supply bay
      { id: 'Barrel_01', position: [-18.5, 0, -19.2], rotationY: 0.1, targetHeight: 0.88 },
      { id: 'Barrel_01', position: [-17.4, 0, -18.9], rotationY: 1.2, targetHeight: 0.88 },
      // wooden_crate_01 along the heavy freight bay
      { id: 'wooden_crate_01', position: [-24.5, 0, -16.5], rotationY: 0.08, targetHeight: 0.82 },
      { id: 'wooden_crate_01', position: [12.2, 0, -18.6], rotationY: -0.15, targetHeight: 0.82 },
      // korean_fire_extinguisher_01 by dock safety pillar and charging station
      { id: 'korean_fire_extinguisher_01', position: [12.6, 0, -21.2], rotationY: 0, targetHeight: 0.62 },
      { id: 'korean_fire_extinguisher_01', position: [-29.6, 0, 7.8], rotationY: Math.PI / 2, targetHeight: 0.62 },
      // hanging_industrial_lamp along the high-bay ceiling truss
      { id: 'hanging_industrial_lamp', position: [-12, 7.65, -8], rotationY: 0, targetHeight: 0.85, contactShadow: false },
      { id: 'hanging_industrial_lamp', position: [6, 7.65, -8], rotationY: 0, targetHeight: 0.85, contactShadow: false },
      { id: 'hanging_industrial_lamp', position: [20, 7.65, 0], rotationY: 0, targetHeight: 0.85, contactShadow: false },
      // tool_cart beside the charging/maintenance station
      { id: 'tool_cart', position: [-29.2, 0, 12.1], rotationY: 0.45, targetHeight: 0.92 },
      // ladder_sectioned_01 stored safely along the west maintenance wall
      { id: 'ladder_sectioned_01', position: [-31.1, 0, -2.0], rotationY: Math.PI / 2, targetHeight: 2.15 },
    ];

    await Promise.all(
      placements.map((p) =>
        this.models.place(this.modelGroup, p.id, {
          position: p.position,
          rotationY: p.rotationY,
          targetHeight: p.targetHeight,
          castShadow: false,
          receiveShadow: true,
          contactShadow: p.contactShadow !== false,
        }),
      ),
    );
  }

  setCalmMode(active) {
    this.life?.setCalmMode(active);
  }

  setReducedMotion(reduced) {
    this.life?.setReducedMotion(reduced);
  }

  /** Advance all ambient life systems and floor ring animations. */
  update(dt = 0.016, camera = null) {
    this.life?.update(dt, camera);
    if (this.life && !this.life.reducedMotion) {
      const t = this.life.elapsed;
      for (const r of this.viewpointRings) {
        const s = 1 + Math.sin(t * 2.5 + r.phase) * 0.08;
        r.outer.scale.setScalar(s);
        r.beacon.position.y = 0.26 + Math.sin(t * 2.5 + r.phase) * 0.035;
        r.beacon.rotation.y = t * 1.3 + r.phase;
      }
    }
  }

  /**
   * Camera viewpoints per zone (yaw 0 looks north, -z; yaw π/2 looks west, -x).
   * Re-aimed so every inspectable of a zone is in frame from at least one of that
   * zone's views (visual review V1/V2; asserted in tests/unit/views.test.js).
   */
  static get VIEWS() {
    return {
      dock: { pos: [-3, 1.7, -6], yaw: 0.15, pitch: -0.12, label: 'Receiving dock' },
      main: { pos: [-6, 1.7, 8], yaw: 0.82, pitch: -0.12, label: 'Main floor' },
      charging: { pos: [-20, 1.7, 15], yaw: 0.8, pitch: -0.3, label: 'Charging area' },
      packing: { pos: [22, 1.7, 18], yaw: -Math.PI * 0.25, pitch: -0.1, label: 'Packing station' },
      aisleNorth: { pos: [21, 1.7, -5], yaw: 2.72, pitch: 0.08, label: 'Aisle, north end' },
      aisleSouth: { pos: [17, 1.7, 1], yaw: -Math.PI / 2, pitch: -0.1, label: 'Aisle, west entrance looking east' },
      transfer: { pos: [2, 1.7, 7], yaw: Math.PI, pitch: -0.12, label: 'Transfer zone (staging lane)' },
    };
  }
}
