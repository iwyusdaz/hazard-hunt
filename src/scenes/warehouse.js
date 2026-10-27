/**
 * Warehouse scene: procedural kit with PBR materials (primitives only — no external
 * models), two hunt zones + transfer zone, hazard/distractor objects with visual
 * cues, low-detail workers (hi-vis silhouettes, no faces — documented deviation),
 * and a reach truck. 1 unit = 1 meter. Fixed viewpoints per zone with free look.
 * @module scenes/warehouse
 */
import * as THREE from 'three';

const MAT = {
  concrete: new THREE.MeshStandardMaterial({ color: 0x9a9a97, roughness: 0.92, metalness: 0.02 }),
  paintedLine: new THREE.MeshStandardMaterial({ color: 0xd9b93b, roughness: 0.7 }),
  steelBlue: new THREE.MeshStandardMaterial({ color: 0x2e5f8a, roughness: 0.55, metalness: 0.35 }),
  steelOrange: new THREE.MeshStandardMaterial({ color: 0xc25e1e, roughness: 0.6, metalness: 0.3 }),
  cardboard: new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.95 }),
  palletWood: new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 0.9 }),
  darkPlastic: new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.6 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x181a1d, roughness: 0.95 }),
  hiVis: new THREE.MeshStandardMaterial({ color: 0xc8e034, roughness: 0.8 }),
  darkTrous: new THREE.MeshStandardMaterial({ color: 0x30363d, roughness: 0.9 }),
  truckBody: new THREE.MeshStandardMaterial({ color: 0xb23a24, roughness: 0.45, metalness: 0.25 }),
  doorGrey: new THREE.MeshStandardMaterial({ color: 0x6f7780, roughness: 0.5, metalness: 0.5 }),
  exitGreen: new THREE.MeshStandardMaterial({ color: 0x1e8a4c, roughness: 0.6, emissive: 0x0d3a20 }),
  shrinkWrap: new THREE.MeshStandardMaterial({ color: 0xcfd8e0, roughness: 0.35, metalness: 0.05, transparent: true, opacity: 0.55 }),
  spill: new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.08, metalness: 0.1 }),
  wall: new THREE.MeshStandardMaterial({ color: 0xb9bcc0, roughness: 0.95 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x565b61, roughness: 0.9 }),
};

