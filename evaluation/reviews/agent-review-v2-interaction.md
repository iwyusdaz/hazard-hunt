# Agent review — v2.0.0 interaction (hazard-hunt)

Agent review, 2026-10-28. Same build/method as the visual report (test-hooks build, Playwright, SwiftShader). All checks were driven live in the browser; measurements quoted from the session.

## 1. In-world actions — verified working

| Action | Result | Evidence |
|---|---|---|
| **Floor viewpoint rings clickable → camera glide** | 7 rings exist (`_buildViewpointRings`, ring + octahedron beacon + invisible pick proxy). Hover shows tooltip "Viewpoint: Charging area — Click to move here" + pointer cursor; a real mouse click glided the camera: 0.92 m travelled mid-glide, settled **0.019 m** from the charging viewpoint after the 1.15 s ease (`v2-medium-after-ring-glide.png`) | live test |
| **WASD/arrow walking** | Holding `W` moved the camera (dt-scaled 3.8 m/s; −1.13 m z in 0.5 s under SwiftShader fps). Strafing into the +x edge stopped at **x = 29.75** (clamp `[−30,30] × [−20,20]` in `src/app.js` `_update3D`); still in bounds after continued input. WASD is suppressed while a dialog is open or a form field has focus | live test |
| **Mouse-drag look** | Yaw 0.15 → −0.65 after a 200 px drag (`LookController.drag`); arrow keys and the on-screen ◀▶▲▼ look pad provide the pointer/keyboard alternatives (WCAG 2.5.1) | live test |
| **Hover rim + tooltip + cursor** | Hovering the spill showed the yellow 3D bounding-box outline, the Share Tech Mono tooltip "Receiving floor, between dock doors and the racks — Click to judge", and `cursor: pointer` (`v2-medium-hover-spill.png`). Click-through-to-HTML is structurally blocked (`src/core/input.js`: press must start on the canvas, travel < 4 px, no `dialog[open]`) | live test |
| **Floating HUD drawer collapse/expand** | Header **Hide panel / Show panel** button toggles `html[data-drawer-collapsed]`; `aria-expanded` flips true/false; `#textmode` stays in the DOM so the compact text-mode dock remains reachable via Show panel (verified open → collapsed → reopened round-trip). Collapsed state slides the drawer fully away, leaving 100% 3D | live test |
| **Keyboard equivalents** | Viewpoint buttons, POI list, look pad, replay Play/Pause/Timeline slider/Inspect-orbit/Skip/Exit are all real buttons/inputs (focus ring visible on Play in `v2-medium-replay-3d.png`); every 3D action has a same-content control in the drawer | code + live |

## 2. Text-mode parity — 3 objectives spot-checked end-to-end

1. **Rate a hazard (text)** — module 2 page: classification radio → likelihood/severity appear → Submit → feedback ("This was: Oil or fluid spill. Your band (Medium) matches the reference band (Medium)…") and the flag is recorded in the same `hunt.flags` store the 3D dialog uses (one rating, both views; `_syncSection` re-renders read-only with "Change my answer").
2. **Replay decision (text)** — storyboard pause-point fieldset ("You are the driver, one second into the aisle. What do you notice?") answered; option feedback shown; one answer per decision shared with the 3D dialog.
3. **Post-check → completion summary** — 5 choice buttons answered → "Course summary" table rendered (pre/post scores, hazard-or-not accuracy, band accuracy, "stored on this device only") + transfer reflection textarea saves.

Parity holds: text mode carries the full learning flow, and 3D ratings appear in the text page (R22 mechanism re-verified).

## 3. Gaps

- **I2-1 (major)** — Not every learning action is doable in-world (§8): **Module 4 controls ranking and the Module 5 speak-up scenario are panel-only forms**. The plan's "drag a control onto the hazard (mop the spill, fit the guard…)" and the diegetic tablet/tag interaction (`plan 09 §4.4`) are not implemented; rating happens in a centered modal, not by clipping a tag to the object. Owner decision 7 (drawer for long readings/rubrics) legitimately covers reading/rubric content, but "choose controls" is a learning action with no in-world equivalent. Acceptable to ship if the owner accepts the drawer as the equivalent; otherwise the biggest remaining v2 gap.
- **I2-2 (minor)** — `src/v2/in-world-interaction.js` (484 lines: `InWorldInteractionManager`, its own rings, WASD, speech bubbles) is **dead code** — nothing imports it. The shipped implementation lives in `src/app.js` + `src/scenes/warehouse.js`. The projected speech-bubble system (`setSpeechBubble`, owner decision 7's "in-world labels/speech bubbles") is therefore absent from the running app. Delete the module or actually wire it; `v2-speech-bubble` CSS is also unused.
- **I2-3 (minor)** — Viewpoint rings are invisible when standing on their own viewpoint (they render at the camera's feet); learners discover them only from other standpoints. The POI/viewpoint buttons cover the function, so this is polish, not a blocker.
- **I2-4 (minor)** — The rating dialog covers the cued object when open (carried from v1, still open in STATUS.md).

**Verdict:** in-world interaction for the core loop (explore → find → hover → judge → glide) works and is verifiably wired, with keyboard/AT and text-mode parity intact. The controls-ranking/speak-up in-world gap and the dead interaction module are the two items to resolve or explicitly accept before tagging.
