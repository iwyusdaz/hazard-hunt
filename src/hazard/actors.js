/**
 * actors.js — things that move on their own in Bay 4: the forklift on its
 * route (with its beacon, blue spot and seated driver), a worker walking the
 * walkway, and people working in place (scanning, talking).
 * Speeds are real: the forklift at 2.2 m/s (about 8 km/h), people at about
 * 1.15 m/s. Hand-keyed clips from the S4 characters (idle, walk, scan, talk, drive).
 * @module hazard/actors
 */
import * as THREE from 'three';
import { FORKLIFT_ROUTE } from './layout.js';
import { blueSpot, contactShadow } from './materials.js';

const _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _Y = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

/** Turn a bone by a world-space rotation q (applied on top of its current pose). */
export function rotateWorld(bone, q) {
  const wq = bone.getWorldQuaternion(_q1);
  const pq = bone.parent.getWorldQuaternion(_q2).invert();
  bone.quaternion.copy(pq.multiply(q.clone().multiply(wq)));
  bone.updateMatrixWorld(true);
}
/** Turn `bone` so the direction to its child `tip` points at world point `to`. */
export function aim(bone, tip, to) {
  bone.getWorldPosition(_a); tip.getWorldPosition(_b);
  const from = _b.sub(_a).normalize(), want = to.clone().sub(_a).normalize();
  rotateWorld(bone, new THREE.Quaternion().setFromUnitVectors(from, want));
}
/**
 * Analytic two-bone IK: turn A (upper) and B (lower) so C (the end joint) reaches
 * `target`, bending toward the world direction `pole`. Bone lengths come from the rig.
 */
export function twoBone(A, B, C, target, pole) {
  A.getWorldPosition(_a); B.getWorldPosition(_b); C.getWorldPosition(_c);
  const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
  const to = target.clone().sub(_a);
  const d = THREE.MathUtils.clamp(to.length(), Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999);
  const dir = to.normalize();
  const cosA = THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const n = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
  const knee = _a.clone().addScaledVector(dir, cosA * l1).addScaledVector(n, Math.sqrt(1 - cosA * cosA) * l1);
  rotateWorld(A, new THREE.Quaternion().setFromUnitVectors(_b.clone().sub(_a).normalize(), knee.clone().sub(_a).normalize()));
  B.getWorldPosition(_b); C.getWorldPosition(_c);
  const end = _a.clone().addScaledVector(dir, d);
  rotateWorld(B, new THREE.Quaternion().setFromUnitVectors(_c.clone().sub(_b).normalize(), end.sub(_b).normalize()));
}

/** Arc-length route through corner points (closed loop), with eased corners. */
export class Route {
  constructor(points) {
    this.pts = points.map(([x, z]) => new THREE.Vector2(x, z));
    this.seg = [];
    let L = 0;
    for (let i = 0; i < this.pts.length; i++) {
      const a = this.pts[i], b = this.pts[(i + 1) % this.pts.length];
      const len = a.distanceTo(b);
      this.seg.push({ a, b, s0: L, len });
      L += len;
    }
    this.length = L;
  }
  /** Position and heading at arc length s. */
  at(s) {
    s = ((s % this.length) + this.length) % this.length;
    const seg = this.seg.find((g) => s >= g.s0 && s < g.s0 + g.len) || this.seg[this.seg.length - 1];
    const u = (s - seg.s0) / seg.len;
    const p = seg.a.clone().lerp(seg.b, u);
    const dir = seg.b.clone().sub(seg.a).normalize();
    return { x: p.x, z: p.y, heading: Math.atan2(dir.x, dir.y), index: this.seg.indexOf(seg), u };
  }
  /** Arc length of corner point i. */
  sAt(i) { return this.seg[i % this.seg.length].s0; }
}