export class Warehouse {
  constructor(scene) {
    this.scene = scene;
    this.inspectables = new Map(); // id -> { mesh, label }
    this._workers = [];
    this._truck = null;
    this._build();
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

    // Dock doors (north wall) — one is the blocked-exit hazard context
    for (let i = -2; i <= 2; i++) {
      this._box(4.4, 4.6, 0.15, MAT.doorGrey, i * 7, 2.3, -21.7);
    }
    const exitSign = this._box(1.4, 0.4, 0.08, MAT.exitGreen, 14, 3.4, -21.5);
    this._add(exitSign, { inspectable: null });

    // Racking bays (receiving/packing zone: x from -30 to 12)
    for (let bay = 0; bay < 6; bay++) this._rack(-29 + bay * 7, -12);
    // Aisle racking (assessed zone: two rows forming an aisle at x>14)
    for (let bay = 0; bay < 3; bay++) this._rack(16 + bay * 6, -8);
    for (let bay = 0; bay < 3; bay++) this._rack(16 + bay * 6, 8);

    // Charging area (west): charger + cable + ramp
    const charger = this._box(1.6, 1.4, 0.5, MAT.darkPlastic, -28, 0.7, 10);
    this._add(charger, { inspectable: 'hazard-frayed-cable', label: 'Battery charger and cable (charging area)' });
    const cable = this._box(6.4, 0.06, 0.12, MAT.rubber, -24.6, 0.04, 10.9);
    cable.rotation.y = 0.06;
    this._add(cable);
    // Frayed section: three short angled strands near the plug end
    for (let i = 0; i < 3; i++) {
      const strand = this._box(0.5, 0.02, 0.02, MAT.rubber, -22.2 + i * 0.16, 0.05 + i * 0.03, 10.8 + i * 0.1);
      strand.rotation.z = 0.5;
      this._add(strand);
    }
    const ramp = this._box(1.2, 0.06, 0.5, MAT.rubber, -21.4, 0.03, 10.9);
    this._add(ramp, { inspectable: 'distractor-ramped-cable', label: 'Ramped charging cable (charging area)' });

    // Packing station (east)
    const bench = this._box(6, 0.9, 1.2, MAT.palletWood, 26, 0.45, 14);
    this._add(bench, { inspectable: 'hazard-missing-guard', label: 'Packing bench with cutting machine' });
    // Guard frame IN PLACE on the far side (distractor: looks risky, is controlled)
    const guard = this._box(0.06, 0.5, 1.2, MAT.steelOrange, 23.6, 1.2, 14);
    this._add(guard, { inspectable: 'distractor-guarded-machine', label: 'Guarded machine (packing station)' });
    // The cutting machine with a MISSING guard on the near side (hazard)
    const machine = this._box(1.8, 0.8, 1.0, MAT.darkPlastic, 25.6, 1.3, 14);
    this._add(machine);

    // Receiving dock props
    this._palletStack(-8, -18, 2, true); // wrapped/strapped tall stack — distractor
    this._add(this.scene.children[this.scene.children.length - 1], { inspectable: 'distractor-secured-stack', label: 'Wrapped tall pallet stack (receiving)' });
    this._palletStack(2, -18, 1, false);

    // Spill sheen (glossy dark patch) near the dock
    const spill = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), MAT.spill);
    spill.rotation.x = -Math.PI / 2;
    spill.position.set(-4, 0.012, -10);
    spill.scale.set(1.4, 1, 0.8);
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

    // Damaged upright in the aisle (assessed zone)
    const rackGroup = this.scene.getObjectByName(`rack-${16}-8`);
    if (rackGroup) {
      const upright = rackGroup.children.find((c) => c.name === 'upright-0');
      if (upright) {
        upright.rotation.z = 0.12;
        upright.position.y = 3.4;
        upright.material = MAT.steelOrange;
        upright.name = 'damaged-upright';
        this._add(upright, { inspectable: 'hazard-damaged-upright', label: 'Bent rack upright (aisle)' });
      }
    }

    // Pallet overhang (assessed zone): a pallet protruding past the beam at x=22, z=8
    const overhang = this._pallet(22.6, 2.05, 8);
    overhang.position.x = 23.4; // pushed past the beam edge
    overhang.rotation.y = 0.35;
    this._add(overhang, { inspectable: 'hazard-overhang', label: 'Pallet overhanging the rack beam (aisle)' });

    // Unsecured stacked boxes (assessed zone, leaning tower)
    const leaning = this._box(0.9, 0.9, 0.9, MAT.cardboard, 18.5, 2.6, 8.9);
    leaning.rotation.z = 0.22;
    this._add(leaning, { inspectable: 'hazard-leaning-stack', label: 'Leaning stack of boxes (aisle)' });

    // Workers: low-detail hi-vis silhouettes (documented deviation: MakeHuman not used)
    this._worker(-14, -6, 0.9);
    this._worker(20, 0, -2.4, true); // pedestrian outside the marked lane (replay context)
    this._worker(8, 16, 2.2);

    // Reach truck (medium detail, primitives)
    this._truck = this._buildTruck();
    this._truck.position.set(24, 0, 2);
    this._truck.rotation.y = Math.PI / 2;
    this.scene.add(this._truck);
    this._add(this._truck, { inspectable: 'neutral-truck', label: 'Parked reach truck (aisle)' });

    // Convex mirror at the aisle end (replay context: misaligned)
    const mirror = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), new THREE.MeshStandardMaterial({ color: 0x8fa8b8, roughness: 0.1, metalness: 0.9 }));
    mirror.position.set(14.6, 3.6, 0);
    mirror.rotation.y = Math.PI / 2;
    this._add(mirror, { inspectable: 'hazard-misaligned-mirror', label: 'Convex mirror at the aisle end (misaligned)' });

    // Lighting: dim ambient + 4 high-bay area lights (emissive discs) + one shadow-casting key light
    this.scene.add(new THREE.AmbientLight(0xcfd4da, 0.55));
    const hemi = new THREE.HemisphereLight(0xdfe4ea, 0x6a6a68, 0.5);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff2df, 1.5);
    key.position.set(18, 12, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -34; key.shadow.camera.right = 34;
    key.shadow.camera.top = 24; key.shadow.camera.bottom = -24;
    key.shadow.camera.far = 60;
    key.shadow.bias = -0.0004;
    this.scene.add(key);
    for (const [x, z] of [[-20, -14], [0, -14], [-20, 8], [8, 8], [24, 14]]) {
      const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), new THREE.MeshStandardMaterial({ color: 0xf5efdc, emissive: 0xfff3d6, emissiveIntensity: 1.4 }));
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(x, 8.8, z);
      this.scene.add(lamp);
    }
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

  _worker(x, z, yaw = 0, laneOffender = false) {
    const g = new THREE.Group();
    const torso = this._box(0.42, 0.62, 0.24, MAT.hiVis, 0, 1.15, 0);
    const legs = this._box(0.36, 0.85, 0.22, MAT.darkTrous, 0, 0.42, 0);
    const head = this._box(0.22, 0.24, 0.22, MAT.darkPlastic, 0, 1.6, 0); // no facial features (documented)
    g.add(torso, legs, head);
    if (laneOffender) {
      // arm pushing a trolley out into the aisle (replay context)
      const arm = this._box(0.1, 0.1, 0.5, MAT.hiVis, 0.26, 1.2, -0.3);
      g.add(arm);
    }
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    this.scene.add(g);
    this._workers.push(g);
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
    g.add(body, mast, carriage, counterweight, roofPost1, roofPost2, roofTop, seat);
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

  /** Camera viewpoints per zone. */
  static get VIEWS() {
    return {
      dock: { pos: [-6, 1.7, 2], yaw: Math.PI, label: 'Receiving dock' },
      main: { pos: [-12, 1.7, 8], yaw: Math.PI * 1.15, label: 'Main floor' },
      charging: { pos: [-24, 1.7, 14], yaw: -Math.PI * 0.8, label: 'Charging area' },
      packing: { pos: [22, 1.7, 18], yaw: -Math.PI * 0.25, label: 'Packing station' },
      aisleNorth: { pos: [17, 1.7, 0], yaw: -Math.PI / 2, label: 'Aisle, north end' },
      aisleSouth: { pos: [17, 1.7, 16], yaw: Math.PI / 2, label: 'Aisle, south end' },
      transfer: { pos: [4, 1.7, -16], yaw: 0, label: 'Transfer zone (staging lane)' },
    };
  }
}
