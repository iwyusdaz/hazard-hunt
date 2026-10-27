# Agent review: visual quality and hazard legibility per preset

Agent review. Written by a reviewer agent that did not build the course. Not a review by a real artist, safety trainer or learner.

## Method
- Build: `VITE_TEST_HOOKS=1 npm run build -- --outDir tmp/review-build`, previewed on 127.0.0.1:4194. Headless Chromium with SwiftShader (software WebGL), viewport 1280×800, DPR 1. The GPU look on real hardware may differ slightly.
- The preset was set through the Settings dialog (`#set-quality`, then "Save settings") and confirmed with `__TEST__.engine.quality.name`. No console errors on any preset.
- Screenshots: every zone view (`Go to:` buttons / `Warehouse.VIEWS`) on all four presets (`screenshots/rev-<preset>-<view>.png`). On low and medium I also took one aimed shot per inspectable: the camera at the nearest view of that item's own zone, turned toward the item, which is the best case after a learner turns the camera (`screenshots/rev-<preset>-item-<id>.png`).
- In-frame check: I projected every inspectable's world position through each view's default camera (script in the session; results are in the table below).

## Findings

| # | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| V1 | critical | **Most zone viewpoints face away from their zone.** From the default camera of the zone's own views, only 4 of 16 hazards and distractors are in frame: overhang, blocked exit, missing guard, guarded machine. None of the 6 practice-zone items is in frame from Receiving dock, Main floor or Charging area. "Receiving dock" (`yaw: Math.PI`) looks south at the *transfer* zone (striped gate, loaded truck, cage), not at the dock doors on the north wall. "Aisle, south end" looks west, away from the racking aisle. "Transfer zone" (`pos [4,1.7,-16], yaw 0`) looks at the empty north wall, while the transfer items sit at z = 11–21. | `src/scenes/warehouse.js:476-484`; `rev-low-dock.png`, `rev-medium-dock.png`, `rev-low-transfer.png`, `rev-low-aisleSouth.png` | Re-aim each view at its items (for example dock yaw 0 facing -z; transfer at z≈8 with yaw π). Add a unit test that projects each zone's items through its views and asserts each one is in frame from at least one view. |
| V2 | critical | **The assessed zone's bent upright, misaligned mirror and leaning stack are not in frame from any default view.** The mirror sits behind the Aisle-north camera, and the other two sit above or behind the frame. A learner has to discover by trial and error that the look buttons turn the camera. | projection table below; `rev-low-aisleNorth.png` | Covered by V1. Also give each view a short "look around" caption. |
| V3 | major | **The ramped-cable distractor is the same black rubber as the frayed cable**, and it sits about 0.5 m from the frayed strands. The cue text says "a yellow rubber cable ramp". The hazard/distractor pair can't be told apart visually on low or medium. | `warehouse.js:198` (`MAT.rubber`); `rev-low-item-distractor-ramped-cable.png`, `rev-medium-item-hazard-frayed-cable.png` | Give the ramp a yellow/black material and a ramp profile (a wedge, not a flat slab), and move it clear of the plug end. |
| V4 | major | **The frayed strands are illegible.** They are three 2 cm black boxes on a black cable beside a black charger, about 3 px thick from the Charging view, and blurrier on low (resolutionScale 0.75). | `warehouse.js:193-197`; `rev-low-item-hazard-frayed-cable.png` | Use a lighter split-insulation section with exposed copper-colored strands, and scale the strands to about 5 cm so they read at 4 m. |
| V5 | major | **The spill renders as a light grey or white ellipse** (specular from the lamps and the IBL), not the "dark, glossy patch" the cue describes. It reads more like a floor plate. | `warehouse.js:217-221`, `MAT.spill` roughness 0.08; `rev-low-item-hazard-spill.png`, `rev-medium-item-hazard-spill.png` | Raise the roughness to about 0.25, darken the albedo, use an irregular outline (not a circle), and check that it reads as dark from the dock view. |
| V6 | major | **The unchocked-trailer cue is about 4–6 px.** The red signal is an 11 cm disc on the far north wall, about 23 m from the dock view. There are no trailer wheels, but the hint says "Look at the wheels of the trailer". | `warehouse.js:316-322`; `zones.json:10` (hintWarm); `rev-medium-item-hazard-unchocked-trailer.png` | Move a dock viewpoint within about 8 m of door x=-7, enlarge the signal light box, and either model wheels and a chock or reword the hint to point at the signal light. |
| V7 | major | **The mirror isn't shown as misaligned.** It is a flat disc with no pole, facing horizontally (`rotation.y = π/2`), not "aimed at the ceiling structure". Nothing distinguishes a correctly aimed mirror from this one. | `warehouse.js:281-284`; `rev-low-item-hazard-misaligned-mirror.png` | Add a pole, convex geometry and a visible upward tilt (about 40° pitch), plus an aligned mirror elsewhere for comparison. |
| V8 | major | **The bent upright is rigidly tilted and repainted entirely orange.** The cue is "blue upright bent at mid-height, scuffed to bare orange metal at the impact point". It reads as a single odd-colored leaning post, so color gives it away rather than shape. | `warehouse.js:238-244` | Keep it blue, add a kink (two segments with an angle) and a small scuff decal at mid-height. |
| V9 | major | **Clicks are intercepted or missed.** Clicking the blocked exit's projected center from Aisle north opened "Clear aisle floor", because the invisible 14×3 m plane (`opacity: 0`) sits in front of the exit. Clicking the overhang's center from Packing opened "Parked reach truck": the ray passes through the thin pallet deck. Clicks on the mirror and the upright from Aisle north opened nothing in my scripted test (cause not isolated). There is no hover or selection highlight. | `warehouse.js:272-275`; `app.js:143-160` | Exclude the neutral floor plane from raycasting where it overlaps other items, or give it a lower priority. Add generous invisible hit proxies per item, a hover outline and a cursor change. |
| V10 | major | **High and Ultra look the same as Medium.** `PRESETS` defines `post: ['smaa','ao']`, `aoEnabled`, `textureMaxSize`, `drawDistance` and `propsDensity`, but only `resolutionScale` and `shadowMapSize` are used (`engine.js:47`, `warehouse.js:80-86`). | `src/core/quality.js:5-10`; compare `rev-medium-aisleNorth.png` with `rev-ultra-aisleNorth.png` | Implement SMAA/AO for High and Ultra, or collapse the presets to what actually differs and update the README. |
| V11 | minor | **Low and Medium differ only in shadows and resolution.** Legibility was the same on both in my shots, but on low the hose and truck have no contact shadows, so floor items float slightly. | `rev-low-dock.png` vs `rev-medium-dock.png` | Add a cheap baked blob shadow under floor items on Low. |
| V12 | minor | **The "Inspectable areas" header and an empty list box render over Module 1's text**, and the look pad shows on text pages where it does nothing. | `rev-menu.png` | Hide the POI panel and look pad when `_activeZones()` is empty or text mode is showing. |
| V13 | minor | **The wrapped "about three meters tall" stack is about 2 m** (2 levels), and the transparent wrap reads as a glass box. | `warehouse.js:212`, `_palletStack` | Use 3 levels and a slightly frosted, crinkled wrap texture. |
| V14 | minor | **The eyewash is the same green box as the exit signs**, and the "empty bottle" is a transparent 12 cm box that doesn't read. | `warehouse.js:355-358` | Model a recognizable eyewash station with the standard green sign and an obviously empty bottle. |
| V15 | minor | **The replay's first frame is a close-up dominated by one carton.** The mirror the story narrates is not in frame. | `rev-replay-seg1.png`; `replay.json` seg1 camera | Pull the seg1 camera back so the overhang and mirror are both visible. |