export class Forklift {
  /** @param {{ root: THREE.Group, model: THREE.Object3D, bay: object }} o */
  constructor(o) {
    this.root = o.root;
    this.model = o.model;
    this.bay = o.bay;
    this.route = new Route(FORKLIFT_ROUTE.points);
    this.s = this.route.sAt(2);
    this.v = FORKLIFT_ROUTE.speed;
    this.speed = 0;
    this.wait = 0;
    this.heading = 0;
    this.spot = blueSpot();
    this.bay.group.add(this.spot);
    this.root.add(contactShadow(1.2, 3.2, 0.55)); // inside the truck's footprint
    this.root.userData.scaleFrame = 'local'; // its heading turns; measure in its own axes
    // Beacon lens material (amber), animated in lights().
    this.beacon = [];
    this.model.getObjectByName('beacon')?.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.emissive = new THREE.Color(0xffa020); this.beacon.push(m.material); } });
    // Headlight lenses glow (their material is shared with the parked truck, which has its lights on too).
    this.model.traverse((m) => { if (m.isMesh && m.material.name === 'lamp-white') { m.material.emissive = new THREE.Color(0xfff2d0); m.material.emissiveIntensity = 1.6; } });
    // Steering wheel turns with the truck's turn rate; pedals are the driver's foot targets.
    this.wheel = this.model.getObjectByName('steering-wheel');
    this.wheelRest = this.wheel?.quaternion.clone();
    this.steer = 0;
    this.pedals = { accel: this.model.getObjectByName('pedal-accel'), brake: this.model.getObjectByName('pedal-brake') };
    this._place(0);
    this._stopDone = -1;
  }

  /**
   * Seat the driver (a character from assets.character) in the truck: a child of
   * the truck root, so he moves and turns with it. His pelvis goes on the seat's
   * hip point (anchor `seat-hip`), and poseDriver() puts his feet on the pedals
   * and his hands on the steering wheel at 9 and 3 o'clock after every clip update.
   * (G2: the old code took the centre of an empty node's box, which is (0,0,0),
   * so the driver sat on the floor 7 m from the truck.)
   */
  seat(c) {
    this.driver = c;
    c.root.position.set(0, 0, 0);
    c.root.rotation.set(0, 0, 0);
    this.root.add(c.root);
    const clip = c.clips.drive || c.clips.idle;
    if (clip) c.mixer.clipAction(clip).play();
    c.mixer.update(0);
    const bone = (n) => c.root.getObjectByName(n);
    this.rig = {
      pelvis: bone('pelvis'), spine: bone('spine_02'),
      arms: ['l', 'r'].map((s) => [bone(`upperarm_${s}`), bone(`lowerarm_${s}`), bone(`hand_${s}`), bone(`middle_01_${s}`)]),
      legs: ['l', 'r'].map((s) => [bone(`thigh_${s}`), bone(`calf_${s}`), bone(`foot_${s}`), bone(`ball_${s}`)]),
    };
    // The clip may not key every bone, so each pose starts from the clip pose of the spine.
    this.rig.spineBase = this.rig.spine?.quaternion.clone();
    const hip = this.model.getObjectByName('seat-hip');
    if (hip && this.rig.pelvis) {
      this.root.updateMatrixWorld(true);
      const want = this.root.worldToLocal(hip.getWorldPosition(new THREE.Vector3()));
      const have = this.root.worldToLocal(this.rig.pelvis.getWorldPosition(new THREE.Vector3()));
      c.root.position.add(want.sub(have));
    }
    this.poseDriver();
  }

  /** Hands on the wheel, feet on the pedals, a slight lean toward the wheel (two-bone IK on top of the clip). */
  poseDriver() {
    const r = this.rig;
    if (!r?.pelvis || !this.wheel) return;
    this.root.updateMatrixWorld(true);
    const q = this.root.getWorldQuaternion(_q0);
    const dir = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(q).normalize();
    // Lean the upper body about 7 degrees forward, toward the wheel.
    if (r.spine) {
      r.spine.quaternion.copy(r.spineBase);
      r.spine.updateMatrixWorld(true);
      rotateWorld(r.spine, new THREE.Quaternion().setFromAxisAngle(dir(1, 0, 0), 0.12));
    }
    const toRoot = (b) => this.root.worldToLocal(b.getWorldPosition(new THREE.Vector3()));
    const w = this.wheel.matrixWorld;
    for (const [up, lo, hand, knuckle] of r.arms) {
      if (!up || !lo || !hand) continue;
      const s = Math.sign(toRoot(up).x) || 1;
      const grip = new THREE.Vector3(0.15 * s, 0, 0).applyMatrix4(w);
      const shoulder = up.getWorldPosition(new THREE.Vector3());
      const wrist = grip.clone().addScaledVector(shoulder.clone().sub(grip).normalize(), 0.075);
      twoBone(up, lo, hand, wrist, dir(0.6 * s, -1, -0.3));
      if (knuckle) aim(hand, knuckle, grip);
    }
    for (const [th, ca, ft, ball] of r.legs) {
      if (!th || !ca || !ft) continue;
      const s = Math.sign(toRoot(th).x) || 1;
      const pedal = this.pedals[s > 0 ? 'brake' : 'accel'];
      if (!pedal) continue;
      const m = pedal.matrixWorld;
      const ballAt = new THREE.Vector3(0, 0.035, 0.02).applyMatrix4(m);
      const ankle = new THREE.Vector3(0, 0.095, -0.12).applyMatrix4(m);
      twoBone(th, ca, ft, ankle, dir(0.15 * s, 0.6, 1));
      if (ball) aim(ft, ball, ballAt);
    }
  }

  _place(dt) {
    const a = this.route.at(this.s);
    // Ease the heading round corners.
    let d = a.heading - this.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const turn = dt > 0 ? d * Math.min(1, dt * 4) : d;
    this.heading += turn;
    if (this.wheel && dt > 0) {
      // Small wheel movements (up to about 35 degrees) that follow the turn rate; the hands stay on the rim.
      const want = THREE.MathUtils.clamp((turn / dt) * 0.8, -0.6, 0.6);
      this.steer += (want - this.steer) * Math.min(1, dt * 3);
      this.wheel.quaternion.copy(this.wheelRest).multiply(_q1.setFromAxisAngle(_Y, this.steer));
    }
    this.root.position.set(a.x, 0, a.z);
    this.root.rotation.y = this.heading;
    // The blue spot shines on the floor 3.5 m ahead of the truck.
    const f = 3.5;
    this.spot.position.set(a.x + Math.sin(this.heading) * f, 0.02, a.z + Math.cos(this.heading) * f);
    return a;
  }

  update(dt) {
    const stopS = this.route.sAt(FORKLIFT_ROUTE.stopAt) + 1.5;
    if (this.wait > 0) { this.wait -= dt; this.speed = 0; }
    else {
      // Slow into corners and the stop; yield to the walking worker within 3.5 m ahead.
      const ahead = (k) => this.route.at(this.s + k);
      const nextCorner = this.route.seg.find((g) => g.s0 > (this.s % this.route.length)) || this.route.seg[0];
      const toCorner = ((nextCorner.s0 - (this.s % this.route.length)) + this.route.length) % this.route.length;
      let target = this.v * (toCorner < 2.5 ? 0.45 : 1);
      const w = this.bay.actors?.staging?.root?.position;
      if (w) { const p = ahead(3); if (Math.hypot(p.x - w.x, p.z - w.z) < 3.5) target = 0; }
      this.speed += (target - this.speed) * Math.min(1, dt * 2.2);
      const before = this.s % this.route.length;
      this.s += this.speed * dt;
      const after = this.s % this.route.length;
      if (before < stopS && after >= stopS) { this.wait = FORKLIFT_ROUTE.stopSeconds; }
    }
    this._place(dt);
  }

  /** Amber beacon about 1.5 flashes a second; the blue spot pulses gently. */
  lights(t) {
    const on = (t * 1.5) % 1 < 0.45;
    for (const m of this.beacon) m.emissiveIntensity = on ? 3.0 : 0.25;
    this.spot.material.opacity = 0.75 + 0.2 * Math.sin(t * 6);
  }
}

