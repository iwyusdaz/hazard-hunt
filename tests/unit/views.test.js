/**
 * Viewpoint coverage (agent review V1/V2/H-3): every inspectable of a zone must be in
 * frame (inside the camera frustum, 10% edge margin) from at least one of that zone's
 * own views, at 16:10 and at a narrow 4:3 window. Also checks the picking priority
 * rule (the clear-floor proxy never wins over another item on the same ray).
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { Warehouse } from '../../src/scenes/warehouse.js';

const zones = JSON.parse(readFileSync(new URL('../../content/zones.json', import.meta.url), 'utf8')).zones;
const wh = new Warehouse(new THREE.Scene(), { headless: true });

describe('zone viewpoints', () => {
  it('every content inspectable has a scene object', () => {
    for (const z of zones) for (const i of z.inspectables) expect(wh.inspectables.has(i.id), i.id).toBe(true);
  });

  for (const aspect of [16 / 10, 4 / 3]) {
    it(`every inspectable is in frame from one of its zone's views (aspect ${aspect.toFixed(2)})`, () => {
      const missing = [];
      for (const z of zones) {
        for (const item of z.inspectables) {
          const focus = wh.inspectables.get(item.id).focus;
          const hits = z.views.filter((v) => Warehouse.project(Warehouse.VIEWS[v], focus, aspect).inside);
          if (!hits.length) missing.push(`${z.id}/${item.id}`);
        }
      }
      expect(missing).toEqual([]);
    });
  }

  it('items are within 16 m of the view that frames them best', () => {
    for (const z of zones) for (const item of z.inspectables) {
      const v = wh.bestView(item.id, z.views);
      const r = Warehouse.project(Warehouse.VIEWS[v], wh.inspectables.get(item.id).focus);
      expect(r.dist, item.id).toBeLessThan(16);
    }
  });

  it('aimAt points the camera straight at the item', () => {
    const v = Warehouse.VIEWS.aisleNorth;
    const aim = wh.aimAt('hazard-misaligned-mirror', new THREE.Vector3(...v.pos));
    const r = Warehouse.project({ pos: v.pos, yaw: aim.yaw, pitch: aim.pitch }, wh.inspectables.get('hazard-misaligned-mirror').focus);
    expect(Math.abs(r.ndc.x)).toBeLessThan(0.01);
    expect(Math.abs(r.ndc.y)).toBeLessThan(0.01);
  });
});

describe('picking', () => {
  const rayFrom = (viewId, id) => {
    const pos = new THREE.Vector3(...Warehouse.VIEWS[viewId].pos);
    const dir = wh.inspectables.get(id).focus.clone().sub(pos).normalize();
    return new THREE.Raycaster(pos, dir);
  };
  it('a ray at the blocked exit picks the exit, not the clear aisle floor', () => {
    expect(wh.pick(rayFrom('aisleSouth', 'hazard-blocked-exit'))).toBe('hazard-blocked-exit');
  });
  it('a ray at the overhang picks the overhang', () => {
    expect(wh.pick(rayFrom('packing', 'hazard-overhang'))).toBe('hazard-overhang');
  });
  it('mirror and upright are pickable from the aisle views', () => {
    expect(wh.pick(rayFrom('aisleNorth', 'hazard-misaligned-mirror'))).toBe('hazard-misaligned-mirror');
    expect(wh.pick(rayFrom('aisleSouth', 'hazard-damaged-upright'))).toBe('hazard-damaged-upright');
  });
  it('the clear floor is still pickable when nothing else is on the ray', () => {
    const ray = new THREE.Raycaster(new THREE.Vector3(23, 1.7, 0.5), new THREE.Vector3(0, -1, 0));
    expect(wh.pick(ray)).toBe('neutral-empty-aisle-end');
  });
  it('inactive items are ignored', () => {
    expect(wh.pick(rayFrom('transfer', 't-distractor-striped-gate'), new Set(['hazard-spill']))).toBe(null);
  });
});
