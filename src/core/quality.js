/**
 * Quality presets + warm-up auto-selection (shared template).
 * @module core/quality
 */
export const PRESETS = {
  low: { label: 'Low (phones, older laptops)', resolutionScale: 0.75, shadowMapSize: 0, drawDistance: 300, propsDensity: 0.6, post: ['tone'], textureMaxSize: 1024, aoEnabled: false },
  // v2: the living-world scene (GLB props, articulated characters, shadow-casting
  // extras) is fragment-bound at DPR 2; 0.8 scale + 1536 shadow map hold >= 55 fps
  // on the M1 while keeping the preset's visual quality (DECISIONS.md).
  medium: { label: 'Medium (default, integrated GPUs)', resolutionScale: 0.8, shadowMapSize: 1536, drawDistance: 600, propsDensity: 1.0, post: ['tone', 'smaa'], textureMaxSize: 2048, aoEnabled: false },
  high: { label: 'High (discrete GPUs, Apple Pro chips)', resolutionScale: 1.0, shadowMapSize: 2048, drawDistance: 1200, propsDensity: 1.0, post: ['tone', 'smaa', 'ao'], textureMaxSize: 4096, aoEnabled: true },
  ultra: { label: 'Ultra (strong desktops)', resolutionScale: 1.0, shadowMapSize: 4096, drawDistance: 2400, propsDensity: 1.2, post: ['tone', 'smaa', 'ao'], textureMaxSize: 4096, aoEnabled: true },
};
const ORDER = ['low', 'medium', 'high', 'ultra'];

export class QualityManager {
  constructor(renderer, forcedPreset) {
    this.renderer = renderer;
    this.auto = !forcedPreset;
    let isSoftware = false;
    try {
      const gl = renderer?.getContext?.();
      const dbg = gl?.getExtension?.('WEBGL_debug_renderer_info');
      const rName = (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl?.getParameter?.(gl.RENDERER)) || '';
      if (/swiftshader|llvmpipe|software/i.test(String(rName))) isSoftware = true;
    } catch { /* ignore */ }
    this.name = forcedPreset || (isSoftware || Math.min(window.innerWidth, window.innerHeight) < 700 ? 'low' : 'medium');
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
