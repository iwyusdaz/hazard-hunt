# Agent review — v2.0.0 visual revamp (hazard-hunt)

Agent review, 2026-10-28. Reviewer: v2 revamp review pass (plan 09 §4.4 / §8).
Method: `VITE_TEST_HOOKS=1` build, served from `tmp/review-build` on 127.0.0.1:4194, Playwright + SwiftShader at 1280×800. **Headless WebGL forces the Low renderer; Medium preset was forced via `engine.quality.set('medium')` but shadows/AO still render through SwiftShader — judge fidelity cautiously; the headed-GPU gate must confirm final look.** Screenshots: `evaluation/reviews/screenshots/v2-*.png` (7 views × Medium/Low, 16 aimed item shots, hover, dialog, replay, drawer, menu, poster source scene).

## 1. Grounded, detailed place — mostly met

- **No photo backdrops, no unlit cut-outs.** All architecture within 30 m is real geometry (`src/scenes/warehouse.js`); the Poly Haven `empty_warehouse_01` HDRI is used only for IBL (`environmentIntensity = 0.6`, `src/app.js` `_loadEnvironment`); sky is the procedural gradient dome + `FogExp2 #222C36` (`src/v2/cinematic-grade.js` `applyCaseGrade`/`createGradientSkyDome`). No flat-void horizon seen in any of the 14 view shots.
- **Poly Haven props load and are grounded.** 15 placements of 8 CC0 models (`_loadPolyHavenModels`, `src/v2/model-placer.js` normalizes height, aligns to floor, adds `v2-contact-shadow` + shadow flags via `groundProp`). Verified live in shots: barrels + wooden crates (dock view), tool cart + fire extinguisher (charging), wet-floor sign, cardboard boxes with real texture on the packing bench and conveyor (`v2-medium-view-dock.png`, `v2-medium-view-packing.png`, `v2-medium-view-charging.png`). No floating props observed; pallets/props carry contact shadows and receive real-time shadows.
- **Characters:** 4 animated-movie workers (Associate Maya/Devon, Supervisor Sam, replay pedestrian) with hardhats, hi-vis vests with reflective bands, layered eyes with catchlights, clipboard/tablet props, contact-shadow discs (`src/v2/stylized-character.js`). Read as appealing silhouettes at gameplay distance; faces are simple but nowhere near uncanny. Poses per state: `idle` on the floor workers, `walk` on the replay pedestrian (who also translates along replay keyframes, `src/systems/replay-player.js` lerp of `pedestrian.from/to` — not walking in place). The controller's `write`/`withdrawn` poses exist but are not used in this case (they are other cases' vocabulary) — not a gap for hazard-hunt.
- **Detail gaps (major/minor below):** the transfer zone and the aisleSouth wall are large, near-empty surfaces — the one place the scene still reads "built from primitives" (`v2-medium-view-transfer.png`, `v2-medium-view-aisleSouth.png`).

## 2. Case typography — applied and verified

Computed styles in the running build: body = `Barlow, system-ui`; headings/app title render in Big Shoulders Stencil Display (visible in `v2-medium-hover-spill.png` header and the rating-dialog headings, e.g. "East wall fire exit"); the hover tooltip computes to `"Share Tech Mono", ui-monospace` with dark pill + yellow border. `document.fonts` reports all 5 WOFF2 faces loaded (Barlow 400/600/700, Big Shoulders 700, Share Tech Mono 400 — all self-hosted, subset, `font-display: swap`, `src/styles/case-fonts.css`). The **Plain font** header toggle flips `data-plain-font` and swaps all three roles to system stacks, persisted to localStorage.

## 3. Cue salience — 10 of 12 hazards + 4 distractors pass; 2 weak

Per §8 each cue must be the most salient thing in its zone view on Low and Medium.