## Hazard legibility check (plan §10), Low and Medium

"In frame" means in frame from the zone's own default view. "Legible when aimed" is my judgment from the aimed shots (`rev-<preset>-item-<id>.png`). Results were the same on Low and Medium unless noted.

| Item | Kind | In frame (default view) | Legible when aimed (Low / Medium) | Distinguishable from its paired item? |
|---|---|---|---|---|
| Spill | hazard | no | partly: visible, but light, not dark (V5) | n/a |
| Unchocked trailer | hazard | no | no: signal is a few pixels (V6) | n/a |
| Hose across walkway | hazard | no | yes | yes |
| Frayed cable | hazard | no | no (V4); worse on Low | no, vs ramped cable (V3) |
| Ramped cable | distractor | no | no: black slab, no ramp read (V3) | no |
| Wrapped tall stack | distractor | no | partly (V13) | yes |
| Overhang | hazard | yes (Packing) | yes | yes |
| Bent upright | hazard | no | yes, but by color, not shape (V8) | n/a |
| Blocked exit | hazard | yes (Packing, Aisle north) | yes: sign + pallets readable | n/a |
| Misaligned mirror | hazard | no | partly: a disc is visible, but the misalignment isn't (V7) | n/a |
| Missing guard | hazard | yes (Packing) | partly: only one guard panel exists, so there is no visible "missing" side | partly, vs guarded side |
| Leaning stack | hazard | no | yes: a single tilted box | n/a |
| Guarded machine side | distractor | yes (Packing) | yes | partly (see missing guard) |
| Loaded truck across walkway | hazard | no (Transfer view) | yes | n/a |
| Blocked battery bay / eyewash | hazard | no (Transfer view) | partly: cage yes, eyewash/bottle no (V14) | n/a |
| Striped gate | distractor | no (Transfer view) | yes | yes |

Result: on Low and Medium, 7 of 16 items are clearly legible when aimed (hose, overhang, blocked exit, leaning stack, guarded side, loaded truck, striped gate). 3 are effectively illegible (trailer, frayed cable, ramped cable), and the frayed cable / ramped cable pair can't be told apart. Only 4 of 16 are in frame from any default view. The plan §10 legibility criterion ("each hazard identifiable on every preset") is not met. High and Ultra render the same as Medium (V10), so the same result applies to them.
