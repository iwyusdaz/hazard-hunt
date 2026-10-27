/**
 * Shared helpers: keyless fetch of JSON with BASE_URL, WebGL2 check (shared template).
 * Decoders are handled by the selfHostedDecoders vite plugin (dev: middleware from
 * node_modules; build: copied into dist/decoders) — no CDN loads anywhere.
 * @module core/assets
 */
import * as THREE from 'three';

const BASE = import.meta.env.BASE_URL || './';

export async function loadJSON(path) {
  const res = await fetch(`${BASE}${path.replace(/^\//, '')}`);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

export function loadTexture(path, { srgb = true } = {}) {
  const tex = new THREE.TextureLoader().load(`${BASE}${path.replace(/^\//, '')}`);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function hasWebGL2() {
  try { return Boolean(document.createElement('canvas').getContext('webgl2')); } catch { return false; }
}
