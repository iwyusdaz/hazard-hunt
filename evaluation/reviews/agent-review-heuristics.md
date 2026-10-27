# Agent review: heuristic evaluation (Nielsen + game playability)

Agent review. Written by a reviewer agent that did not build the course. Based on code reading and the headless screenshots in `screenshots/rev-*`.

## Ratings

| Heuristic | 3D UI | Text mode | Key evidence |
|---|---|---|---|
| H1 Visibility of system status | concern | concern | The HUD status only appears when a zone is fully complete (`app.js:177-180`). There is no "3 of 7 rated" counter in the assessed zone. The POI ✓ marks are the only progress cue. |
| H2 Match with real world | concern | pass | Cues read well in text. In 3D several models don't match their cues (realism R5). |
| H3 User control and freedom | fail | pass | The replay can't be skipped or exited, and its overlay persists across modules (A7). There is no undo for a rating. |
| H4 Consistency and standards | concern | concern | The same rating form is used for hazards and for "leave alone" items. Module 1 says "In this module" but lists five course objectives (`app.js:255`). |
| H5 Error prevention | fail | fail | The rating dialog has no "not a hazard / controlled" choice. A learner who correctly decides to leave a distractor alone still has to give it likelihood × severity to finish the zone (`_zoneComplete` requires every inspectable, `app.js:185-188`). |
| H6 Recognition rather than recall | concern | pass | The band rule is shown on every rating (good). In 3D, learners have to remember which view holds which item, because most views frame nothing (V1). |
| H7 Flexibility and efficiency | pass | pass | POI list, Tab order and arrow keys all work. |
| H8 Aesthetic and minimalist design | concern | pass | The empty POI panel and look pad show on text pages, and the replay bar sits over the hunt (`rev-menu.png`, `rev-rating-dialog.png`). |
| H9 Help users recover from errors | concern | concern | Ranking feedback says "Close — compare your order" for any non-perfect order, even a fully reversed one (`controls-activity.js:92`). |
| H10 Help and documentation | concern | pass | There is no in-app "how to look and select" help for the 3D view. The job aid exists only in the manager guide. |
| P1 Clear goals | concern | pass | Text says "rate the conditions worth reporting and leave alone the ones that only look risky", but the UI forces you to rate everything (H5). |
| P2 Feedback | concern | pass | Feedback quality is good (why + control). In 3D it auto-disappears after 14 s (A4). |
| P3 Challenge/skill balance | fail | concern | 3D: difficulty comes from camera framing and click misses, not from noticing. Text: answers are given away by the form heading (A1), and cue text states the hazard outright ("insulation is split and three strands poke out"). |
| P4 No unnecessary friction | fail | pass | Click mis-targeting (V9), and views that face away (V1). |

## Findings

| # | Severity | Finding | Location | Fix |
|---|---|---|---|---|
| H-1 | critical | **There is no "controlled condition / not a hazard" response**, so objective 2 (discrimination) can't be shown. Every distractor is completed by rating it, and the record logs `success: true` for any distractor rating (`app.js:521`). | `hazard-hunt.js:74-131`; `app.js:521` | Add a first step: "Hazard to report / Controlled condition / Acceptable". Rate only if "Hazard". Score discrimination. |
| H-2 | critical | **The answer label appears as the rating heading** in unhinted zones (also A1). | `hazard-hunt.js:77` | Use `def.area`. |
| H-3 | critical | **Most 3D views frame no items** (V1). | `warehouse.js:476-484` | Re-aim the views; add a test. |
| H-4 | major | **The post-check (5 items) is never shown**, so the learner sees no closing assessment and no pre/post comparison, although the alignment matrix depends on post1–post5. | `items.json:9-15`; no use in `src` | Render the post-check at the end of Module 5 and show the pre vs post score. |
| H-5 | major | **The transfer reflection has no input field** (just a prompt). | `app.js:515-516` | Add a textarea and log it as `responded`. |
| H-6 | major | **The text mode is the default for every module** (`gotoModule` sets `textmode.hidden = false`, `app.js:231`). The 3D hunt is reached only through "Go to:" buttons, and nothing tells the learner how to get back to the list from 3D except the header "Text mode" toggle. | `app.js:228-236, 304` | Add a visible "Back to list" button in 3D, and say how to switch. |
| H-7 | major | **The causes chart is not built by the learner**, despite the heading "Build the contributing-causes chart" (`app.js:391-397`). | | Make it a sort activity (cause → condition/behavior/system) with feedback, or rename it. |
| H-8 | major | **Ranking feedback doesn't show the correct order**: only "your tiers" plus the generic `why`. | `controls-activity.js:91-93` | Show the reference order next to the learner's order. |
| H-9 | minor | **"Already rated" is announced, but the dialog reopens and allows re-rating**, which overwrites the first answer. | `app.js:165-167` | Show the earlier feedback read-only, or label the second attempt as practice. |
| H-10 | minor | **The practice hint text is static** ("Warm areas: near the dock walkway, the charging cable ends") and names two answers outright. | `hazard-hunt.js:138` | Make the hints progressive and per area. |
| H-11 | minor | **The "Restart module" menu item doesn't reset hunt flags or results.** | `app.js:221`; `HuntController.flags` | Clear that zone's flags on restart. |
