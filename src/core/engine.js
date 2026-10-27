/**
 * Core renderer + loop for the immersive learning projects (shared template).
 * Conventions: 1 unit = 1 meter. sRGB output, ACES Filmic tone mapping by default.
 * @module core/engine
 */
import * as THREE from 'three';
import { QualityManager } from './quality.js';

export class Engine {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
    this.baseFov = this.camera.fov;

    this.quality = new QualityManager(this.renderer, opts.preset);
    this.clock = new THREE.Clock();
    this._updateFns = [];
    this._running = false;
    this._paused = false;
    this._visible = true;
    this.frames = 0;
    this.fps = 0;
    this._fpsT = 0;
    this._fpsFrames = 0;
    this._benchT = 0;
    this._benchFrames = 0;

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', () => { this._visible = !document.hidden; });
    this.resize();
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(window.devicePixelRatio * this.quality.resolutionScale);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  onUpdate(fn) { this._updateFns.push(fn); return fn; }

  start() {
    if (this._running) return;
    this._running = true;
    this.clock.start();
    const tick = () => {
      if (!this._running) return;
      requestAnimationFrame(tick);
      if (this._paused || !this._visible) return;
      const dt = Math.min(this.clock.getDelta(), 0.1);
      const t = this.clock.elapsedTime;
      for (const fn of this._updateFns) fn(dt, t);
      this.renderer.info.reset();
      this.renderer.render(this.scene, this.camera);
      this.frames++; this._fpsFrames++;
      this._fpsT += dt;
      if (this._fpsT >= 1) { this.fps = this._fpsFrames / this._fpsT; this._fpsT = 0; this._fpsFrames = 0; }
      if (t < 20 && this.quality.auto) {
        this._benchFrames++; this._benchT += dt;
        if (this._benchT >= 2) {
          this.quality.autoSelect(this._benchFrames / this._benchT);
          this._benchFrames = 0; this._benchT = 0;
          this.resize();
        }
      }
    };
    requestAnimationFrame(tick);
  }

  pause() { this._paused = true; }
  resume() { this._paused = false; this.clock.getDelta(); }
  dispose() { this._running = false; window.removeEventListener('resize', this._onResize); this.renderer.dispose(); }
}
