# Status — hazard-hunt

Last updated: 2026-10-27

## Final Quality Checklist (plan 04 §14)

| Item | Status |
|---|---|
| Hazard catalog complete with cues, ratings and sources | done — `content/zones.json` (12 hazards, 4 distractors, 3 neutral; unit-tested counts); sources in `research/sources.md` |
| All hunt hazards and distractors work on every preset and in text mode | done (agent review) for framing and picking — every item is in frame from one of its zone's views and pickable (`tests/unit/views.test.js`); cue models revised (DECISIONS R4). Per-preset legibility re-check after the revisions: Medium only (`evaluation/results/revisions/`); Low/High/Ultra not re-shot |
| Replay pauses, scrubber and causes builder work by keyboard | done — buttons and a range input; decisions tested in the text flow |
| Disclaimer present; no compliance claims | done — README, Module 1, Menu dialog, completion summary, showcase.json summary, manager guide |
| Every speak-up branch reachable | done — unit test (graph) + browser test (all three outcomes) |
| Performance budgets met | done — Apple M1, headed: 60 fps on every preset, 122 draw calls on Medium, menu interactive 0.33 s, 3.78 MB before first interaction (`evaluation/results/perf-2026-10-27.json`) |
| Release v1.0.0 published with archive, checksum and showcase.json; sub-path test passes | partly — sub-path test passes; showcase.json validates; release not yet tagged |
| README: play link, trailer, realism rationale, evaluation notice, link to should-this-be-a-course | partly — all except the trailer (not yet recorded) |

## Other required work
| Item | Status |
|---|---|
| Agent reviews (heuristics, walkthrough, multimedia, realism/cinematics, accessibility, expert-style, visual) + ≥ 5 revisions | done (agent review) — 8 reports in `evaluation/reviews/` (including the independent second pass); revisions R1–R31 logged in `DECISIONS.md` (R1–R17 first pass, R18–R31 for the second-pass findings N1–N17) |
| Review findings still open | Second pass: N4 residual — distractors are still shorter than the correct option (position/letter cue removed by the seeded shuffle; length cue needs content edits); N8 mobile bottom-sheet reposition not re-screenshotted on a mobile viewport. First pass: V10/V11 High/Ultra presets still differ from Medium only in shadow-map size (AO/SMAA/texture size not wired; time box). R6/V15 replay cameras not re-framed on their causes; R8 S1 captions not timed; A6 reduced-motion S1 still auto-advances; A8 pre-check `radiogroup` of buttons; A11 POI list not grouped by zone; H-7/L7 causes chart and "Is it training?" are read-only tables; H-9 re-rating overwrites; H-10 hints static; L6 45-minute duration still an estimate; S7 SHIA model not sourced; Mayer: no worked rating example, modal dialog covers the object, 15 forms on one text page. All were lower priority than the critical/major items fixed within the revision time boxes |
| Captioned trailer ≤ 60 s | pending |
| Guidepup VoiceOver logs | not possible in this run (macOS permission dialogs); ariaSnapshot fallback used. See `../SYSTEM-CHANGES.md` |
| Learner and real-device testing | not possible (no learners, no physical phones) — templates in `evaluation/human-protocol/` |