/** A worker walking back and forth along a straight walkway, pausing at each end. */
export class Walker {
  constructor(c, { x0, x1, z, speed }) {
    Object.assign(this, { c, x0, x1, z, speed });
    this.root = c.root;
    this.dir = 1;
    this.pause = 0;
    this.walk = c.mixer.clipAction(c.clips.walk);
    this.stand = c.mixer.clipAction(c.clips.scan || c.clips.idle);
    this.walk.play();
    this.root.position.set(x0, 0, z);
    this.root.rotation.y = Math.PI / 2;
  }
  /** Back to walking from wherever another system left the figure (the replay). */
  resume() {
    this.c.mixer.stopAllAction();
    this.root.position.z = this.z;
    this.root.position.x = Math.min(this.x1, Math.max(this.x0, this.root.position.x));
    this.dir = 1; this.pause = 0;
    this.root.rotation.y = Math.PI / 2;
    this.walk.reset().play();
  }
  update(dt) {
    if (this.pause > 0) {
      this.pause -= dt;
      if (this.pause <= 0) { this.stand.fadeOut(0.3); this.walk.reset().fadeIn(0.3).play(); this.dir *= -1; this.root.rotation.y = this.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    } else {
      const x = this.root.position.x + this.dir * this.speed * dt;
      this.root.position.x = x;
      if ((this.dir > 0 && x >= this.x1) || (this.dir < 0 && x <= this.x0)) {
        this.pause = 3.2;
        this.walk.fadeOut(0.3);
        this.stand.reset().fadeIn(0.3).play();
      }
    }
    this.c.mixer.update(dt);
  }
}

/** A person working in place: cycles through clips (scan, talk, idle). */
export class Idler {
  constructor(c, cycle) {
    this.c = c;
    this.root = c.root;
    this.cycle = cycle.filter((k) => c.clips[k]);
    this.i = 0;
    this.t = 0;
    this.cur = c.mixer.clipAction(c.clips[this.cycle[0]]);
    this.cur.play();
  }
  update(dt) {
    this.t += dt;
    const clip = this.c.clips[this.cycle[this.i]];
    if (this.t > Math.max(4, clip.duration * 2)) {
      this.t = 0;
      this.i = (this.i + 1) % this.cycle.length;
      const next = this.c.mixer.clipAction(this.c.clips[this.cycle[this.i]]);
      if (next !== this.cur) { this.cur.fadeOut(0.4); next.reset().fadeIn(0.4).play(); this.cur = next; }
    }
    this.c.mixer.update(dt);
  }
}
