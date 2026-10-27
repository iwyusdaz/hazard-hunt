/**
 * Reduced motion: respects prefers-reduced-motion, offers an in-game toggle (shared template).
 * @module a11y/motion
 */
const listeners = new Set();

export class MotionPrefs {
  constructor(slug) {
    this.slug = slug;
    this.media = window.matchMedia('(prefers-reduced-motion: reduce)');
    this._system = this.media.matches;
    try {
      const saved = localStorage.getItem(`${slug}:motion`);
      this.toggle = saved === null ? null : saved === 'reduced';
    } catch { this.toggle = null; }
    this.media.addEventListener?.('change', () => {
      this._system = this.media.matches;
      for (const fn of listeners) fn(this.reduced);
    });
  }
  get reduced() { return this.toggle === null ? this._system : this.toggle; }
  setToggle(reduced) {
    this.toggle = reduced;
    try { localStorage.setItem(`${this.slug}:motion`, reduced ? 'reduced' : 'full'); } catch { /* ignore */ }
    for (const fn of listeners) fn(this.reduced);
  }
  onChange(fn) { listeners.add(fn); }
  dur(seconds) { return this.reduced ? 0 : seconds; }
}
