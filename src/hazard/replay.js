/**
 * replay.js — the near-miss replay in the 3D aisle (Module 3), learner-paced.
 * content/replay.json gives each segment's story, pause points (decisions),
 * camera and the paths of the reach truck and the picker in Bay 4 metres.
 * The replay is lesson content, not ambient motion: it plays only when the
 * learner presses Play, pauses at each decision and whenever a card opens,
 * and under reduced motion it moves in still steps (pause point, end).
 * Fictional, constructed for teaching; nobody is hurt.
 * @module hazard/replay
 */
import * as THREE from 'three';
import { look } from './layout.js';

/** Point and heading along a polyline at fraction u (by length). */
export function along(path, u) {
  const pts = path.map(([x, z]) => new THREE.Vector2(x, z));
  if (pts.length === 1) return { x: pts[0].x, z: pts[0].y, heading: null };
  const lens = pts.slice(1).map((p, i) => p.distanceTo(pts[i]));
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  let s = Math.max(0, Math.min(1, u)) * total;
  for (let i = 0; i < lens.length; i++) {
    if (s <= lens[i] || i === lens.length - 1) {
      const k = lens[i] ? Math.min(1, s / lens[i]) : 0;
      const p = pts[i].clone().lerp(pts[i + 1], k);
      const d = pts[i + 1].clone().sub(pts[i]);
      return { x: p.x, z: p.y, heading: d.lengthSq() ? Math.atan2(d.x, d.y) : null };
    }
    s -= lens[i];
  }
  return { x: pts.at(-1).x, z: pts.at(-1).y, heading: null };
}

export class Replay {
  /**
   * @param {object} o
   * @param {object} o.data      content/replay.json
   * @param {object} o.app       the scene app (rig, inspect, motionPrefs)
   * @param {object} o.bay       the Bay (actors.picker, replayTruck, replayCartons)
   * @param {(seg: object, pp: object) => void} o.onPause   a decision point is reached
   * @param {(seg: object) => void} o.onSegmentEnd
   * @param {() => void} o.onChange  time or state changed (Now card refresh)
   */
  constructor(o) {
    Object.assign(this, o);
    this.segments = o.data.segments;
    this.i = 0;
    this.t = 0;
    this.playing = false;
    this.active = false;
    this.done = new Set(); // "seg@at" decisions passed
    this.ended = new Set(); // segment ids that reached their end
  }

  get seg() { return this.segments[this.i]; }
  get duration() { return this.seg.duration; }

  /** Show the replay actors and frame segment i, paused at its start. */
  open(i = 0) {
    this.active = true;
    this.load(i);
  }

  close() {
    this.active = false;
    this.playing = false;
    const b = this.bay;
    if (b.replayTruck) b.replayTruck.visible = false;
    if (b.actors.picker) b.actors.picker.root.visible = false;
    for (const c of b.replayCartons || []) c.visible = false;
    if (b.forklift) b.forklift.root.visible = true;
  }

  load(i) {
    this.i = Math.max(0, Math.min(this.segments.length - 1, i));
    this.t = 0;
    this.playing = false;
    const b = this.bay;
    if (b.replayTruck) b.replayTruck.visible = true;
    if (b.actors.picker) b.actors.picker.root.visible = true;
    for (const c of b.replayCartons || []) c.visible = true;
    // The ambient forklift leaves the floor while the replay runs (one truck story at a time).
    if (b.forklift) b.forklift.root.visible = false;
    const cam = this.seg.camera;
    this.app.rig.flyTo(look(cam.eye, cam.target), this.app.motionPrefs.reduced ? 0 : 1.0);
    this._pose();
    this.onChange?.();
  }

  play() {
    if (!this.active) return;
    if (this.t >= this.duration) { this.load(this.i); }
    if (this._waiting()) { this.onPause?.(this.seg, this._waiting()); return; }
    this.playing = true;
    if (this.app.motionPrefs.reduced) {
      // Still steps: jump to the next pause point or the end.
      const next = (this.seg.pausePoints || []).map((p) => p.at * this.duration).find((x) => x > this.t + 1e-3);
      this.t = next ?? this.duration;
      this.playing = false;
      this._pose();
      this._check();
    }
    this.onChange?.();
  }

  pause() { this.playing = false; this.onChange?.(); }
  restart() { this.load(this.i); }
  next() { if (this.i < this.segments.length - 1) this.load(this.i + 1); }

  /** The decision waiting at the current time, if it has not been answered. */
  _waiting() {
    for (const pp of this.seg.pausePoints || []) {
      const key = `${this.seg.id}@${pp.at}`;
      if (!this.done.has(key) && Math.abs(this.t - pp.at * this.duration) < 0.05) return pp;
    }
    return null;
  }

  resolve(pp) { this.done.add(`${this.seg.id}@${pp.at}`); this.playing = true; this.onChange?.(); }

  update(dt) {
    if (!this.active || !this.playing) return;
    const t0 = this.t;
    this.t = Math.min(this.duration, this.t + dt);
    for (const pp of this.seg.pausePoints || []) {
      const at = pp.at * this.duration, key = `${this.seg.id}@${pp.at}`;
      if (!this.done.has(key) && t0 < at && this.t >= at) { this.t = at; this.playing = false; this._pose(); this.onPause?.(this.seg, pp); this.onChange?.(); return; }
    }
    this._pose();
    this._check();
  }

  _check() {
    if (this.t >= this.duration && !this.ended.has(this.seg.id)) {
      this.playing = false;
      this.ended.add(this.seg.id);
      this.onSegmentEnd?.(this.seg);
      this.onChange?.();
    } else if (this.t >= this.duration) { this.playing = false; }
  }

  /** Place the truck, the picker and the cartons for the current time. */
  _pose() {
    const u = this.t / this.duration;
    const k = this.seg.keyframes;
    const b = this.bay;
    const tr = b.replayTruck;
    if (tr && k.truck) { const p = along(k.truck, u); tr.position.set(p.x, 0, p.z); if (p.heading != null && (k.truckMoves ?? true)) tr.rotation.y = p.heading; }
    const pk = b.actors.picker;
    if (pk && k.pedestrian) {
      const p = along(k.pedestrian, u);
      pk.root.position.set(p.x, 0, p.z);
      if (p.heading != null) pk.root.rotation.y = p.heading;
      const moving = this.playing && k.pedestrian.length > 1;
      const clip = pk.clips[moving ? 'walk' : (k.pedestrianIdle || 'idle')] || pk.clips.idle;
      if (pk._clip !== clip) { pk.mixer.stopAllAction(); pk.mixer.clipAction(clip).play(); pk._clip = clip; }
      pk.mixer.update(this.playing ? 1 / 60 : 0);
    }
    // Loose cartons on the overhanging pallet slide off during segment 3.
    for (const [j, c] of (b.replayCartons || []).entries()) {
      const fall = k.cartonsFall;
      const start = c.userData.start, end = c.userData.end;
      let f = 0;
      if (fall === 'after') f = 1;
      else if (typeof fall === 'number') f = Math.max(0, Math.min(1, (u - fall) / 0.12));
      const e = f * f;
      c.position.set(start.x + (end.x - start.x) * f, start.y + (end.y - start.y) * e, start.z + (end.z - start.z) * f);
      c.rotation.set(0, start.ry + f * (0.6 + j * 0.4), f * (1.2 + j * 0.3));
    }
  }

  /** "m:ss of m:ss" for the Now card. */
  clock() {
    const f = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    return `${f(this.t)} of ${f(this.duration)}`;
  }
}
