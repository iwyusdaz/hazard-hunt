# Changelog — hazard-hunt

## 2.0.1 (2026-10-29) — patch

- **Regression fix:** the V2-5 HUD palette (slate drawer, POI panel, look pad, replay bar; review revision R37) had been lost when the shared v2 core was re-synced into `src/v2/hud-shell.css`. Restored and moved to the repo-owned `src/styles/case-hud.css`, so future core syncs can't overwrite it. The sync tool now refuses to overwrite a file that has repo-only lines.
- **Shared v2 core fixes:** hover tooltips are suppressed while a tool or dialog owns the pointer; the collapsed HUD drawer is `inert` and `aria-hidden`, so Tab can't reach hidden controls; the reduced-motion character gaze snaps instead of drifting; the hotspot ring and disc are one mesh.
- Posters renamed to `poster-2.0.1.*` (same image). No content, scoring or learning-flow changes.
- Tests: 31 unit and 10 browser tests (functional, a11y, sub-path) pass.

## 2.0.0 (2026-10-28) — visual and interaction revamp

Living world, full-bleed 3D and in-world navigation (plan 09 §4.4), on top of the unchanged v1 learning content, scoring and text-mode parity.

- **Full-bleed 3D + floating HUD:** the warehouse fills 100% of the viewport; the task panel is now a docked floating drawer that slides away (owner decision 7). Text mode keeps every objective and assessment decision.
- **Animated-movie stylized characters** replace the boxy hi-vis silhouettes: four workers/supervisor with hardhats, hi-vis vests, blinking, breathing, gaze tracking and clipboard/tablet props (owner decision 5).
- **Ambient life (`AmbientLifeManager`):** floating dust motes, volumetric high-bay light shafts, a patrolling utility cart on a perimeter spline with a flashing beacon that stops when you come within 4 m (the scene models the safety culture it teaches), and an animated packing conveyor with oscillating rollers. Calm mode slows and dims everything during rating and replay dialogs; reduced motion stops it.
- **8 Poly Haven CC0 models** (wet-floor signs, cardboard boxes, barrels, wooden crates, fire extinguishers, hanging lamps, tool cart, ladder) placed as grounded dressing via `ModelLibrary` — async, non-blocking, no decoders needed (owner decision 2).
- **In-world navigation (owner decision 8):** glowing floor rings mark the seven viewpoints; clicking one (or its HUD button) glides the camera there in 0.78 s with eased framing; WASD/arrow keys walk the bay; drag-look cancels the glide; reduced motion falls back to instant placement. Every in-world action keeps its points-of-interest and text-mode equivalent.
- **Case grade + typography:** cool industrial colour grade, safety-yellow/hi-vis-orange palette applied to the scene, Big Shoulders Stencil Display / Barlow / Share Tech Mono self-hosted (milestone 1).
- **Engine fixes:** dt-based cinematic timing; software-renderer (SwiftShader/llvmpipe) detection picks the Low preset; real-time shadow maps refresh only when the preset changes.
- Posters re-rendered from the revamped scene (`poster-2.0.0.webp/.jpg`, dock view); `render-poster.mjs` now removes stale-version posters. No audio, per owner decision 9.
- Tests: 31 unit tests (incl. `views.test.js` framing/picking regression and a v2 Warehouse integration test), 9 functional+a11y Playwright tests, sub-path test.

## 1.0.0 (2026-10-27)

- Five modules: why hazards hide, practice + assessed hunt, learner-paced near-miss replay, hierarchy-of-controls ranking with "Is it training?", speak-up scenario + transfer hunt.
- Procedural warehouse with CC0 PBR textures and HDRI lighting; 12 hazards, 4 distractors, 3 neutral items across three zones.
- Text flow covers every objective and assessment decision.
- Release contract: `showcase.json`, `attribution.json` generated from ATTRIBUTION.md, poster pair rendered from the real scene, CI and release workflows.
