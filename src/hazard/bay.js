/**
 * bay.js — Northwind Logistics Bay 4 at night (fictional), the v3 scene
 * (plan 10 §6.4). Builds the building, the racking, the dock, every catalog
 * object at real size (1 unit = 1 m) and the living-world motion systems.
 *
 * Loading (plan 10 §7, download gate):
 *   load()          the building, floor, racking and lights: what the title
 *                   screen shows (about 5 MB with the app and transcoder).
 *   loadProps()     every hazard, prop, sign and the HDRI reflections; starts at
 *                   the learner's first interaction (Start, a click or a key).
 *   loadPeople()    the five characters and the remaining dressing, right after.
 * Every catalog object is registered with app.inspect as soon as it exists.
 * @module hazard/bay
 */
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BAY, RACK, AISLE, RACK_NORTH_WALL, DOCK_DOORS, YARD_Y, WALKWAY_MAIN, WALKWAY_SOUTH, WALKWAY_STAGING, TRUCK_LANE_N, TRUCK_LANE_S, CROSS_AISLE_X, CROSSINGS, SPOTS, LIGHTS, ROOF_LIGHTS, VIEWS, BOUNDS, look } from './layout.js';
import { initLoaders, model, instanced, batchPlacements, loadTiling, loadDecal, MANIFEST, BASE } from './assets.js';
import { floorLightMap, lightCones, dustInBeams, roofSkyMaterial, spillMesh, contactShadow } from './materials.js';
import { Forklift, Walker, Idler } from './actors.js';
import { createSun } from '../v3/render-chain.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V3 = (a) => new THREE.Vector3(...a);
const box3 = new THREE.Box3();
const NO_RAY = () => {};

/** Rotate, then put the object's bottom centre at (x, y, z). */
export function placeOnFloor(obj, x, z, ry = 0, y = 0) {
  obj.rotation.y = ry;
  obj.position.set(0, 0, 0);
  obj.updateMatrixWorld(true);
  const b = box3.setFromObject(obj);
  obj.position.set(x - (b.min.x + b.max.x) / 2, y - b.min.y, z - (b.min.z + b.max.z) / 2);
  obj.updateMatrixWorld(true);
  return obj;
}
/** Hang the object on a wall (its front faces the room), bottom edge at height y. */
export function mountOnWall(obj, wall, u, y, inset = 0) {
  const ry = { N: 0, S: Math.PI, E: -Math.PI / 2, W: Math.PI / 2 }[wall];
  obj.rotation.y = ry;
  obj.position.set(0, 0, 0);
  obj.updateMatrixWorld(true);
  const b = box3.setFromObject(obj);
  const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
  if (wall === 'N') obj.position.set(u - cx, y - b.min.y, BAY.minZ + inset - b.min.z);
  if (wall === 'S') obj.position.set(u - cx, y - b.min.y, BAY.maxZ - inset - b.max.z);
  if (wall === 'E') obj.position.set(BAY.maxX - inset - b.max.x, y - b.min.y, u - cz);
  if (wall === 'W') obj.position.set(BAY.minX + inset - b.min.x, y - b.min.y, u - cz);
  obj.updateMatrixWorld(true);
  return obj;
}
const matAt = (x, y, z, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));

export class Bay {
  constructor(app) {
    this.app = app;
    this.engine = app.engine;
    this.scene = app.engine.scene;
    this.group = new THREE.Group();
    this.group.name = 'bay-4';
    this.scene.add(this.group);
    this.t = 0;
    this.ready = { shell: false, props: false, people: false };
    this.colliders = [];
    this.actors = {};
    this.flicker = 1;
    this._propsPromise = null;
    this._peoplePromise = null;
  }

  register(id, roots, opts) { return this.app.inspect.register(id, roots, opts); }

  // ---------------------------------------------------------------- shell
  async load() {
    await initLoaders(this.engine.renderer);
    const r = this.engine.renderer;
    // Until the HDRI arrives, a neutral room environment lights reflections.
    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.32;
    pm.dispose();
    this.scene.background = new THREE.Color(0x06080b);
    this.scene.fog = new THREE.FogExp2(0x10151c, 0.012);
    const preset = this.engine.quality.presetDef;
    // Key light: the high-bay grid read as one soft overhead source (shadows of
    // racks and loads), plus a cool fill.
    const sun = createSun(preset, { color: 0xf3efe6, intensity: 1.35, box: 30, far: 60 });
    sun.position.set(6, 30, 9);
    sun.target.position.set(0, 0, 0);
    this.group.add(sun, sun.target);
    this.key = sun;
    const hemi = new THREE.HemisphereLight(0x9fb3c8, 0x2a2622, 0.42);
    this.group.add(hemi);
    this.engine.quality.onChange((def) => {
      const s = def.shadowMapSize;
      sun.castShadow = s > 0;
      if (s > 0 && sun.shadow.mapSize.x !== s) { sun.shadow.mapSize.set(s, s); sun.shadow.map?.dispose(); sun.shadow.map = null; }
    });

    await Promise.all([this._building(), this._racking(), this._lights()]);
    this.colliders.push(
      new THREE.Box3(V3([BAY.minX - 3, -2, BAY.minZ - 3]), V3([BAY.minX, 14, BAY.maxZ + 3])),
      new THREE.Box3(V3([BAY.maxX, -2, BAY.minZ - 3]), V3([BAY.maxX + 3, 14, BAY.maxZ + 3])),
      new THREE.Box3(V3([BAY.minX - 3, -2, BAY.minZ - 3]), V3([BAY.maxX + 3, 14, BAY.minZ])),
      new THREE.Box3(V3([BAY.minX - 3, -2, BAY.maxZ]), V3([BAY.maxX + 3, 14, BAY.maxZ + 3])),
      new THREE.Box3(V3([BAY.minX - 3, BAY.height - 0.6, BAY.minZ - 3]), V3([BAY.maxX + 3, BAY.height + 4, BAY.maxZ + 3])),
    );
    this.ready.shell = true;
    return { colliders: this.colliders, bounds: BOUNDS, groundHeight: () => 0 };
  }

