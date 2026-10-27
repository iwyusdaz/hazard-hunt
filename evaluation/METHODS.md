# Evaluation methods — hazard-hunt

What was checked, how, and what it can and can't show. No real learners have used this course. Nothing here is evidence of learning gains.

## Automated tests (run 2026-10-27, headless Chromium, Playwright 1.64.1, Vitest 5.0.5)

| Suite | Count | Result | What it checks |
|---|---|---|---|
| Unit (`tests/unit/core.test.js`) | 11 | 11 passed | Risk bands incl. the severity-5 rule; answer key matches content; controls ranking scoring; speak-up graph (no dead ends, all nodes and 3 outcomes reachable); content counts (12 hazards, 4 distractors, 2 subtle); every hunt item exists as a 3D object |
| Functional (`tests/functional.spec.js`) | 7 | 7 passed | Keyboard module navigation; pre-check feedback; practice-zone rating; assessed zone has no hints; all speak-up outcomes reached; replay decisions and causes chart; intro captioned and Esc-skippable |
| Accessibility (`tests/a11y.spec.js`) | 1 | passed | axe-core, WCAG 2.0/2.1 A and AA tags, on: module 1, settings dialog, menu dialog, practice hunt with rating forms, progress dialog. Gate: zero critical or serious violations |
| Sub-path (`tests/sub-path.spec.js`) | 1 | passed | Build served from `/play/hazard-hunt/`: no failed requests, no console errors, canvas or fallback present, text mode opens, "All projects" links to `/` |
| Showcase manifest (`scripts/validate-showcase.mjs`) | — | passed | `showcase.json` against the schema; version; required files; posters ≤ 200 KB |

**Can show:** the course runs end to end in the text flow, by keyboard; every branch and outcome is reachable; the HTML overlay passes automated WCAG checks; the build works at the showcase sub-path.

**Can't show:** whether learners notice hazards better, whether the risk ratings match a real site's judgment, or how a screen-reader user experiences it.

## Not yet run (tracked in STATUS.md)
- Headed GPU performance runs per preset (fps, draw calls, triangles, texture memory).
- Agent-based design reviews and the revisions they lead to.
- Captioned trailer.

## Not possible in this run
- **Guidepup/VoiceOver automation:** needs macOS permission dialogs; Playwright's accessibility tree was used instead.
- **Learner testing and physical phones:** no participants or devices. Templates for future sessions are in `human-protocol/`.

## Revision log
Changes made because of checks during the build (agent-review revisions will be added below them):
1. The assessed zone existed in content but wasn't shown in any module. Found by comparing content with the scene; Module 2 now has Part A (practice, hints) and Part B (assessed, no hints).
2. Seven content items had no 3D object (trailer, transfer zone, aisle floor, parked truck ID mismatch). Added the objects and a unit test that keeps content and scene in sync.
3. Rare-but-fatal hazards were banded Medium by score alone, contradicting the answer key. Added the severity-5 rule, showed it to learners, and tested the answer key against content.
4. Reduced motion didn't apply to the replay camera, and the frozen-moment orbit spun automatically. The replay now cuts with reduced motion, and orbit moves 45° per press.
5. A hidden cinematic overlay blocked every click (CSS `display:flex` overrode `hidden`). Fixed and covered by the functional tests.
6. An unverifiable regulation citation on the trailer item was removed (eCFR was bot-blocked).
