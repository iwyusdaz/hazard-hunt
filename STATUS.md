# Status — hazard-hunt

Last updated: 2026-10-28

## v2.0.0 visual and interaction revamp (plan 09 §4.4)

| Item | Status |
|---|---|
| Art bible, self-hosted fonts (Big Shoulders Stencil Display / Barlow / Share Tech Mono), palette | done — `design/art-bible.md`, `src/styles/case-fonts.css` (milestone 1) |
| Living scene: animated-movie stylized workers, ambient life (dust, light shafts, patrol cart with proximity stop, conveyor), Calm Mode, reduced-motion stop | done — `src/v2/ambient-life.js`, `src/v2/stylized-character.js`, wired in `src/scenes/warehouse.js`; unit-tested (`tests/unit/v2-core.test.js`) |
| 8 Poly Haven CC0 models as grounded dressing (async, non-blocking) | done — `public/assets/models/` + `manifest.json`, placed by `src/v2/model-placer.js` (verified loading in rendered previews) |
| Full-bleed 3D + floating HUD drawer; text-mode parity intact | done — `src/v2/hud-shell.css`, `src/ui/shell.js`, `src/app.js`; WebGL fallback keeps the old behaviour |
| Hotspot glide + WASD/arrow walking, viewpoint floor rings, reduced-motion instant placement | done — `src/app.js` `_update3D/_gotoView`, `Warehouse.pickViewpoint`; `views.test.js` and the Playwright suites still pass |
| Case grade + sky | done — `applyCaseGrade` in `src/app.js`; grade/sky modules unit-tested |
| Tests green after the revamp | done — 31 unit tests, 9 functional+a11y Playwright tests, run 2026-10-28 |
| Posters re-rendered from the v2 scene; stale posters removed | done — `poster-2.0.0.webp` 33.3 KB / `.jpg` 68.4 KB (dock view); `render-poster.mjs` cleanup |
| Release docs: CHANGELOG 2.0.0 entry, DECISIONS 17–23, showcase.json 2.0.0, package.json 2.0.0 | done |
| v2 agent reviews + ≥ 5 revisions; "is it alive" capture; cue-salience on Low/Medium | pending — the dedicated v2 review pass gates the release |
| Headed GPU performance re-measure for v2 (budgets: ≤ 300 draw calls, ≤ 15 MB before first interaction) | pending — happens at the orchestrator's headed GPU gate; v1.0.0 numbers below stand for the v1 scene |
| Tag v2.0.0 + GitHub release + showcase re-pin | pending — orchestrator tags after the headed GPU check |

## Final Quality Checklist (plan 04 §14)

| Item | Status |
|---|---|
| Hazard catalog complete with cues, ratings and sources | done — `content/zones.json` (12 hazards, 4 distractors, 3 neutral; unit-tested counts); sources in `research/sources.md` |
| All hunt hazards and distractors work on every preset and in text mode | done (agent review) for framing and picking — every item is in frame from one of its zone's views and pickable (`tests/unit/views.test.js`, re-run green on the v2 scene); cue models revised (DECISIONS R4). Per-preset legibility re-check after the revisions: Medium only (`evaluation/results/revisions/`); Low/High/Ultra not re-shot |
| Replay pauses, scrubber and causes builder work by keyboard | done — buttons and a range input; decisions tested in the text flow |
| Disclaimer present; no compliance claims | done — README, Module 1, Menu dialog, completion summary, showcase.json summary, manager guide |
| Every speak-up branch reachable | done — unit test (graph) + browser test (all three outcomes) |
| Performance budgets met | v1.0.0: done — Apple M1, headed, re-measured 2026-10-27 after the revisions: 60 fps on every preset, 139 draw calls on Medium, menu interactive 0.14 s, 3.83 MB before first interaction (`evaluation/results/perf-2026-10-27.json`). v2.0.0: re-measure pending (see above) |
| Release v1.0.0 published with archive, checksum and showcase.json; sub-path test passes | done — v1.0.0 tagged and released 2026-10-27; sub-path test passes. v2.0.0 release pending the gates above |
| README: play link, trailer, realism rationale, evaluation notice, link to should-this-be-a-course | v1.0.0: done (54 s trailer at `docs/trailer.webm`). v2.0.0 trailer re-record pending (plan 09 §3) |

## Other required work
| Item | Status |
|---|---|
| Agent reviews (heuristics, walkthrough, multimedia, realism/cinematics, accessibility, expert-style, visual) + ≥ 5 revisions | v1.0.0: done — 8 reports in `evaluation/reviews/` (including the independent second pass); revisions R1–R31 logged in `DECISIONS.md`. v2.0.0: dedicated review pass pending |
| Review findings still open | Second pass: N4 residual — distractors are still shorter than the correct option (position/letter cue removed by the seeded shuffle; length cue needs content edits); N8 mobile bottom-sheet reposition not re-screenshotted on a mobile viewport. First pass: V10/V11 High/Ultra presets still differ from Medium only in shadow-map size (AO/SMAA/texture size not wired; time box). R6/V15 replay cameras not re-framed on their causes; R8 S1 captions not timed; A6 reduced-motion S1 still auto-advances; A8 pre-check `radiogroup` of buttons; A11 POI list not grouped by zone; H-7/L7 causes chart and "Is it training?" are read-only tables; H-9 re-rating overwrites; H-10 hints static; L6 45-minute duration still an estimate; S7 SHIA model not sourced; Mayer: no worked rating example, modal dialog covers the object, 15 forms on one text page. All were lower priority than the critical/major items fixed within the revision time boxes |
| Captioned trailer ≤ 60 s | v1.0.0: done (54 s). v2.0.0: re-record pending |
| Guidepup VoiceOver logs | not possible in this run (macOS permission dialogs); ariaSnapshot fallback used. See `../SYSTEM-CHANGES.md` |
| Learner and real-device testing | not possible (no learners, no physical phones) — templates in `evaluation/human-protocol/` |