  async _building() {
    const [floorT, blockT, ironT, roofT, steelT] = await Promise.all([
      loadTiling('concrete_floor_worn_001', [12, 8]),
      loadTiling('concrete_block_wall', [1, 1]),
      loadTiling('corrugated_iron_02', [1, 1]),
      loadTiling('box_profile_metal_sheet', [12, 8]),
      loadTiling('blue_metal_plate', [1, 1]),
    ]);
    const W = BAY.maxX - BAY.minX, D = BAY.maxZ - BAY.minZ, H = BAY.height;
    // Floor: worn concrete with the light pools of the high-bay grid.
    const lm = floorLightMap();
    lm.channel = 0;
    const floorMat = new THREE.MeshStandardMaterial({ map: floorT.map, normalMap: floorT.normalMap, aoMap: floorT.armMap, roughnessMap: floorT.armMap, roughness: 0.82, metalness: 0, lightMap: lm, lightMapIntensity: 1.25, color: 0xb9b6ae });
    this.floorMat = floorMat;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), floorMat);
    floor.receiveShadow = true;
    floor.name = 'floor';
    this.group.add(floor);
    this.floorT = floorT;
    // Yard outside the dock (seen through the open doors), 1.22 m lower.
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(W + 20, 30).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: floorT.map, normalMap: floorT.normalMap, color: 0x3a3c40, roughness: 0.95 }));
    yard.position.set(0, YARD_Y, BAY.minZ - 15);
    this.group.add(yard);
    this._dockFaceT = blockT;
    // Walls: block work to 3 m, corrugated cladding above; dock openings in the north wall.
    const wallMat = (t, rep, color) => {
      const m = new THREE.MeshStandardMaterial({ map: t.map.clone(), normalMap: t.normalMap.clone(), roughnessMap: t.armMap.clone(), aoMap: t.armMap.clone(), color, roughness: 1, metalness: t === ironT ? 0.4 : 0 });
      for (const k of ['map', 'normalMap', 'roughnessMap', 'aoMap']) { m[k].repeat.set(...rep); m[k].needsUpdate = true; }
      return m;
    };
    const blockMat = wallMat(blockT, [W / 3, 1], 0x9a9a96);
    const ironMat = wallMat(ironT, [W / 3, 7 / 3], 0x5d6a74);
    const blockMatShort = wallMat(blockT, [D / 3, 1], 0x9a9a96);
    const ironMatShort = wallMat(ironT, [D / 3, 7 / 3], 0x5d6a74);
    const slab = (w, h, mat, x, y, z, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    // South, east, west walls.
    slab(W, 3, blockMat, 0, 1.5, BAY.maxZ, Math.PI); slab(W, H - 3, ironMat, 0, 3 + (H - 3) / 2, BAY.maxZ, Math.PI);
    slab(D, 3, blockMatShort, BAY.maxX, 1.5, 0, -Math.PI / 2); slab(D, H - 3, ironMatShort, BAY.maxX, 3 + (H - 3) / 2, 0, -Math.PI / 2);
    slab(D, 3, blockMatShort, BAY.minX, 1.5, 0, Math.PI / 2); slab(D, H - 3, ironMatShort, BAY.minX, 3 + (H - 3) / 2, 0, Math.PI / 2);
    // North wall in pieces around the three 2.74 x 3.05 m dock openings.
    const ow = 2.74, oh = 3.05;
    const xs = DOCK_DOORS.map((d) => d.x).sort((a, b) => a - b);
    let x0 = BAY.minX;
    const nb = (w, h, x, y, mat) => { const m = wallMat(mat === 'iron' ? ironT : blockT, [w / 3, h / 3], mat === 'iron' ? 0x5d6a74 : 0x9a9a96); slab(w, h, m, x, y, BAY.minZ, 0); };
    for (const x of xs) {
      const l = x - ow / 2;
      if (l > x0) nb(l - x0, 3, (x0 + l) / 2, 1.5, 'block');
      x0 = x + ow / 2;
      nb(ow, 3 - oh + 0.0001, x, oh + (3 - oh) / 2, 'block');
    }
    nb(BAY.maxX - x0, 3, (x0 + BAY.maxX) / 2, 1.5, 'block');
    slab(W, H - 3, ironMat, 0, 3 + (H - 3) / 2, BAY.minZ, 0);
    // The dock face below floor level, seen from the yard side through the door gaps.
    const face = slab(W, -YARD_Y, wallMat(blockT, [W / 3, 0.4], 0x7d7d7a), 0, YARD_Y / 2, BAY.minZ, Math.PI);
    face.name = 'dock-face';
    // Roof sheeting with two roof-light strips, and steel trusses.
    const roofMat = new THREE.MeshStandardMaterial({ map: roofT.map, normalMap: roofT.normalMap, roughnessMap: roofT.armMap, metalnessMap: roofT.armMap, color: 0x8b939a, metalness: 0.6, roughness: 1 });
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(Math.PI / 2), roofMat);
    roof.position.y = H;
    this.group.add(roof);
    this.skyMat = roofSkyMaterial();
    this.roofLights = ROOF_LIGHTS.map((r) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.d).rotateX(Math.PI / 2), this.skyMat);
      m.position.set(r.x, H - 0.02, r.z);
      m.name = 'roof-light';
      this.group.add(m);
      return m;
    });
    const steel = new THREE.MeshStandardMaterial({ normalMap: steelT.normalMap, roughnessMap: steelT.armMap, metalnessMap: steelT.armMap, color: 0x3d6f9a, metalness: 0.7, roughness: 1 });
    const beamGeo = new THREE.BoxGeometry(0.3, 0.7, D);
    const trusses = new THREE.InstancedMesh(beamGeo, steel, 7);
    for (let i = 0; i < 7; i++) trusses.setMatrixAt(i, matAt(BAY.minX + (i + 0.5) * (W / 7), H - 0.45, 0));
    trusses.castShadow = false;
    this.group.add(trusses);
    // Wall pilasters (steel portal frame columns, inside the walls).
    const colGeo = new THREE.BoxGeometry(0.35, H, 0.35);
    const cols = new THREE.InstancedMesh(colGeo, steel, 14);
    for (let i = 0; i < 7; i++) {
      const x = BAY.minX + (i + 0.5) * (W / 7);
      cols.setMatrixAt(i * 2, matAt(x, H / 2, BAY.minZ + 0.18));
      cols.setMatrixAt(i * 2 + 1, matAt(x, H / 2, BAY.maxZ - 0.18));
    }
    this.group.add(cols);
    this.steelMat = steel;
    // Floor paint: walkway lines, the truck route and keep-clear hatching (on the
    // concrete's own normal and roughness maps: worn paint, not flat colour).
    this._paint();
  }

  _paintMat(color, opacity = 0.92) {
    const t = this.floorT;
    const m = new THREE.MeshStandardMaterial({ color, normalMap: t.normalMap, roughnessMap: t.armMap, roughness: 0.7, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    return m;
  }

  _paint() {
    const yellow = this._paintMat(0xe0b21a);
    const white = this._paintMat(0xd8d8d0, 0.8);
    const strip = (x0, z0, x1, z1, w, mat) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const g = new THREE.PlaneGeometry(len, w).rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, mat);
      m.position.set((x0 + x1) / 2, 0.004, (z0 + z1) / 2);
      m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      m.receiveShadow = true;
      return m;
    };
    const walkway = (w, ns = false) => {
      const g = new THREE.Group();
      const lw = 0.1;
      const two = !ns
        ? [strip(w.x0, w.z0 + lw / 2, w.x1, w.z0 + lw / 2, lw, yellow), strip(w.x0, w.z1 - lw / 2, w.x1, w.z1 - lw / 2, lw, yellow)]
        : [strip(w.x0 + lw / 2, w.z0, w.x0 + lw / 2, w.z1, lw, yellow), strip(w.x1 - lw / 2, w.z0, w.x1 - lw / 2, w.z1, lw, yellow)];
      g.add(...two);
      mergeMeshes(two, 'walkway-lines');
      return g;
    };
    // Main walkway (catalog: floor-markings), with stencils and the truck route arrows.
    this.walkMain = walkway(WALKWAY_MAIN);
    this.walkMain.name = 'walkway-main';
    // A thin transparent hit plane fills the walkway so a click between the lines finds it.
    const hit = (w) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w.x1 - w.x0, w.z1 - w.z0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ visible: false })); m.position.set((w.x0 + w.x1) / 2, 0.003, (w.z0 + w.z1) / 2); return m; };
    this.walkMain.add(hit(WALKWAY_MAIN));
    this.group.add(this.walkMain);
    this.walkSouth = walkway(WALKWAY_SOUTH, true);
    this.walkSouth.name = 'walkway-south';
    this.group.add(this.walkSouth);
    this.walkStaging = walkway(WALKWAY_STAGING);
    this.walkStaging.name = 'walkway-staging';
    this.walkStaging.add(hit(WALKWAY_STAGING));
    this.group.add(this.walkStaging);
    // Truck route edge lines (white).
    const lane = new THREE.Group();
    lane.add(strip(TRUCK_LANE_N.x0, TRUCK_LANE_N.z - 1.5, TRUCK_LANE_N.x1, TRUCK_LANE_N.z - 1.5, 0.08, white));
    lane.add(strip(TRUCK_LANE_N.x0, TRUCK_LANE_N.z + 1.5, CROSS_AISLE_X - 1.5, TRUCK_LANE_N.z + 1.5, 0.08, white));
    lane.add(strip(-17.5 - 1.5, TRUCK_LANE_S.z + 1.4, CROSS_AISLE_X + 1.4, TRUCK_LANE_S.z + 1.4, 0.08, white));
    this.group.add(lane);
    mergeMeshes([...lane.children], 'truck-route-lines');
    // Aisle floor: the neutral item between the rack rows (same concrete, a cleaner patch).
    const aisleMat = new THREE.MeshStandardMaterial({ map: this.floorT.map, normalMap: this.floorT.normalMap, roughnessMap: this.floorT.armMap, color: 0xc4c1b8, roughness: 0.8, transparent: true, opacity: 0.0001, depthWrite: false });
    const aisleW = 6.0, aisleD = AISLE.z1 - AISLE.z0 - 0.16;
    this.aisleFloor = new THREE.Mesh(new THREE.PlaneGeometry(aisleW, aisleD).rotateX(-Math.PI / 2), aisleMat);
    this.aisleFloor.position.set(AISLE.x0 + 2.7 * 2.3 + aisleW / 2, 0.005, (AISLE.z0 + AISLE.z1) / 2);
    this.aisleFloor.name = 'aisle-floor';
    this.group.add(this.aisleFloor);
  }

  async _racking() {
    // Frames every 2.7 m on both rows; beams at two levels; stored loads on most beam pairs.
    const frames = [], damagedAt = { row: 'south', i: 0 };
    const beams = [];
    const loads = [], talls = [], pallets = [];
    const rows = [{ name: 'north', z: RACK.northZ, front: 1 }, { name: 'south', z: RACK.southZ, front: -1 }];
    for (const row of rows) {
      for (let i = 0; i <= RACK.bays; i++) {
        if (row.name === damagedAt.row && i === damagedAt.i) continue;
        frames.push(matAt(RACK.x0 + i * RACK.bay, 0, row.z));
      }
      for (let b = 0; b < RACK.bays; b++) {
        const cx = RACK.x0 + (b + 0.5) * RACK.bay;
        for (const y of RACK.beams) for (const s of [-1, 1]) beams.push(matAt(cx, y - 0.2, row.z + s * 0.5));
        // Loads: two pallet positions per beam pair and on the floor.
        for (const [li, y] of [[0, 0], [1, RACK.beams[0]], [2, RACK.beams[1]]].map(([a, b2]) => [a, b2])) {
          for (const k of [-0.62, 0.62]) {
            const x = cx + k;
            const skip = (row.name === 'north' && b === SPOTS.overhangBay && li === 1 && k < 0) || (row.name === 'south' && b === SPOTS.leaningBay && li === 2 && k > 0);
            if (skip) continue;
            const hash = (b * 7 + li * 3 + (k > 0 ? 1 : 0) + (row.name === 'north' ? 0 : 5)) % 9;
            if (hash === 4) continue; // an empty slot here and there
            if (li === 0 && hash % 3 === 0) talls.push(matAt(x, 0, row.z, Math.PI / 2));
            else if (hash === 7) pallets.push(matAt(x, y, row.z, Math.PI / 2));
            else loads.push(matAt(x, y, row.z, Math.PI / 2));
          }
        }
      }
    }
    // North-wall storage row.
    const nw = RACK_NORTH_WALL;
    for (let i = 0; i <= nw.bays; i++) frames.push(matAt(nw.x0 + i * RACK.bay, 0, nw.z));
    for (let b = 0; b < nw.bays; b++) {
      const cx = nw.x0 + (b + 0.5) * RACK.bay;
      for (const y of RACK.beams) for (const s of [-1, 1]) beams.push(matAt(cx, y - 0.2, nw.z + s * 0.5));
      for (const y of [0, ...RACK.beams]) for (const k of [-0.62, 0.62]) if ((b + (k > 0 ? 1 : 0) + y) % 5 !== 2) loads.push(matAt(cx + k, y, nw.z, Math.PI / 2));
    }
    // The frame model stands with its depth along z; beams run along x.
    const [frameG, beamG, loadG, tallG, palG] = await Promise.all([
      instanced('rack-frame', frames, { shadows: true }),
      instanced('rack-beam', beams, { shadows: true }),
      instanced('pallet-wrapped', loads, { shadows: false }),
      instanced('pallet-wrapped-tall', talls, { shadows: false }),
      instanced('pallet', pallets, { shadows: false }),
    ]);
    // Fit the instanced models: their origin is the model's own; ground them.
    for (const g of [frameG, beamG, loadG, tallG, palG]) this._groundInstances(g);
    this.racking = new THREE.Group();
    this.racking.name = 'racking';
    this.racking.add(frameG, beamG, loadG, tallG, palG);
    this.group.add(this.racking);
    for (const row of [...rows, { z: nw.z, x1: nw.x0 + nw.bays * RACK.bay, x0: nw.x0 }]) {
      const x0 = row.x0 ?? RACK.x0, x1 = row.x1 ?? RACK.x0 + RACK.bays * RACK.bay;
      this.colliders.push(new THREE.Box3(V3([x0 - 0.1, 0, row.z - 0.62]), V3([x1 + 0.1, RACK.frameHeight, row.z + 0.62])));
    }
  }

  /** Instanced models are placed by their model origin: shift each so its base sits at y and it is centred on x/z. */
  _groundInstances(group) {
    let bb = null;
    group.traverse((m) => { if (m.isInstancedMesh) { m.geometry.computeBoundingBox(); bb = bb ? bb.union(m.geometry.boundingBox.clone()) : m.geometry.boundingBox.clone(); } });
    if (!bb) return;
    const c = bb.getCenter(new THREE.Vector3());
    const fix = new THREE.Matrix4().makeTranslation(-c.x, -bb.min.y, -c.z);
    group.traverse((m) => {
      if (!m.isInstancedMesh) return;
      const tmp = new THREE.Matrix4();
      for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, tmp); tmp.multiply(fix); m.setMatrixAt(i, tmp); }
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere(); m.computeBoundingBox();
    });
  }

  async _lights() {
    // Instanced fixtures; four are separate models so their card can be opened.
    // All working fixtures are one instanced set; the failing one is its own model (its own material flickers).
    const plain = LIGHTS.filter((l) => !l.failing);
    this.fixtureGroup = await instanced('high-bay-light', plain.map((l) => matAt(l.x, l.y, l.z)), { shadows: false });
    this._groundInstances(this.fixtureGroup);
    this.group.add(this.fixtureGroup);
    this.cardFixtures = [];
    for (const l of LIGHTS) {
      if (!l.failing) continue;
      const f = await model('high-bay-light', { keep: ['emitter'], shadows: false });
      placeOnFloor(f, l.x, l.z, 0, l.y);
      f.userData.failing = l.failing;
      this.group.add(f);
      this.cardFixtures.push(f);
      if (l.failing) {
        f.traverse((m) => { if (m.isMesh && /diffuser|emitter/i.test(m.name + (m.material?.name || ''))) { m.material = m.material.clone(); this.failingMat = m.material; } });
      }
    }
    // Every diffuser glows.
    const glow = (m) => { if (m.isMesh && /diffuser|emitter/i.test(m.name + (m.material?.name || ''))) { m.material.emissive?.set(0xfff4e0); if (m.material.emissiveIntensity !== undefined) m.material.emissiveIntensity = Math.max(2.2, m.material.emissiveIntensity); } };
    this.fixtureGroup.traverse(glow);
    for (const f of this.cardFixtures) f.traverse(glow);
    this.cones = lightCones();
    this.group.add(this.cones);
    this.dust = dustInBeams();
    this.group.add(this.dust);
  }

  /** Register what exists after load(): the racking and the lights. */
  registerShell() {
    this.register('pallet-racking', this.racking, { frame: { view: VIEWS.aisleWest } });
    // One fixture's size for the scale check (the instanced set's box spans the whole grid).
    const one = new THREE.Box3().setFromObject(this.cardFixtures[0]).getSize(new THREE.Vector3());
    this.fixtureGroup.userData.restSize = [one.x, one.y, one.z].map((v) => +v.toFixed(3));
    const fl = LIGHTS.find((l) => l.failing);
    // Any fixture's card frames the failing one over the far aisle (the card is about it).
    this.register('high-bay-light', [this.fixtureGroup, ...this.cardFixtures], { frame: { view: { eye: [fl.x - 3.2, 5.6, fl.z + 2.6], center: [fl.x, fl.y - 0.15, fl.z], fov: 24 } } });
    this.register('roof-lights', this.roofLights, { frame: { view: look([-11.5, 1.7, 8.5], [-11.5, 10, -3]) } });
  }

  // ---------------------------------------------------------------- props (tier 1)
  loadProps() {
    this._propsPromise ||= this._props().then(() => { this.ready.props = true; this.app.shell.root.dataset.bayProps = 'ready'; });
    return this._propsPromise;
  }

  async _props() {
    this._hdri();
    const P = await Promise.allSettled([
      this._dock(), this._receiving(), this._charging(), this._rackHazards(), this._exit(),
      this._packing(), this._staging(), this._safetyWall(), this._forklift(), this._signsAndDecals(),
    ]);
    for (const p of P) if (p.status === 'rejected') console.warn('Bay 4 part not loaded:', p.reason);
  }

  _hdri() {
    const pm = new THREE.PMREMGenerator(this.engine.renderer);
    new HDRLoader().load(`${BASE}assets/empty_warehouse_01_1k-9b3d611cad.hdr`, (hdr) => {
      this.scene.environment = pm.fromEquirectangular(hdr).texture;
      this.scene.environmentIntensity = 0.34;
      hdr.dispose(); pm.dispose();
    }, undefined, () => pm.dispose());
  }

  async _dock() {
    this.dockDoors = []; this.signals = []; this.restraints = []; this.levellers = [];
    this.trailers = [];
    for (const d of DOCK_DOORS) {
      const door = await model('dock-door', { keep: ['curtain'], shadows: false });
      mountOnWall(door, 'N', d.x, 0, -0.02);
      door.userData.dock = d.n;
      const curtain = door.getObjectByName('curtain');
      if (curtain) this._rollable(curtain);
      this.group.add(door);
      this.dockDoors.push(door);
      if (!d.open && curtain) curtain.userData.setOpen(0);
      else curtain?.userData.setOpen(1);
      // Leveller flush with the floor at the door.
      const lev = await model('dock-leveller', { shadows: false });
      placeOnFloor(lev, d.x, BAY.minZ + 1.5, 0, 0);
      lev.position.y -= localTop(lev) - 0.012;
      this.group.add(lev);
      this.levellers.push(lev);
      // Signal light beside the door, facing in.
      const sig = await model('dock-signal-light', { keep: ['lamp-red', 'lamp-green'], shadows: false });
      mountOnWall(sig, 'N', d.x + 1.95, 1.7, 0.02);
      this._signal(sig, d.signal);
      this.group.add(sig);
      this.signals.push(sig);
      // Vehicle restraint low on the dock face (outside, under the leveller lip), hook up when it holds the trailer.
      const vr = await model('vehicle-restraint', { keep: ['hook'], shadows: false });
      placeOnFloor(vr, d.x - 0.85, BAY.minZ - 0.26, Math.PI, YARD_Y + 0.14);
      const hook = vr.getObjectByName('hook');
      if (hook && !d.restrained) hook.position.y -= 0.18;
      this.group.add(vr);
      this.restraints.push(vr);
      if (d.trailer) {
        const tr = await model('trailer-53ft', { shadows: false });
        // Rear of the trailer at the dock bumpers; the trailer runs north into the yard.
        placeOnFloor(tr, d.x, BAY.minZ - 0.55 - 8.09, 0, YARD_Y);
        tr.userData.dock = d.n;
        this.group.add(tr);
        this.trailers.push(tr);
      }
    }
    // Repeated dock hardware draws once per material (animated parts stay separate).
    batchPlacements(this.dockDoors); batchPlacements(this.levellers); batchPlacements(this.signals); batchPlacements(this.restraints);
    batchPlacements([this.trailers[0], this.trailers[2]]);
    this.register('dock-door', this.dockDoors, { frame: { view: look([-6, 1.8, -9.5], [-2, 1.6, -15.6]) } });
    this.register('dock-signal', this.signals, { frame: { view: look([-6.8, 1.6, -12.6], [-7.05, 1.9, -15.85]) } });
    this.register('vehicle-restraint', this.restraints, { frame: { view: look([-9.4, 1.5, -14.6], [-9.85, -0.85, -16.3]) } });
    this.register('dock-leveller', this.levellers, { frame: { view: look([-9, 2.6, -9.6], [-9, 0, -14.6]) } });
    this.register('hazard-unchocked-trailer', this.trailers[1], { frame: { view: look([-6.2, 2.0, -8.2], [-9, 1.4, -17.5]) } });
    // Wheel chocks hanging on the wall between doors 2 and 3.
    const chocks = [];
    for (const dx of [-0.2, 0.2]) {
      const c = await model('wheel-chock', { shadows: false });
      mountOnWall(c, 'N', -5.5 + dx, 0.9, 0.02);
      this.group.add(c);
      chocks.push(c);
    }
    batchPlacements(chocks);
    this.register('wheel-chock', chocks, { frame: { view: look([-5.5, 1.2, -13.6], [-5.5, 1.0, -16]) } });
  }

  /** A roller-door curtain that rolls up into its head box: setOpen(0 closed .. 1 open). */
  _rollable(curtain) {
    curtain.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(curtain);
    const parent = curtain.parent;
    const pivot = new THREE.Group();
    pivot.position.set(0, 0, 0);
    parent.add(pivot);
    // Top edge in the parent's frame.
    const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
    const top = new THREE.Vector3(0, b.max.y, 0).applyMatrix4(inv).y;
    pivot.position.y = top;
    pivot.add(curtain);
    curtain.position.y -= top;
    curtain.userData.setOpen = (k) => { pivot.scale.y = Math.max(0.06, 1 - 0.94 * k); };
  }

  _signal(sig, state) {
    const set = (name, on, color) => {
      const n = sig.getObjectByName(name);
      n?.traverse((m) => {
        if (!m.isMesh) return;
        m.material = m.material.clone();
        m.material.emissive = new THREE.Color(on ? color : 0x000000);
        m.material.emissiveIntensity = on ? 3.2 : 0;
        if (!on) m.material.color?.multiplyScalar(0.35);
      });
    };
    set('lamp-red', state === 'red', 0xff2a1a);
    set('lamp-green', state === 'green', 0x22ff66);
  }

  async _receiving() {
    // The glossy spill on the walking route (task object).
    this.spill = spillMesh(2.0, 1.5);
    this.spill.position.x = SPOTS.spill[0]; this.spill.position.z = SPOTS.spill[2];
    this.spill.rotation.y = 0;
    this.group.add(this.spill);
    this.register('hazard-spill', this.spill, { frame: { view: look([-7.4, 1.9, -7.4], [-10.2, 0.05, -10.6]) } });
    // The tall wrapped stack (controlled condition).
    const tall = await model('pallet-wrapped-tall');
    placeOnFloor(tall, SPOTS.tallStack[0], SPOTS.tallStack[2], 0);
    this.group.add(tall);
    this.register('distractor-secured-stack', tall);
    // Inbound pallets being scanned; an empty pallet; cartons.
    const rp = [];
    for (const [x, z] of SPOTS.receivingPallets) {
      const p = await model('pallet-wrapped');
      placeOnFloor(p, x, z, Math.PI / 2);
      this.group.add(p);
      rp.push(p);
    }
    batchPlacements(rp);
    this.register('shrink-wrapped-pallets', rp, { frame: { view: look([-11.2, 2.3, -9.0], [-13.6, 0.7, -12.0]) } });
    const empty = await model('pallet', { shadows: false });
    placeOnFloor(empty, -16.8, -11.0, 0.0);
    this.group.add(empty);
    this.register('pallet', empty);
    const cartons = [];
    for (const [x, z, y, ry] of [[-16.6, -11.2, 0.152, 0], [-17.05, -10.75, 0.152, 0], [-16.6, -11.0, 0.552, 0]]) {
      const c = await model('carton-600', { shadows: false });
      placeOnFloor(c, x, z, ry, y);
      this.group.add(c);
      cartons.push(c);
    }
    batchPlacements(cartons);
    this.register('labelled-cartons', cartons, { frame: { view: look([-15.4, 1.3, -9.6], [-16.75, 0.45, -11.0]) } });
    // The hose across the main walkway (task object), drawn diagonally.
    const hose = await model('hose-floor', { shadows: false });
    placeOnFloor(hose, SPOTS.hose[0], SPOTS.hose[2], -1.15, 0.0);
    hose.userData.scaleFrame = 'local';
    this.group.add(hose);
    this.register('hazard-trip-hose', hose, { frame: { view: look([-2.2, 1.9, -1.0], [-4.2, 0.05, -3.9]) } });
    // Pallet jack and drums by the north-west wall.
    const jack = await model('pallet-jack', { keep: ['handle'], shadows: false });
    placeOnFloor(jack, -19.6, -12.6, 0.35 * 0 + Math.PI / 2);
    this.group.add(jack);
    this.register('pallet-jack', jack);
    // Supervisor's desk and the wall clock above it.
    const desk = await model('metal_office_desk');
    placeOnFloor(desk, SPOTS.graceDesk[0], SPOTS.graceDesk[2], Math.PI);
    this.group.add(desk);
    this.register('supervisor-desk', desk);
    this.colliders.push(new THREE.Box3().setFromObject(desk).expandByScalar(0.05));
  }

  async _charging() {
    const charger = await model('battery-charger', { keep: ['charge-led', 'fault-led', 'display'], shadows: false });
    mountOnWall(charger, 'W', SPOTS.charger.z, 0.05, 0.02);
    this.group.add(charger);
    this.charger = charger;
    this.register('battery-charger', charger);
    const led = charger.getObjectByName('charge-led');
    led?.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.emissive = new THREE.Color(0x30ff60); this.chargeLed = m.material; } });
    const cable = await model('charger-cable-frayed', { shadows: false });
    placeOnFloor(cable, SPOTS.frayedCable[0], SPOTS.frayedCable[2], Math.PI / 2 + 0.3, 0.0);
    cable.userData.scaleFrame = 'local';
    this.group.add(cable);
    this.register('hazard-frayed-cable', cable, { frame: { view: look([-22.2, 0.75, 0.5], [-23.15, 0.03, -0.55]) } });
    // The ramped cable (controlled): the cable runs under a yellow and black cover.
    const ramp = await model('cable-ramp', { shadows: false });
    placeOnFloor(ramp, SPOTS.cableRamp[0], SPOTS.cableRamp[2], Math.PI / 2);
    this.group.add(ramp);
    this.register('distractor-ramped-cable', ramp, { frame: { view: look([-20.0, 1.3, 2.9], [-21.6, 0.02, 1.6]) } });
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.55, normalMap: this.floorT.normalMap });
    const curve = new THREE.CatmullRomCurve3([V3([-23.9, 0.03, 0.6]), V3([-22.5, 0.025, 1.4]), V3([-21.6, 0.02, 1.6]), V3([-20.4, 0.02, 1.7]), V3([-19.5, 0.02, 2.6])]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.012, 6), cableMat);
    tube.raycast = NO_RAY;
    this.group.add(tube);
    // Parked reach truck, forks down (neutral).
    const rt = await model('reach-truck', { shadows: false });
    placeOnFloor(rt, SPOTS.reachTruck[0], SPOTS.reachTruck[2], Math.PI / 2);
    this.group.add(rt);
    rt.add(contactShadow(1.2, 2.2, 0.5));
    this.register('neutral-parked-truck', rt);
    this.colliders.push(new THREE.Box3().setFromObject(rt));
    // Eyewash station on the wall (full, sealed).
    const ew = await model('eyewash-station', { shadows: false });
    mountOnWall(ew, 'W', SPOTS.eyewash.z, 1.0, 0.02);
    this.group.add(ew);
    this.register('eyewash', ew);
  }

  async _rackHazards() {
    // Overhanging pallet: north row, lowest beam, pushed about half a metre into the aisle.
    const bayX = RACK.x0 + (SPOTS.overhangBay + 0.5) * RACK.bay - 0.62;
    const over = await model('pallet-wrapped', { shadows: false });
    placeOnFloor(over, bayX, RACK.northZ + 0.44, Math.PI / 2 + 0.07, RACK.beams[0]);
    over.userData.scaleFrame = 'local';
    this.group.add(over);
    this.register('hazard-overhang', over, { frame: { view: look([bayX + 2.6, 1.8, 4.9], [bayX, 2.4, 2.2]) } });
    // Damaged upright: the first frame of the south row, where trucks turn in.
    const dmg = await model('rack-frame-damaged');
    placeOnFloor(dmg, RACK.x0, RACK.southZ, 0);
    this.group.add(dmg);
    this.register('hazard-damaged-upright', dmg, { frame: { view: look([2.3, 1.5, 4.0], [4, 1.3, 6.2]) } });
    // An upright protector on the matching north-row frame (the control the south frame lacks).
    const prot = await model('rack-upright-protector', { shadows: false });
    placeOnFloor(prot, RACK.x0 - 0.02, RACK.northZ + 0.47, 0);
    this.group.add(prot);
    this.register('upright-protector', prot);
    // Leaning, unwrapped cartons on the south row's top beam.
    const lx = RACK.x0 + (SPOTS.leaningBay + 0.5) * RACK.bay + 0.62;
    const lean = await model('carton-stack-leaning', { shadows: false });
    placeOnFloor(lean, lx, RACK.southZ, -Math.PI / 2, RACK.beams[1]);
    this.group.add(lean);
    this.register('hazard-leaning-stack', lean, { frame: { view: look([lx - 1.2, 2.2, 2.9], [lx, 4.0, 6.0]) } });
    // The aisle floor (neutral).
    this.register('neutral-empty-aisle-end', this.aisleFloor, { frame: { view: look([7.6, 2.6, 3.9], [13.6, 0.0, 4.0]) } });
    // Convex mirror on a pole at the blind corner, aimed at the roof (task object).
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2b2f33, metalness: 0.6, roughness: 1, normalMap: this.steelMat.normalMap, roughnessMap: this.steelMat.roughnessMap });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 3.0, 10), poleMat);
    pole.position.set(SPOTS.mirror[0], 1.5, SPOTS.mirror[2]);
    this.group.add(pole);
    const mirror = await model('convex-mirror', { shadows: false });
    placeOnFloor(mirror, 0, 0, 0);
    const pivot = new THREE.Group();
    pivot.position.set(SPOTS.mirror[0], 3.15, SPOTS.mirror[2]);
    mirror.position.sub(new THREE.Vector3(0, 0.305, 0));
    pivot.add(mirror);
    pivot.rotation.set(-0.72, -0.9, 0); // faces the roof, not the cross-aisle
    pivot.userData.scaleFrame = 'local';
    this.group.add(pivot);
    this.mirror = pivot;
    this.register('hazard-misaligned-mirror', pivot, { frame: { view: look([1.2, 2.1, -1.6], [3.9, 3.0, 0.55]) } });
    // Rack load signs on the end frames.
    const signs = [];
    const tex = await loadDecal('sign-rack-load');
    const signMat = this._decal(tex, 0.4, 0.3).material;
    for (const [x, z] of [[RACK.x0 - 0.09, RACK.northZ], [RACK.x0 - 0.09, RACK.southZ - 0.25], [RACK_NORTH_WALL.x0 - 0.09, RACK_NORTH_WALL.z]]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), signMat);
      s.position.set(x, 1.45, z);
      s.rotation.y = -Math.PI / 2;
      this.group.add(s);
      signs.push(s);
    }
    const signSet = mergeMeshes(signs, 'rack-load-signs');
    signSet.userData.restSize = [0.4, 0.3, 0];
    this.register('rack-load-sign', signSet, { frame: { view: look([2.4, 1.5, 1.9], [3.91, 1.45, 1.61]) } });
  }

  _decal(tex, w, h, { transparent = true } = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent, roughness: 0.6, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.receiveShadow = true;
    return m;
  }

  async _exit() {
    const door = await model('fire-exit-door', { shadows: false });
    mountOnWall(door, 'E', SPOTS.exitDoor.z, 0, -0.02);
    this.group.add(door);
    // The two pallets of cartons blocking it share the exit's card (added after the door).
    const block = [];
    for (const [x, z] of SPOTS.exitPallets) {
      const p = await model('pallet-wrapped', { shadows: false });
      placeOnFloor(p, x, z, 0.04);
      this.group.add(p);
      block.push(p);
    }
    batchPlacements(block);
    this.register('hazard-blocked-exit', [door, ...block], { frame: { view: look([17.6, 1.8, 4.0], [23.4, 1.2, 4.0]) } });
    const sign = await model('exit-sign-box', { keep: ['sign-face'], shadows: false });
    mountOnWall(sign, 'E', SPOTS.exitDoor.z, 2.45, 0.01);
    sign.traverse((m) => { if (m.isMesh && /face/.test(m.name)) { m.material = m.material.clone(); m.material.emissive = new THREE.Color(0xffffff); m.material.emissiveMap = m.material.map; m.material.emissiveIntensity = 1.4; } });
    this.group.add(sign);
    this.register('exit-sign', sign);
  }

  async _packing() {
    const bench = await model('packing-bench', { shadows: false });
    placeOnFloor(bench, SPOTS.packingBench[0], SPOTS.packingBench[2], 0);
    this.group.add(bench);
    this.colliders.push(new THREE.Box3().setFromObject(bench));
    const cut = await model('packing-cutter', { keep: ['guard-near', 'guard-far', 'blade'], shadows: false });
    const bb = new THREE.Box3().setFromObject(bench);
    placeOnFloor(cut, SPOTS.packingBench[0] + 0.45, SPOTS.packingBench[2], 0, bb.max.y);
    cut.getObjectByName('guard-near')?.removeFromParent();
    // The guarded far side is its own object (controlled condition).
    const far = cut.getObjectByName('guard-far');
    this.group.add(cut);
    this.register('hazard-missing-guard', cut, { frame: { view: look([SPOTS.packingBench[0] + 0.3, 1.75, SPOTS.packingBench[2] + 1.6], [SPOTS.packingBench[0] + 0.45, 1.05, SPOTS.packingBench[2]]) } });
    if (far) this.register('distractor-guarded-machine', far, { frame: { view: look([SPOTS.packingBench[0] + 0.6, 1.75, SPOTS.packingBench[2] - 1.6], [SPOTS.packingBench[0] + 0.45, 1.05, SPOTS.packingBench[2]]) } });
    // Roller conveyor: four 3 m sections from the bench toward the cross-aisle.
    const c = SPOTS.conveyor;
    const secs = [];
    for (let i = 0; i < c.sections; i++) secs.push(matAt(c.x0 + 1.5 + i * 3, 0, c.z));
    const conv = await instanced('conveyor-section', secs, { shadows: false });
    this._groundInstances(conv);
    conv.name = 'conveyor';
    this.group.add(conv);
    this.conveyor = conv;
    this.register('conveyor', conv, { frame: { view: look([8.4, 2.6, 13.6], [10.6, 0.8, 10.3]) } });
    this.colliders.push(new THREE.Box3(V3([c.x0, 0, c.z - 0.5]), V3([c.x0 + 12, 1.0, c.z + 0.5])));
    const es = await model('conveyor-estop', { keep: ['button'], shadows: false });
    placeOnFloor(es, SPOTS.estop[0], SPOTS.estop[2] + 0.54, Math.PI, 0.62);
    this.group.add(es);
    this.register('conveyor-estop', es);
    // Parcels riding the conveyor (motion system "conveyor").
    this.parcels = [];
    for (let i = 0; i < 6; i++) {
      const p = await model('carton-400', { shadows: false });
      this.group.add(p);
      this.parcels.push({ obj: p, s: i * 2.0 });
    }
  }

  async _staging() {
    // Loaded truck parked over the south walkway, load too tall to see over.
    const fl = await model('forklift', { shadows: false });
    placeOnFloor(fl, SPOTS.straddleTruck[0], SPOTS.straddleTruck[2], Math.PI / 2);
    const load = await model('pallet-wrapped-tall', { shadows: false });
    const fb = new THREE.Box3().setFromObject(fl);
    placeOnFloor(load, fb.max.x - 0.62, SPOTS.straddleTruck[2], Math.PI / 2, 0.12);
    const grp = new THREE.Group();
    grp.add(fl, load);
    grp.add(contactShadow(2.0, 3.8, 0.5).translateX(SPOTS.straddleTruck[0]).translateZ(SPOTS.straddleTruck[2]));
    this.group.add(grp);
    this.register('t-hazard-straddle-load', fl, { frame: { view: look([-5.2, 2.2, 7.0], [-8.4, 1.2, 10.0]) } });
    load.userData.partOf = 't-hazard-straddle-load';
    this.straddleLoad = load;
    this.colliders.push(new THREE.Box3().setFromObject(grp));
    // Striped swing gate where the walkway meets the lane (controlled).
    const gate = await model('swing-gate', { keep: ['gate-leaf'], shadows: false });
    placeOnFloor(gate, SPOTS.gate[0], SPOTS.gate[2], 0);
    this.group.add(gate);
    this.register('t-distractor-striped-gate', gate);
    // The clear walkway along the south wall (neutral).
    this.register('t-neutral-clear-line', this.walkStaging, { frame: { view: look([-12.0, 2.4, 10.4], [-16, 0.0, 14.6]) } });
    // Battery-change bay door on the west wall, a cart in front, the neglected eyewash.
    const bdoor = await model('fire-exit-door', { shadows: false });
    mountOnWall(bdoor, 'W', SPOTS.batteryDoor.z, 0, -0.02);
    const cart = await model('tool_cart', { shadows: false });
    placeOnFloor(cart, SPOTS.batteryCart[0] + 0.15, SPOTS.batteryCart[2], Math.PI / 2 + 0.1);
    const ewn = await model('eyewash-station-neglected', { shadows: false });
    mountOnWall(ewn, 'W', SPOTS.batteryDoor.z + 1.25, 1.0, 0.02);
    const block = new THREE.Group();
    block.add(bdoor, cart, ewn);
    this.group.add(block);
    this.register('t-hazard-charging-block', block, { frame: { view: look([-19.6, 1.8, 13.2], [-23.6, 1.0, 12.0]) } });
    // Staged outbound pallets.
    const sp = SPOTS.stagingPallets.map(([x, z], i) => matAt(x, 0, z, Math.PI / 2 + (i % 3) * 0.0));
    const spg = await instanced('pallet-wrapped', sp, { shadows: false });
    this._groundInstances(spg);
    this.group.add(spg);
    // Bollards at the gate and the crossings.
    const bol = [];
    for (const [x, z] of SPOTS.bollards) {
      const b = await model('bollard', { shadows: false });
      placeOnFloor(b, x, z, 0);
      this.group.add(b);
      bol.push(b);
    }
    batchPlacements(bol);
    this.register('bollard', bol, { frame: { view: look([-9.0, 1.6, 4.6], [-9.0, 0.6, 7.6]) } });
  }

  async _safetyWall() {
    const ppe = await model('ppe-station', { shadows: false });
    mountOnWall(ppe, 'S', SPOTS.ppe.x, 0.0, 0.02);
    this.group.add(ppe);
    this.register('ppe-station', ppe);
    const kit = await model('medical_box', { shadows: false });
    kit.rotation.x = Math.PI / 2;
    const kg = new THREE.Group(); kg.add(kit);
    mountOnWall(kg, 'S', SPOTS.firstAid.x, 1.3, 0.02);
    this.group.add(kg);
    this.register('first-aid-kit', kg);
    const ext = [];
    for (const e of SPOTS.extinguishers) {
      const x = await model('korean_fire_extinguisher_01', { shadows: false });
      mountOnWall(x, e.wall, e.u, 0.45, 0.04);
      this.group.add(x);
      ext.push(x);
    }
    batchPlacements(ext);
    this.register('fire-extinguisher', ext, { frame: { view: look([SPOTS.extinguishers[0].u, 1.4, 13.6], [SPOTS.extinguishers[0].u, 0.8, 15.8]) } });
    // Bay entrance (personnel door) on the south wall.
    const door = await model('fire-exit-door', { shadows: false });
    mountOnWall(door, 'S', SPOTS.entranceDoor.x, 0, -0.02);
    this.group.add(door);
    this.register('bay-entrance', door);
  }

  async _forklift() {
    const fl = await model('forklift', { keep: ['beacon', 'steering-wheel', 'lever-lift', 'lever-tilt', 'lever-aux'], anchors: ['seat'], shadows: false });
    placeOnFloor(fl, 0, 0, 0);
    const root = new THREE.Group();
    root.name = 'forklift-moving';
    root.add(fl);
    // Steering wheel and levers: their own card.
    const ctrls = new THREE.Group();
    ctrls.name = 'forklift-controls';
    fl.updateMatrixWorld(true);
    for (const n of ['steering-wheel', 'lever-lift', 'lever-tilt', 'lever-aux']) {
      const o = fl.getObjectByName(n);
      if (o) { ctrls.attach(o); }
    }
    fl.add(ctrls);
    this.group.add(root);
    this.forklift = new Forklift({ root, model: fl, bay: this });
    this.register('forklift', root, { frame: { duration: 0.6 } });
    this.register('forklift-controls', ctrls, { frame: { duration: 0.6 } });
  }

  async _signsAndDecals() {
    // One material per decal texture, so decals that repeat merge into one mesh below.
    const mats = new Map();
    const matFor = async (key, id, make) => { if (!mats.has(key)) mats.set(key, loadDecal(id).then(make)); return mats.get(key); };
    const put = async (id, w, h, x, y, z, ry, opts) => {
      const mat = await matFor(`w:${id}`, id, (t) => this._decal(t, 1, 1, opts).material);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.receiveShadow = true;
      m.position.set(x, y, z); m.rotation.y = ry;
      m.raycast = NO_RAY;
      m.userData.decal = true;
      this.group.add(m);
      return m;
    };
    const N = BAY.minZ + 0.03, S = BAY.maxZ - 0.03, E = BAY.maxX - 0.03, Wl = BAY.minX + 0.03;
    await Promise.all([
      put('sign-bay4', 2.4, 0.6, 7.0, 5.2, N, 0),
      put('sign-dock-1', 0.6, 0.6, -16, 3.5, N, 0), put('sign-dock-2', 0.6, 0.6, -9, 3.5, N, 0), put('sign-dock-3', 0.6, 0.6, -2, 3.5, N, 0),
      put('sign-battery-charging', 0.6, 0.4, Wl, 2.3, SPOTS.charger.z, Math.PI / 2),
      put('sign-eyewash', 0.3, 0.3, Wl, 1.9, SPOTS.eyewash.z, Math.PI / 2),
      put('sign-eyewash', 0.3, 0.3, Wl, 1.9, SPOTS.batteryDoor.z + 1.25, Math.PI / 2),
      put('sign-first-aid', 0.3, 0.3, SPOTS.firstAid.x, 2.0, S, Math.PI),
      put('sign-ppe', 0.6, 0.4, SPOTS.ppe.x, 2.35, S, Math.PI),
      put('sign-fire-extinguisher', 0.2, 0.3, SPOTS.extinguishers[0].u, 1.55, S, Math.PI),
      put('sign-fire-extinguisher', 0.2, 0.3, E, 1.55, SPOTS.extinguishers[1].u, -Math.PI / 2),
      put('sign-fire-door', 0.4, 0.2, E, 2.15, SPOTS.exitDoor.z - 1.0, -Math.PI / 2),
      put('sign-forklift-route', 0.6, 0.4, Wl, 2.3, -7.2, Math.PI / 2),
      put('sign-grace-desk', 0.5, 0.12, SPOTS.graceDesk[0], 0.62, SPOTS.graceDesk[2] + 0.5, 0, { transparent: false }),
      put('sign-estop', 0.12, 0.05, SPOTS.estop[0], 0.95, SPOTS.estop[2] + 0.48, 0),
    ]);
    // Floor decals (flat on the floor).
    const floor = async (id, w, h, x, z, rot = 0) => {
      const mat = await matFor(`f:${id}`, id, (t) => new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -3 }));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), mat);
      m.position.set(x, 0.006, z); m.rotation.y = rot;
      m.raycast = NO_RAY;
      m.userData.decal = true;
      m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    const fm = [];
    fm.push(await floor('floor-walkway-stencil', 1.0, 0.5, -12, -3.9, -Math.PI / 2), await floor('floor-walkway-stencil', 1.0, 0.5, -1, -3.9, -Math.PI / 2));
    for (const x of [-14, -5, -0.5]) fm.push(await floor('floor-arrow', 0.6, 1.2, x, -7.2, -Math.PI / 2));
    for (const x of [-12, -3]) fm.push(await floor('floor-arrow', 0.6, 1.2, x, -0.9, Math.PI / 2));
    for (const c of CROSSINGS) fm.push(await floor('floor-hatch-keep-clear', 1.2, 1.2, c.x, c.z));
    await floor('floor-hatch-keep-clear', 2.0, 2.0, -22.4, -1.4);
    await floor('floor-tyre-marks', 8, 2, -9, -7.2, 0.05);
    await floor('floor-tyre-marks', 8, 2, 2.6, 4.5, Math.PI / 2 + 0.03);
    await floor('floor-oil-stain-old', 1.2, 1.2, -18.4, -8.4);
    await floor('floor-oil-stain-old', 1.0, 1.0, 8.2, 3.6, 1.2);
    for (const d of DOCK_DOORS) await floor('stripe-dock-edge', 2.6, 0.25, d.x, BAY.minZ + 0.14);
    // Decals that share a texture draw as one mesh. The two walkway stencils are
    // part of the floor-markings card; the arrows and the rest are dressing.
    const stencils = mergeMeshes(fm.slice(0, 2), 'walkway-stencils');
    const byMat = new Map();
    for (const c of [...this.group.children]) if (c.isMesh && c.userData.decal && c !== stencils) { if (!byMat.has(c.material)) byMat.set(c.material, []); byMat.get(c.material).push(c); }
    for (const list of byMat.values()) if (list.length > 1) mergeMeshes(list, 'decals');
    this.register('floor-markings', [this.walkMain, stencils], { frame: { view: look([-9.5, 3.4, 1.6], [-6, 0, -3.9]) } });
  }

  // ---------------------------------------------------------------- people (tier 1b)
  loadPeople() {
    this._peoplePromise ||= this._people().then(() => { this.ready.people = true; this.app.shell.root.dataset.bayPeople = 'ready'; });
    return this._peoplePromise;
  }

  async _people() {
    const { character } = await import('./assets.js');
    const add = async (key, x, z, ry) => {
      const c = await character(key);
      c.root.position.set(x, 0, z);
      c.root.rotation.y = ry;
      c.root.userData.restSize = MANIFEST[key].sizeM;
      c.root.add(contactShadow(0.8, 0.8, 0.5));
      this.group.add(c.root);
      return c;
    };
    const rec = await add('associate-receiving', SPOTS.receivingWorker[0], SPOTS.receivingWorker[2], Math.PI * 0.9);
    this.actors.receiving = new Idler(rec, ['scan', 'scan', 'idle']);
    this.register('associate-receiving', rec.root);
    const stg = await add('associate-staging', -16, -3.9, Math.PI / 2);
    this.actors.staging = new Walker(stg, { x0: -16, x1: -0.8, z: -3.9, speed: 1.15 });
    this.register('associate-staging', stg.root);
    const grace = await add('grace-supervisor', SPOTS.grace[0], SPOTS.grace[2], -0.5);
    this.actors.grace = new Idler(grace, ['idle', 'talk', 'idle']);
    this.register('grace-supervisor', grace.root, { frame: { view: VIEWS.grace } });
    const drv = await character('forklift-driver');
    drv.root.userData.restSize = MANIFEST['forklift-driver'].sizeM;
    this.forklift?.seat(drv);
    this.actors.driver = drv;
    this.register('forklift-driver', drv.root, { frame: { duration: 0.6 } });
    // The replay's picker (shown only during the replay).
    const pk = await character('picker-replay');
    pk.root.userData.restSize = MANIFEST['picker-replay'].sizeM;
    pk.root.visible = false;
    pk.root.add(contactShadow(0.8, 0.8, 0.5));
    this.group.add(pk.root);
    this.actors.picker = pk;
    this.register('picker-replay', pk.root);
    // Remaining dressing: drums, a wet-floor sign, a ladder, tools, crates, a stool.
    const dress = [
      ['Barrel_01', -21.6, -14.6, 0], ['Barrel_01', -20.9, -14.7, 1], ['Barrel_01', -21.3, -13.95, 2],
      ['WetFloorSign_01', -18.6, -14.0, 0.6], ['hand_truck', -18.0, -14.6, 0.2], ['metal_stool_01', 8.6, -13.6, 0],
      ['worn_metal_rack', -23.3, -9.0, Math.PI / 2], ['metal_toolbox', -22.9, -6.2, 0.4], ['wooden_crate_01', 20.6, 14.6, 0.1],
      ['plastic_crate_03', 19.6, 14.9, 0], ['plastic_crate_03', 19.62, 14.9, 0, 0.266],
    ];
    await Promise.all(dress.map(async ([k, x, z, ry, y = 0]) => {
      const m = await model(k, { shadows: false });
      placeOnFloor(m, x, z, ry, y);
      m.traverse((o) => { o.raycast = NO_RAY; });
      this.group.add(m);
    }));
    const ladder = await model('ladder_sectioned_01', { shadows: false });
    mountOnWall(ladder, 'W', -10.6, 0, 0.12);
    ladder.rotation.z = 0; this.group.add(ladder);
    const clock = await model('wall_clock', { keep: ['wall_clock_second_hand', 'wall_clock_minute_hand', 'wall_clock_hours_hand'], shadows: false });
    mountOnWall(clock, 'N', SPOTS.graceDesk[0], 2.5, 0.02);
    this.group.add(clock);
    this.clock = clock;
    for (const [k, wall, u, y] of [['power_box_01', 'W', 0.6, 1.0], ['utility_box_01', 'W', -5.2, 0], ['security_light', 'N', 7.0, 6.4]]) {
      const m = await model(k, { shadows: false });
      mountOnWall(m, wall, u, y, 0.02);
      m.traverse((o) => { o.raycast = NO_RAY; });
      this.group.add(m);
    }
  }

  /**
   * The replay's reach truck and the loose cartons on the overhanging pallet
   * (Module 3). Hidden until the replay opens; replay.js poses them.
   */
  ensureReplayActors() {
    this._replayPromise ||= (async () => {
      const m = await model('reach-truck', { keep: ['mast', 'carriage', 'forks', 'beacon'], shadows: false });
      placeOnFloor(m, 0, 0, 0);
      const tr = new THREE.Group();
      tr.name = 'replay-truck';
      tr.add(m, contactShadow(1.2, 2.2, 0.5));
      tr.userData.scaleFrame = 'local';
      tr.visible = false;
      this.group.add(tr);
      this.replayTruck = tr;
      this.register('replay-truck', tr, { frame: { duration: 0.6 } });
      // Three loose cartons on top of the overhanging pallet (north row, lowest beam).
      const bayX = RACK.x0 + (SPOTS.overhangBay + 0.5) * RACK.bay - 0.62;
      const top = RACK.beams[0] + 1.39;
      this.replayCartons = [];
      for (const [j, [dx, dz, ex, ez]] of [[-0.3, 0.55, -0.1, 1.35], [0.15, 0.6, 0.55, 1.6], [-0.05, 0.25, 0.3, 1.1]].entries()) {
        const c = await model('carton-400', { shadows: false });
        placeOnFloor(c, bayX + dx, RACK.northZ + dz, 0.2 * j, top);
        const start = { x: c.position.x, y: c.position.y, z: c.position.z, ry: c.rotation.y };
        placeOnFloor(c, bayX + ex, RACK.northZ + ez, 0.2 * j, 0);
        c.userData.start = start;
        c.userData.end = { x: c.position.x, y: c.position.y, z: c.position.z };
        c.position.set(start.x, start.y, start.z);
        c.visible = false;
        c.traverse((o) => { o.raycast = NO_RAY; });
        this.group.add(c);
        this.replayCartons.push(c);
      }
    })();
    return this._replayPromise;
  }

  // ---------------------------------------------------------------- motion
  addMotion(motion) {
    const M = motion;
    M.add({ id: 'roof-sky', layer: 'sky', label: 'illustrative', objects: ['roof-lights'], description: 'Cloud drifts across the night sky in the roof lights.', update: (dt) => { this.skyMat.uniforms.uTime.value += dt; } });
    M.add({ id: 'dust', layer: 'environment', label: 'illustrative', objects: ['high-bay-light'], holdWithCard: false, description: 'Dust drifts in the light cones under the high-bay lights.', update: (dt) => { this.dust.material.uniforms.uTime.value += dt; } });
    M.add({ id: 'failing-light', layer: 'objects', label: 'illustrative', objects: ['high-bay-light'], holdWithCard: false, description: 'One high-bay light over the far aisle flickers slowly (a failing driver).',
      update: (dt, t) => { this.flicker = failingLight(t); this.cones.material.uniforms.uFlicker.value = this.flicker; if (this.failingMat) this.failingMat.emissiveIntensity = 2.2 * this.flicker; },
      onFreeze: (f) => { if (f) { this.cones.material.uniforms.uFlicker.value = 1; if (this.failingMat) this.failingMat.emissiveIntensity = 2.2; } } });
    M.add({ id: 'forklift-route', layer: 'agents', label: 'accurate', objects: ['forklift', 'forklift-driver', 'forklift-controls'], description: 'A counterbalance forklift drives its route at walking pace and stops at the dock lane.', update: (dt) => this.forklift?.update(dt) });
    M.add({ id: 'forklift-lights', layer: 'objects', label: 'accurate', objects: ['forklift'], holdWithCard: false, description: 'The forklift\'s amber beacon flashes and its blue spot shines on the floor ahead.', update: (dt, t) => this.forklift?.lights(t) });
    M.add({ id: 'walker', layer: 'agents', label: 'accurate', objects: ['associate-staging'], description: 'A staging associate walks the yellow-lined walkway.', update: (dt) => this.actors.staging?.update(dt) });
    M.add({ id: 'scanner', layer: 'agents', label: 'accurate', objects: ['associate-receiving'], description: 'A receiving associate scans inbound cartons.', update: (dt) => this.actors.receiving?.update(dt) });
    M.add({ id: 'grace', layer: 'agents', label: 'accurate', objects: ['grace-supervisor'], description: 'Grace, the shift supervisor, works at her desk.', update: (dt) => this.actors.grace?.update(dt) });
    M.add({ id: 'driver', layer: 'agents', label: 'accurate', objects: ['forklift-driver'], description: 'The forklift driver steers and checks the route.', update: (dt) => this.actors.driver?.mixer.update(dt) });
    M.add({ id: 'conveyor', layer: 'objects', label: 'illustrative', objects: ['conveyor'], description: 'Parcels ride the roller conveyor from the packing bench.', update: (dt) => this._conveyor(dt) });
    M.add({ id: 'dock-door-3', layer: 'objects', label: 'illustrative', objects: ['dock-door'], description: 'Dock door 3 rolls down between pallet runs and up again.', update: (dt, t) => this._door3(t) });
    M.add({ id: 'clock', layer: 'objects', label: 'accurate', objects: ['supervisor-desk'], holdWithCard: false, description: 'The wall clock above the supervisor\'s desk keeps time.', update: (dt) => this._clock(dt) });
    M.add({ id: 'charger-led', layer: 'objects', label: 'accurate', objects: ['battery-charger'], holdWithCard: false, description: 'The charger\'s green charging light blinks.', update: (dt, t) => { if (this.chargeLed) this.chargeLed.emissiveIntensity = 0.6 + 2.4 * (Math.sin(t * Math.PI) > 0 ? 1 : 0.15); } });
  }

  _conveyor(dt) {
    if (!this.parcels) return;
    const c = SPOTS.conveyor, len = c.sections * 3, top = 0.96 + 0.01;
    for (const p of this.parcels) {
      p.s = (p.s + dt * 0.45) % len;
      const x = c.x0 + len - 0.4 - p.s;
      // Parcels shrink in at the bench end and out at the far end (the loop is illustrative).
      const e = Math.min(1, p.s / 0.4, (len - 0.6 - p.s) / 0.4);
      const k = Math.max(0.02, e);
      p.obj.scale.setScalar(k);
      placeOnFloorFast(p.obj, x, c.z, top);
    }
  }

  _door3(t) {
    const d = this.dockDoors?.[2];
    const cur = d?.getObjectByName('curtain');
    if (!cur?.userData.setOpen) return;
    const T = 52, u = t % T;
    // closed 18 s, opens over 7 s, open 20 s, closes over 7 s
    const k = u < 18 ? 0 : u < 25 ? (u - 18) / 7 : u < 45 ? 1 : 1 - (u - 45) / 7;
    cur.userData.setOpen(k * k * (3 - 2 * k));
  }

  _clock(dt) {
    if (!this.clock) return;
    this._clockT = (this._clockT ?? (2 * 3600 + 10 * 60)) + dt; // 02:10 on the night shift
    const s = this._clockT;
    const set = (name, a) => { const n = this.clock.getObjectByName(name); if (n) { n.userData.r0 ??= n.rotation.z; n.rotation.z = n.userData.r0 - a; } };
    set('wall_clock_second_hand', (s % 60) / 60 * Math.PI * 2);
    set('wall_clock_minute_hand', (s % 3600) / 3600 * Math.PI * 2);
    set('wall_clock_hours_hand', (s % 43200) / 43200 * Math.PI * 2);
  }

  /**
   * Level of detail: small dressing and explore objects (bounding sphere under
   * 1 m) are not drawn beyond CULL_M, where they cover a few pixels; task
   * objects, people and vehicles always are. An object whose card is open,
   * that is hovered or cued, or every object while "Show all labels" is on,
   * stays drawn. Characters drop their brows and lashes beyond 10 m.
   */
  buildLod() {
    const tasks = new Set(this.app.catalog.objects.filter((o) => o.role === 'task').map((o) => o.id));
    const keep = new Set([this.forklift?.root, this.replayTruck, ...(this.replayCartons || []), ...(this.parcels || []).map((p) => p.obj), ...Object.values(this.actors).map((a) => a?.root)].filter(Boolean));
    const sphere = new THREE.Sphere();
    this.lod = [];
    for (const c of this.group.children) {
      if (keep.has(c) || c.isLight || !c.visible) continue;
      const id = idOf(c);
      if (id && tasks.has(id)) continue;
      new THREE.Box3().setFromObject(c).getBoundingSphere(sphere);
      if (!Number.isFinite(sphere.radius) || sphere.radius >= 1.0 || sphere.radius === 0) continue;
      this.lod.push({ obj: c, id, centre: sphere.center.clone(), r: sphere.radius });
    }
    // Skinned characters: a bounding sphere from the posed mesh (plus room for
    // the animation), so off-screen people are culled like everything else.
    for (const a of [...Object.values(this.actors), this.actors.driver]) {
      a?.root?.updateMatrixWorld(true);
      a?.root?.traverse((m) => { if (m.isSkinnedMesh) { m.skeleton.update(); m.computeBoundingSphere(); m.boundingSphere.radius += 0.6; m.frustumCulled = true; } });
    }
    this.faces = [];
    for (const a of Object.values(this.actors)) a?.root?.traverse((m) => { if (m.isMesh && /eyebrow|eyelash/i.test(m.material?.name || '')) this.faces.push({ m, root: a.root }); });
  }

  _updateLod() {
    if (!this.lod) return;
    const cam = this.engine.camera.position, insp = this.app.inspect;
    const all = insp?.showAll;
    for (const l of this.lod) {
      const near = cam.distanceTo(l.centre) - l.r < CULL_M;
      l.obj.visible = near || all || Boolean(l.id && insp?._keep(l.id));
    }
    const p = new THREE.Vector3();
    for (const f of this.faces) f.m.visible = f.root.getWorldPosition(p).distanceTo(cam) < 10;
  }

  update(dt) {
    this.t += dt;
    this._updateLod();
  }
}

