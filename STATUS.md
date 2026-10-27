# Status — hazard-hunt

Last updated: 2026-10-27

## Final Quality Checklist (plan 04 §14)

| Item | Status |
|---|---|
| Hazard catalog complete with cues, ratings and sources | done — `content/zones.json` (12 hazards, 4 distractors, 3 neutral; unit-tested counts); sources in `research/sources.md` |
| All hunt hazards and distractors work on every preset and in text mode | partly — text mode: done (functional tests). 3D: every item exists as a selectable object (unit test); per-preset legibility check pending the agent visual review |
| Replay pauses, scrubber and causes builder work by keyboard | done — buttons and a range input; decisions tested in the text flow |
| Disclaimer present; no compliance claims | done — README, Module 1, showcase.json summary, manager guide |
| Every speak-up branch reachable | done — unit test (graph) + browser test (all three outcomes) |
| Performance budgets met | pending — headed GPU runs per preset not yet done |
| Release v1.0.0 published with archive, checksum and showcase.json; sub-path test passes | partly — sub-path test passes; showcase.json validates; release not yet tagged |
| README: play link, trailer, realism rationale, evaluation notice, link to should-this-be-a-course | partly — all except the trailer (not yet recorded) |

## Other required work
| Item | Status |
|---|---|
| Agent reviews (heuristics, walkthrough, multimedia, realism/cinematics, accessibility, expert-style, visual) + ≥ 5 revisions | pending |
| Captioned trailer ≤ 60 s | pending |
| Guidepup VoiceOver logs | not possible in this run (macOS permission dialogs); ariaSnapshot fallback used. See `../SYSTEM-CHANGES.md` |
| Learner and real-device testing | not possible (no learners, no physical phones) — templates in `evaluation/human-protocol/` |
