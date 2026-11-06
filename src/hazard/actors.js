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
    this.root.add(contactShadow(1.9, 3.8, 0.55));
    // Beacon lens material (amber), animated in lights().
    this.beacon = [];
    this.model.getObjectByName('beacon')?.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.emissive = new THREE.Color(0xffa020); this.beacon.push(m.material); } });
    // Headlight lenses glow (their material is shared with the parked truck, which has its lights on too).
    this.model.traverse((m) => { if (m.isMesh && m.material.name === 'lamp-white') { m.material.emissive = new THREE.Color(0xfff2d0); m.material.emissiveIntensity = 1.6; } });
    this._place(0);
    this._stopDone = -1;
  }

  /** Seat the driver (a character from assets.character) on the seat, driving clip. */
  seat(c) {
    this.driver = c;
    const seat = this.model.getObjectByName('seat');
    const p = new THREE.Vector3();
    if (seat) { seat.updateWorldMatrix(true, false); new THREE.Box3().setFromObject(seat).getCenter(p); this.root.worldToLocal(p); }
    c.root.position.set(p.x, Math.max(0, p.y - 0.62), p.z + 0.08);
    c.root.rotation.y = 0;
    this.root.add(c.root);
    const clip = c.clips.drive || c.clips.idle;
    if (clip) c.mixer.clipAction(clip).play();
  }

  _place(dt) {
    const a = this.route.at(this.s);
    // Ease the heading round corners.
    let d = a.heading - this.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.heading += dt > 0 ? d * Math.min(1, dt * 4) : d;
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
