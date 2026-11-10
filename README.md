> **Evaluation status (v3.0.0, 2026-11-09):** Automated functional, accessibility and performance testing is complete (headed GPU audit on an Apple M1, unit and browser tests). v3 had no agent design reviews (the owner chose a lean process); earlier versions' agent reviews are in `evaluation/reviews/`. The owner reviewed the v3 scene and approved it on 2026-11-09; that is owner visual approval, not user testing. No real learners have tested this yet. No physical phone testing has been done (mobile was checked with device emulation). Known open issues at v3.0.0 are listed in [STATUS.md](STATUS.md). See `evaluation/METHODS.md`.

# Hazard Hunt + Incident Replay

A 45-minute workplace safety mini course for new warehouse staff: spot hazards in a realistic 3D distribution center, replay a near-miss with pause-and-decide moments, rank controls with the hierarchy of controls, and practice reporting a hazard to a busy supervisor.

**[Play now](https://immersive-learning-showcase.vercel.app/play/hazard-hunt/)** · **[Design documents](design/)** · Role: Sole designer

![A warehouse floor with yellow walkway lines, a forklift with its driver, pallets of boxes and tall racking under ceiling lights.](public/poster-3.0.1.webp)

The company in this course, Northwind Logistics, is **fictional**, and so are its staff and the incident. All of them were constructed for teaching purposes. **This course does not replace training required by law or by your employer.**

## v3.0.0: scene-first Bay 4
- **Navigation:** one top bar with the module steps, **Back** (the previous screen), **Back to start** (the intro) and the menu. Project pages don't link to other projects.
- **People:** five lifelike adults built with MPFB from MakeHuman CC0 bodies, skins, hair and clothes; vests, hard hats, hand props and animation clips are own work. The forklift driver sits in the truck (hip on the seat, hands on the wheel, feet on the pedals) and moves with it.
- **Scene:** own Blender models (forklift, reach truck, pallet jack, racking, pallets, cartons), decals and signs; forklift routes without audio. Every hazard cites [research/sources.md](research/sources.md).
- **Purposeful interaction:** only course objects (19 task, 15 learn) open cards; the 19 decorative objects (roof lights and other scenery) open nothing.
- **Performance (headed Chromium on an Apple M1 GPU, Medium, every module state at four viewports):** at most 10.43 ms GPU p95 (budget 12 ms), at least 59.5 fps, at most 295 draw calls and 0.86 M triangles, 5.16 MB before the first interaction.

## The problem

Hazard recognition is a visual, spatial skill. Slide-based compliance training tells people the rules, but it doesn't train them to *notice* a spill sheen, a bent rack upright or a pallet overhanging a beam in a busy space they walk through every day. Nor does it help them tell a real hazard from something that only looks risky, and that discrimination is what keeps reports credible.

## Audience and context

- New warehouse associates, team leads and temporary staff at a regional distribution center (fictional client: Northwind Logistics, 140 staff, a rise in near-misses).
- Mixed literacy levels, some non-native English speakers, so plain language at about CEFR B1, icons with labels, and no time pressure.
- A 45-minute onboarding module on a training-station desktop or a phone.
- Personas: [design/personas.md](design/personas.md). Needs analysis: [design/needs-analysis.md](design/needs-analysis.md).

## My approach

Analysis → design → build → evaluate.

1. **Analysis:** a hazard catalog with visual cues and risk ratings, and an "is it training?" check. The misaligned mirror, for example, is a maintenance-system problem more than a training one.
2. **Design:** five measurable objectives mapped to activity, feedback and assessment ([alignment matrix](design/alignment-matrix.md)), a realism matrix, a shot list and a text-mode design for parity.
3. **Build:** three.js — a procedural warehouse kit with CC0 PBR materials and image-based lighting, upgraded in v2.0.0 to a full-bleed, living scene (and in v3.0.0 to own Blender models and lifelike MPFB workers): ambient life (dust, light shafts, a patrolling utility cart, a moving conveyor) with a Calm Mode during tasks, Poly Haven CC0 dressing models, camera glide between viewpoints and WASD walking — plus content in JSON so a designer can edit it without touching code.
4. **Evaluate:** unit tests on the rating, ranking and dialogue logic, scripted playthroughs, axe accessibility scans, a sub-path deployment test and agent-based reviews. See [Evidence and evaluation](#evidence-and-evaluation).

## The five modules

| Module | What the learner does | Assessment |
|---|---|---|
| 1. Why hazards hide | Normalization of risk; what the course covers | Pre-check (5 items) |
| 2. Practice hunt | Find and rate hazards in the receiving, main floor and charging areas, with hints. Some items only *look* risky. | Formative: likelihood × severity rating per item, with "why" feedback |
| 3. Incident replay | A learner-paced near-miss in four segments, with pause-and-decide points and a contributing-causes chart (condition / behavior / system) | Decision items at each pause |
| 4. Fix it | Rank candidate controls for three hazards using the hierarchy of controls, then an "Is it training?" reflection | Ranking scored against the hierarchy |
| 5. Speak up + transfer | Report a blocked fire exit to a busy supervisor (branching scenario), then a new zone with no hints | Branch outcome, transfer hunt, written reflection (not graded), post-check and a summary with pre/post scores |

The 3D hunt spans 12 hazards and 4 "safe but looks risky" distractors across a practice zone, an assessed zone (aisle and packing station) and a transfer zone.

## Key design decisions

| Decision | Alternatives | Rationale |
|---|---|---|
| A near-miss, no injury shown, with a content note first | Dramatic accident | Avoids shock and distress and keeps attention on causes |
| Distractors ("looks risky, is controlled") | Hazards only | Trains discrimination and cuts over-reporting |
| Learner-paced replay with pause points and a scrubber | Passive video | The causal chain is the content, so learners need to stop and inspect it |
| Hierarchy of controls plus "is it training?" | Behavior-only fixes | Mirrors real safety practice and shows performance-consulting judgment |
| Workers as lifelike adults (v3, MPFB from MakeHuman CC0 assets, own clips) | Stylized figures (v2), faceless silhouettes (v1) | Owner decision 7 for v3; position and posture carry the learning cue (DECISIONS.md 19 and 25) |
| Every decision lives in the shared text flow; 3D adds the visual hunt and replay on top | Separate 3D and text versions | Text mode has the same objectives and assessment decisions by construction |

All decisions, with dates: [DECISIONS.md](DECISIONS.md).

## Realism and cinematics: design rationale

Realism is used where noticing the detail *is* the skill: spill sheen against a matte floor, a bent upright, an overhanging pallet, a missing guard. Everything else is simplified. Workers are lifelike adults (since v3.0.0). Since v2.0.0 the bay lives between decisions — dust in the light, light shafts, a patrolling utility cart, a moving conveyor — and during a rating or replay decision everything calms down (slower and dimmer) so the evidence stays the most salient thing on screen; reduced motion stops the ambient life entirely. The HDRI lights the scene but isn't shown as a backdrop. That follows research showing realistic detail helps when it is task-relevant and harms when it competes for attention ([PMC study](https://pmc.ncbi.nlm.nih.gov/articles/PMC11269326/)), and the finding that seductive details tend to hurt learning ([2025 meta-analysis](https://link.springer.com/content/pdf/10.1007/s10648-025-10099-z.pdf)).

Cinematic budget: one 14-second intro (S1) plus four replay segments of 14–18 seconds each, 77 seconds in total, inside the 90-second budget. Every shot is captioned, skippable from the first frame (Skip button or Esc) and has a reduced-motion version. The intro plays only when the learner asks for it, and nothing plays during an assessment. See [design/realism-matrix.md](design/realism-matrix.md) and [design/shot-list.md](design/shot-list.md).

## Evidence and evaluation

**What was measured** (details in [evaluation/METHODS.md](evaluation/METHODS.md)):
- 166 unit tests (v3.0.0) pass, including: risk-rating bands, including the rule that a rare but fatal hazard is High; the answer key matches the content; controls-ranking scoring; speak-up graph validity (no dead ends, every node and all three outcomes reachable); content counts (12 hazards, 4 distractors, 2 deliberately subtle hazards); every hunt item exists as a selectable 3D object; every zone item is framed by one of its zone's viewpoints at 16:10 and 4:3; v2 living-world integration (ambient systems, patrol motion, calm mode, viewpoint rings).
- 11 browser tests (v3.0.0) pass: keyboard-only completion of all five modules, text mode, touch tap, reduced motion, no-WebGL fallback, Back, axe and the sub-path test. Earlier versions also tested module navigation by keyboard, pre-check feedback, practice-zone rating, a hinted practice zone plus an assessed zone without hints, every speak-up outcome reached, replay decisions and causes chart, intro captioned and skippable, an axe scan of every overlay state (zero critical or serious issues), plus the sub-path test at `/play/hazard-hunt/` (no failed requests, no console errors).
- Headed performance on an Apple M1 (v3.0.0, ui-audit in every module state at 1440×900, 1280×720, 390×844 and 844×390): see the v3.0.0 section above; report `evaluation/results/ui-audit-g2-verify.json`.
- v2 agent reviews (visual realism, interaction, motion load, honesty and accessibility) by a reviewer that didn't build the revamp, labeled "Agent review" in [evaluation/reviews/](evaluation/reviews/); revisions R32–R39 are in DECISIONS.md.

**What it can show:** the course works end to end by keyboard and in text mode, every branch and outcome is reachable, the overlay passes automated WCAG 2.1 AA checks, and the build works under the shared showcase path.

**What it can't show:** whether anyone learns to spot hazards better. No learners have used it, there has been no physical phone testing, and no daily screen-reader user has reviewed it. Real-world accuracy of the risk ratings has not been validated either; they are constructed teaching values.

**What changed because of it:** see the revision log in [evaluation/METHODS.md](evaluation/METHODS.md).

## Play it your way

- **Text mode:** every module, rating, decision and ranking is available as structured text with data tables. In the assessed zone the list covers *every* inspectable area (hazards, distractors and neutral items), so the list itself doesn't give answers away. Rating forms are headed by the area name only; the hazard's name appears only in the feedback.
- **Keyboard:** Tab through everything; WASD or the arrow keys walk and turn the camera (drag, arrow keys or the look buttons to look around); glowing floor rings can be clicked to glide to a viewpoint, and the points-of-interest list jumps to any inspectable area.
- **Reduced motion:** follows your system setting, with an in-app toggle. Cinematics become still frames with the same captions; ambient life stops and camera moves place you instantly instead of gliding.
- **Quality presets:** Low, Medium, High and Ultra, picked automatically from a short warm-up and overridable in Settings.
- Also in Settings: text size, high contrast and field of view. The course has no audio, so there are no volume controls; all text is on screen.

## Accessibility

Tested with axe-core (WCAG 2.1 A/AA rules) on every overlay state, keyboard-only scripted playthroughs and the Playwright accessibility tree. Screen-reader output was checked with Playwright's `ariaSnapshot()`; Guidepup/VoiceOver automation was not run (see `../SYSTEM-CHANGES.md`). Known gaps: no review by a daily screen-reader user, and the 3D hunt itself needs vision. The text-mode hunt is the documented equivalent. Details: [design/accessibility-plan.md](design/accessibility-plan.md).

## System requirements and known limitations

- A current Chrome, Edge, Firefox or Safari with WebGL2. Without WebGL2, the course runs fully in text mode.
- Best on a desktop or laptop. Phones use the Low preset; mobile was checked with device emulation only.
- The forklift is bevelled primitives with flat paint, and the driver's fingers and the pedals don't move (STATUS.md).
- The risk ratings, incident and company are constructed for teaching and are not drawn from real incident data.

## Related portfolio work

- [ai-literacy-program](https://github.com/iwyusdaz/ai-literacy-program): the same fictional client, Northwind Logistics.
- [should-this-be-a-course](https://github.com/iwyusdaz/should-this-be-a-course): the full performance-consulting method behind the "Is it training?" page.

## Tools used

three.js 0.186.1, Vite 8.3.5, Vitest, Playwright with axe-core, Poly Haven CC0 HDRI, textures and 3D models. AI assistance: an AI coding agent drafted the code, content and documents under my direction. Facts about regulations were checked against the sources in [research/sources.md](research/sources.md), and design reviews were done by a separate agent and are labeled as such.

## License and attribution

Code: MIT ([LICENSE](LICENSE)). Learning content: CC BY 4.0 ([LICENSE-CONTENT](LICENSE-CONTENT)). Third-party assets: [ATTRIBUTION.md](ATTRIBUTION.md).

## Trailer

**Trailer:** [docs/trailer.webm](docs/trailer.webm) (54 s, recorded from v2, so it doesn't show the v3 scene; captioned; WebVTT sidecar at [docs/trailer.vtt](docs/trailer.vtt)). Recorded from the real app on the Mac GPU; the caption text is also in the sidecar file.
