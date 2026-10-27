/**
 * Input: keyboard + pointer primitives (shared template). Pointer alternatives
 * (WCAG 2.5.1) are provided by the UI layer as on-screen buttons.
 * @module core/input
 */
export class Input {
  constructor(domElement) {
    this.dom = domElement;
    this.keys = new Set();
    // `onTarget`: the event happened on the canvas itself (not on HTML above it).
    // `moved`: total travel since pointerdown, so a drag is never treated as a click.
    this.pointer = { down: false, x: 0, y: 0, dx: 0, dy: 0, startX: 0, startY: 0, moved: 0, onTarget: false };
    this._onKey = []; this._onPointer = [];
    this._kd = (e) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      this.keys.add(e.code);
      for (const fn of this._onKey) fn(e.code, e, 'down');
    };
    this._ku = (e) => { this.keys.delete(e.code); for (const fn of this._onKey) fn(e.code, e, 'up'); };
    this._pd = (e) => {
      if (e.target !== this.dom) return;
      Object.assign(this.pointer, { down: true, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: 0, onTarget: true });
      for (const fn of this._onPointer) fn(this.pointer, 'down');
    };
    this._pm = (e) => {
      this.pointer.dx = e.clientX - this.pointer.x; this.pointer.dy = e.clientY - this.pointer.y;
      this.pointer.x = e.clientX; this.pointer.y = e.clientY;
      this.pointer.onTarget = e.target === this.dom;
      for (const fn of this._onPointer) fn(this.pointer, 'move');
    };
    // pointerup stays on window so a drag released over HTML still ends the drag, but
    // it only reports an 'up' for a press that STARTED on the canvas (review N1): a
    // click on an overlay button never reaches the 3D picking code.
    this._pu = (e) => {
      if (!this.pointer.down) return;
      this.pointer.down = false;
      this.pointer.moved = Math.abs(e.clientX - this.pointer.startX) + Math.abs(e.clientY - this.pointer.startY);
      this.pointer.onTarget = e.target === this.dom;
      this.pointer.x = e.clientX; this.pointer.y = e.clientY;
      this.pointer.dx = 0; this.pointer.dy = 0;
      for (const fn of this._onPointer) fn(this.pointer, 'up');
    };
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
    this.dom.addEventListener('pointerdown', this._pd);
    window.addEventListener('pointermove', this._pm);
    window.addEventListener('pointerup', this._pu);
    this.dom.style.touchAction = 'none';
  }
  onKey(fn) { this._onKey.push(fn); }
  onPointer(fn) { this._onPointer.push(fn); }
  isDown(code) { return this.keys.has(code); }
  dispose() {
    window.removeEventListener('keydown', this._kd);
    window.removeEventListener('keyup', this._ku);
    window.removeEventListener('pointermove', this._pm);
    window.removeEventListener('pointerup', this._pu);
    this.dom?.removeEventListener('pointerdown', this._pd);
  }
}

/**
 * Look-around camera for a fixed viewpoint (the learner walks a preset path
 * between zones; free look is provided with drag + on-screen buttons).
 */
export class LookController {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0; this.pitch = 0;
    this.minPitch = -0.5; this.maxPitch = 0.6;
  }
  drag(dx, dy) { this.yaw -= dx * 0.004; this.pitch = Math.min(this.maxPitch, Math.max(this.minPitch, this.pitch - dy * 0.004)); this.apply(); }
  steps({ yaw = 0, pitch = 0 } = {}) { this.yaw += yaw * 0.2; this.pitch = Math.min(this.maxPitch, Math.max(this.minPitch, this.pitch + pitch * 0.2)); this.apply(); }
  lookAtYaw(yaw) { this.yaw = yaw; this.apply(); }
  apply() {
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
