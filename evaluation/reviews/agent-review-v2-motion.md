# Agent review — v2.0.0 motion & ambient life (hazard-hunt)

Agent review, 2026-10-28. Same test-hooks build; live sampling through `window.__TEST__.app.warehouse.life` (1-second intervals) plus code traces. SwiftShader caveat as before; all motion systems are preset-independent (they are not quality-gated).

## 1. Ambient-life systems — 6 running (§8 requires ≥ 5)

Counted in code (`src/v2/ambient-life.js`, wired in `src/scenes/warehouse.js` `_initAmbientLife`) **and** observed live (three samples 1 s apart):

| # | System | Code | Live evidence |
|---|---|---|---|
| 1 | Dust motes — 220-particle volume across 54×36 m | `addParticleVolume` | particle coords drift every sample |
| 2 | Light shafts — 5 cones under high-bay fixtures with shimmer | `addLightShafts` | opacity 0.085 → 0.078 → 0.069 |
| 3 | Patrol utility cart on a closed CatmullRom perimeter spline, wheels spin, amber beacon flashes, **proximity stop at 4.0 m** | `addSplineMover` + `stopRadius` | cart x moved −1.36 → 0.38 → 1.77 along z≈−16; beacon `emissiveIntensity` flashing. Proximity stop code-verified (`update()` scales step to 0 inside 4 m, ramps 4–6 m) |
| 4 | Packing conveyor — 17 rollers spin + parcel tote reciprocates | `addOscillator` ×18 | tote x −1.06 → −1.01 → 0.02 (±1.25 m bob at 0.18 Hz) |
| 5 | Characters — chest breathing, periodic blinking (2.6–5.7 s), gaze tracking toward the camera | `stylized-character.js` `update()`; registered via `addCharacter` | spine scale 1.0149 → 0.9927 → 0.9887 (breath); blink timer logic verified in code |
| 6 | Viewpoint floor rings pulse + beacon bob | `warehouse.update` | ring scale oscillation gated off under reduced motion |

## 2. Calm mode — works (observed + code-traced)

- **Observed (rating dialog):** before open: `calm=false, calmFactor=1.0, dustOpacity=0.42`. With `#task-dialog` open: `calm=true`, `calmFactor` lerping toward 0.30 (measured 0.66 mid-transition), dust opacity dimming to 0.341 and heading for 0.26 (`0.45 + 0.55·0.30`). On close: `calm=false`, factor recovering. Wiring: `src/app.js` `_flag` → `warehouse.setCalmMode(true)` + close listener; dialog open also blocks WASD/hover/click (`dialog[open]` guards).
- **Code-traced (replay decision):** `_replayDecision` (`src/app.js` line 734) sets `setCalmMode(true)` when a pause-point dialog opens; all exit paths (`close`, Esc-then-reopen R19, exit replay line 686/782) clear it. The 3D replay auto-pauses on frame 0 with focus on Play, so no motion runs before the learner starts it.
- Character updates scale to `max(0.25, calmFactor)` — breathing slows but never freezes, matching owner decision 1 ("slows, never stops").

## 3. Reduced motion — fully stops non-essential motion

Emulated `prefers-reduced-motion: reduce` in a fresh context:

- `life.reducedMotion = true`; media query matched.
- Patrol cart position **static** across 0.9 s; dust coords **static**; shaft opacity **static**; character spine scale **static** (breathing off); all 7 ring scales pinned at 1.0 (no pulse).
- Camera glide is replaced by **instant placement**: `_gotoView('main', { glide: true })` put the camera exactly on the viewpoint (distance 0.000) — verified `glideTo`-equivalent path in `src/app.js`.
- Wiring: `motion.onChange` → `warehouse.setReducedMotion` (`src/app.js` `_init3D`), and `AmbientLifeManager.update` early-returns for particles/movers/oscillators; `stylized-character.update` is skipped entirely. Screenshot: `v2-reduced-motion.png`.

## 4. Motion load vs learning cues

- During a focused task (rating dialog), ambient motion slows to 30 % and dims — no competition with the form. The scene backdrop additionally dims under the modal.
- Outside calm mode, shafts (opacity ≤ 0.085) and dust (0.42 alpha, 0.058 size) are subtle; neither outshines any cue in the 14 view shots. The patrol cart loops the north perimeter (z −15.5…−6.2), away from the dock/aisle cue sightlines — no observed competition.
- **M3-1 (minor)** — the conveyor tote's ±1.25 m slide at the packing station is the largest single ambient motion and sits near the missing-guard cue; at 0.18 Hz it is slow, but in a headed run it is worth re-checking that it never pulls the eye during the packing task (SwiftShader fps makes a definitive judgement impossible here).
- **M3-2 (minor)** — calm-mode convergence uses a per-frame `lerp(0.08)`; at low frame rates (SwiftShader) it took > 1.5 s to approach 0.30. On a headed 60 fps run it converges in ~0.9 s; acceptable, but a time-based lerp would be frame-rate independent.

**Verdict:** the "is it alive" requirement is met with 6 systems verified live, calm mode and reduced motion both demonstrably work, and no ambient motion was observed competing with a learning cue. No motion blockers for tagging; two minor polish items.
