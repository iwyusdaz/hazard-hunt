/**
 * Quality presets + warm-up auto-selection (shared template).
 * @module core/quality
 */
export const PRESETS = {
  low: { label: 'Low (phones, older laptops)', resolutionScale: 0.75, shadowMapSize: 0, drawDistance: 300, propsDensity: 0.6, post: ['tone'], textureMaxSize: 1024, aoEnabled: false },
  medium: { label: 'Medium (default, integrated GPUs)', resolutionScale: 1.0, shadowMapSize: 2048, drawDistance: 600, propsDensity: 1.0, post: ['tone', 'smaa'], textureMaxSize: 2048, aoEnabled: false },
  high: { label: 'High (discrete GPUs, Apple Pro chips)', resolutionScale: 1.0, shadowMapSize: 2048, drawDistance: 1200, propsDensity: 1.0, post: ['tone', 'smaa', 'ao'], textureMaxSize: 4096, aoEnabled: true },
  ultra: { label: 'Ultra (strong desktops)', resolutionScale: 1.0, shadowMapSize: 4096, drawDistance: 2400, propsDensity: 1.2, post: ['tone', 'smaa', 'ao'], textureMaxSize: 4096, aoEnabled: true },
};
const ORDER = ['low', 'medium', 'high', 'ultra'];

export class QualityManager {
  constructor(renderer, forcedPreset) {
    this.renderer = renderer;
    this.auto = !forcedPreset;
    this.name = forcedPreset || (Math.min(window.innerWidth, window.innerHeight) < 700 ? 'low' : 'medium');
    this.resolutionScale = this.presetDef.resolutionScale;
    this.listeners = [];
  }
  get presetDef() { return PRESETS[this.name]; }
  set(name) {
    if (!PRESETS[name]) return;
    this.name = name; this.auto = false;
    this.resolutionScale = PRESETS[name].resolutionScale;
    for (const fn of this.listeners) fn(this.presetDef, name);
    try { localStorage.setItem(this.storageKey(), name); } catch { /* private mode */ }
  }
  storageKey() { return (window.__SLUG__ || 'app') + ':quality'; }
  restore() { try { const s = localStorage.getItem(this.storageKey()); if (s && PRESETS[s]) this.set(s); } catch { /* ignore */ } }
  autoSelect(measuredFps) {
    if (!this.auto || measuredFps <= 0) return;
    const idx = ORDER.indexOf(this.name);
    if (measuredFps < 45 && idx > 0) { this.name = ORDER[idx - 1]; this.resolutionScale = PRESETS[this.name].resolutionScale; for (const fn of this.listeners) fn(this.presetDef, this.name); }
    else if (measuredFps > 70 && idx < ORDER.length - 1) { this.name = ORDER[idx + 1]; this.resolutionScale = PRESETS[this.name].resolutionScale; for (const fn of this.listeners) fn(this.presetDef, this.name); }
  }
  onChange(fn) { this.listeners.push(fn); }
}
