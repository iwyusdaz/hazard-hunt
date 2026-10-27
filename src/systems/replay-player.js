/**
 * Learner-paced incident replay player (plan 5.3): keyframed vehicle/pedestrian
 * motion per segment, timeline scrubber, pause-and-decide points, frozen-moment
 * orbit, contributing-causes overlay. This is learner-paced CONTENT, not a passive
 * cinematic — the documented exception to the 90 s budget (see DECISIONS.md).
 * @module systems/replay-player
 */
import * as THREE from 'three';

export class ReplayPlayer {
  /**
   * @param {object} opts
   * @param {object} opts.data content/replay.json
   * @param {object} opts.truck the truck group from the scene
   * @param {object} opts.pedestrian the pedestrian group that walks outside the lane
   * @param {THREE.PerspectiveCamera} opts.camera
   * @param {HTMLElement} opts.ui container for controls
   * @param {Function} opts.onPausePoint (pausePoint, segment) — render decision UI
   * @param {Function} opts.onSegmentEnd (segment)
   */
  constructor({ data, truck, pedestrian, camera, ui, motion, onPausePoint, onSegmentEnd }) {
    this.motion = motion;
    this.data = data;
    this.truck = truck;
    this.pedestrian = pedestrian;
    this.camera = camera;
    this.ui = ui;
    this.onPausePoint = onPausePoint;
    this.onSegmentEnd = onSegmentEnd;
    this.segmentIndex = -1;
    this.t = 0;              // seconds within segment
    this.playing = false;
    this.pausedAtPoint = null;
    this._firedPauses = new Set();
    this._buildUI();
  }

  _buildUI() {
    this.ui.innerHTML = `
      <div class="replay-controls" role="region" aria-label="Replay controls">
        <button type="button" data-replay="play">Play</button>
        <button type="button" data-replay="pause">Pause</button>
        <label class="scrub-label">Timeline
          <input type="range" class="replay-scrub" min="0" max="1000" value="0" aria-label="Replay timeline position">
        </label>
        <span class="replay-time" aria-live="off">0.0 s</span>
        <button type="button" data-replay="orbit">Inspect this moment (orbit)</button>
      </div>
      <p class="replay-story" tabindex="0"></p>
      <div class="replay-decision"></div>
      <div class="replay-causes"></div>
    `;
    const buttons = this.ui.querySelectorAll('[data-replay]');
    buttons.forEach((b) => b.addEventListener('click', () => this._action(b.dataset.replay)));
    this.scrub = this.ui.querySelector('.replay-scrub');
    this.scrub.addEventListener('input', () => {
      if (!this.current) return;
      this.t = (this.scrub.value / 1000) * this.current.duration;
      this._firedPauses.clear();
      this._apply(0);
    });
    this.timeEl = this.ui.querySelector('.replay-time');
    this.storyEl = this.ui.querySelector('.replay-story');
    this.decisionEl = this.ui.querySelector('.replay-decision');
    this.causesEl = this.ui.querySelector('.replay-causes');
  }

  _action(a) {
    if (a === 'play') this.play();
    if (a === 'pause') { this.playing = false; }
    if (a === 'orbit') this.frozenOrbit();
  }

  loadSegment(i) {
    this.segmentIndex = i;
    this.current = this.data.segments[i];
    this.t = 0;
    this._firedPauses.clear();
    this.storyEl.textContent = this.current.story;
    this.causesEl.innerHTML = '';
    this.playing = false;
    this._orbiting = false;
    this._orbitAngle = null;
    this._apply(0);
  }

  play() {
    if (this.pausedAtPoint) return; // must decide first
    this._orbiting = false;
    this._orbitAngle = null;
    this.playing = true;
    let last = performance.now();
    const step = () => {
      if (!this.playing || !this.current) return;
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      this.t += dt;
      this._apply(dt);
      if (this.t >= this.current.duration) {
        this.playing = false;
        this.onSegmentEnd?.(this.current);
        return;
      }
      for (const [idx, p] of (this.current.pausePoints || []).entries()) {
        const at = p.at * this.current.duration;
        if (this.t >= at && !this._firedPauses.has(idx)) {
          this._firedPauses.add(idx);
          this.playing = false;
          this.pausedAtPoint = p;
          this.onPausePoint?.(p, this.current);
          return;
        }
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /**
   * Frozen-moment inspection: each press moves the camera 45° around the current
   * focus while the replay is paused. With reduced motion the move is a cut;
   * otherwise it eases over 0.6 s. Never auto-orbits.
   */
  frozenOrbit() {
    if (!this.current) return;
    this.playing = false;
    this._orbiting = true;
    const center = new THREE.Vector3(...this.current.camera.target);
    const radius = 8;
    const from = this._orbitAngle ?? Math.atan2(this.camera.position.x - center.x, this.camera.position.z - center.z);
    const to = from + Math.PI / 4;
    this._orbitAngle = to;
    const place = (a) => {
      this.camera.position.set(center.x + radius * Math.sin(a), center.y + 1.5, center.z + radius * Math.cos(a));
      this.camera.lookAt(center);
    };
    if (this.motion?.reduced) { place(to); return; }
    const start = performance.now();
    const step = () => {
      if (!this._orbiting) return;
      const k = Math.min(1, (performance.now() - start) / 600);
      place(from + (to - from) * (1 - (1 - k) ** 3));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  resolveDecision() {
    this.pausedAtPoint = null;
    this.play();
  }

  _apply() {
    if (!this.current) return;
    const k = Math.min(1, this.t / this.current.duration);
    const kf = this.current.keyframes;
    const lerp = (from, to) => [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, from[2] + (to[2] - from[2]) * k];
    this.truck.position.set(...lerp(kf.truck.from, kf.truck.to));
    this.pedestrian.position.set(...lerp(kf.pedestrian.from, kf.pedestrian.to));
    this.pedestrian.rotation.y = k < 0.5 ? Math.PI / 2 : Math.PI;
    const c = this.current.camera;
    // Reduced motion: one still framing per segment (a cut between segments), no camera glide.
    const pos = this.motion?.reduced ? c.to : lerp(c.from, c.to);
    if (!this._orbiting) {
      this.camera.position.set(pos[0], pos[1], pos[2]);
      this.camera.lookAt(...c.target);
    }
    this.scrub.value = String(Math.round(k * 1000));
    this.timeEl.textContent = `${this.t.toFixed(1)} s`;
  }

  showCauses(causeIds, allCauses) {
    const items = allCauses.filter((c) => causeIds.includes(c.id));
    this.causesEl.innerHTML = `<h4>Contributing causes at this point</h4>` + items.map((c) =>
      `<p><strong>${c.label}</strong> <span class="cause-level">(${c.level})</span> — ${c.why}</p>`).join('');
  }
}