const CULL_M = 24;
const idOf = (o) => { let id = null; o.traverse((c) => { id ||= c.userData?.objectId || null; }); return id; };

/** Slow failing-light pattern: mostly on, short dips to 35%, never more than two a second. */
export function failingLight(t) {
  const u = t % 7.3;
  if (u > 2.0 && u < 2.35) return 0.35;
  if (u > 2.7 && u < 3.1) return 0.45;
  if (u > 5.4 && u < 5.9) return 0.4;
  return 1;
}

/**
 * Merge meshes that share one material into one mesh (one draw call), in the
 * first mesh's parent; the originals are removed. Returns the merged mesh.
 */
export function mergeMeshes(list, name) {
  const parent = list[0].parent;
  parent.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
  const geos = list.map((m) => { m.updateMatrixWorld(true); const g = m.geometry.index ? m.geometry.clone() : m.geometry.clone(); return g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); });
  const merged = new THREE.Mesh(mergeGeometries(geos, false), list[0].material);
  Object.assign(merged, { name, castShadow: list[0].castShadow, receiveShadow: list[0].receiveShadow, raycast: list[0].raycast === NO_RAY ? NO_RAY : merged.raycast, renderOrder: list[0].renderOrder });
  merged.userData = { ...list[0].userData };
  for (const m of list) m.removeFromParent();
  parent.add(merged);
  return merged;
}

function localTop(obj) { obj.updateMatrixWorld(true); return new THREE.Box3().setFromObject(obj).max.y; }
const _pb = new THREE.Box3();
/** Ground a small moving object (box computed once at scale 1). */
function placeOnFloorFast(obj, x, z, y) {
  if (!obj.userData.base) { const s = obj.scale.x; obj.scale.setScalar(1); obj.position.set(0, 0, 0); obj.updateMatrixWorld(true); _pb.setFromObject(obj); obj.userData.base = { cx: (_pb.min.x + _pb.max.x) / 2, cz: (_pb.min.z + _pb.max.z) / 2, y: _pb.min.y }; obj.scale.setScalar(s); }
  const b = obj.userData.base, k = obj.scale.x;
  obj.position.set(x - b.cx * k, y - b.y * k, z - b.cz * k);
}