| Item | Medium | Low | Evidence |
|---|---|---|---|
| spill, unchocked-trailer (dock) | pass — spill is the darkest, most salient object; signal reads | pass | `v2-medium-view-dock.png`, `v2-medium-item-*.png` |
| trip-hose (main) | pass | pass | `v2-medium-view-main.png` |
| frayed-cable vs ramped-cable (charging) | pass — both unmistakable, frayed copper strands read | pass | `v2-medium-view-charging.png` |
| missing-guard / guarded-machine (packing) | pass at item distance; at the hero view the blade side needs the aim-at | pass | `v2-medium-item-hazard-missing-guard.png` |
| overhang, leaning-stack (aisle) | pass at item distance; small at hero distance | pass | item shots |
| damaged-upright (aisleSouth) | **weak** — kinked upright sits at the right edge of `aisleSouth`'s frame, partially under the POI panel | same | `v2-medium-view-aisleSouth.png` |
| blocked-exit (aisleSouth) | **fail** — the exit sign renders as a tiny floating green sliver with no readable door beneath; nothing salient marks the hazard | same | `v2-medium-view-aisleSouth.png` |
| misaligned-mirror (aisleNorth) | weak at hero distance (reads as a bare pole; the 40°-up tilt hides the dome) but unmistakable when aimed/outlined | same | `v2-medium-item-hazard-misaligned-mirror.png` |
| straddle-load, charging-block, striped-gate (transfer) | pass at item distance (gate + straddled load read clearly) | pass | `v2-medium-item-t-*.png` |

`tests/unit/views.test.js` only asserts frustum containment (10% margin) — it does not and cannot catch the legibility failures above.

- **Rating dialog covers the cue** when open (centered modal over the dimmed scene) — carried over from v1, still open (STATUS.md Mayer list). With full-bleed v2 there is more room to move the dialog aside.

## 4. Poster

`public/poster-2.0.0.webp/.jpg` shows the dock signature view: spill sheen foreground, dock door + red/green signal, pallet jack, wrapped stack, drums, dressed racking. Accurate to the scene; showcase.json `poster.alt` matches what is shown. Pass.

## Findings

- **V2-1 (major)** — `hazard-blocked-exit` is not legible from its own `aisleSouth` hero view: the exit sign is a 2-px floating green sliver and no door reads beneath it. Fix: frame the exit door + stacked-with-goods doorway from `aisleSouth` (move the view or the exit geometry in `src/scenes/warehouse.js`, `Warehouse.VIEWS` / exit build), and enlarge the sign housing. Cue salience §8 item unmet for this cue.
- **V2-2 (major)** — `hazard-damaged-upright` is clipped at the right edge of the `aisleSouth` frame and partially hidden under the POI panel. Fix: nudge `aisleSouth` yaw/position so the kinked upright lands in the open left two-thirds.
- **V2-3 (minor)** — `t-hazard-straddle-load`: the raised pallet reads as floating (no visible support/chains to the mast). A thin carriage/backrest would make the hazard read as "load over the walkway", not "teleporting pallet".
- **V2-4 (minor)** — Transfer zone reads barren (large empty wall + floor) relative to the dressed dock/charging/packing areas; one rack bay of Poly Haven dressing would fix the imbalance.
- **V2-5 (minor)** — HUD drawer background uses the global light `--bg` instead of the art bible's "HUD Slate Surface `rgba(18,24,31,0.90)`" (`src/v2/hud-shell.css` sets `background: var(--bg)`); the `--v2-surface` tokens from `cinematic-grade.js` go unused for it. Readability is fine (dark text on light), but the drawer doesn't look case-themed while the tooltip/dialog accents do. Same for the white POI list (v1 style).
- **V2-6 (minor)** — `hazard-misaligned-mirror` dome not discernible at hero distance (pole only). A slightly larger dome or a view-aimed highlight would help; acceptable when aimed.

**Verdict:** the revamp goals are substantially met (living, grounded, dressed scene; case typography live; 14 of 16 cues salient). Two cue-salience failures in one view block the §8 item and should be fixed before tagging.
