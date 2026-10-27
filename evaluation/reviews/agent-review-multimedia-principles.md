# Agent review: Mayer's multimedia principles

Agent review. Written by a reviewer agent that did not build the course. Evidence comes from `content/*`, `src/*` and the screenshots in `screenshots/rev-*`.

| Principle | Verdict | Evidence | Violations / fix |
|---|---|---|---|
| Coherence | concern | No sparks, smoke or decorative HDRI backdrop (good, `app.js:121-134`). | (1) The replay-only pedestrian with a trolley arm stands in the assessed aisle during the hunt (`warehouse.js:261`; `rev-low-aisleNorth.png`). It is a salient non-inspectable figure. (2) Transfer-zone props are visible from practice-zone views (`rev-low-dock.png`) and invite clicks that do nothing. (3) The empty POI panel and look pad appear on text-only pages. Fix: hide objects not active in the current module, or dim them. |
| Signaling | fail (3D) / pass (text) | Text: the cue column of the area table, and hints with 💡 plus text. | 3D: no highlight on hover or selection, and no cue that an object is inspectable. Default views don't frame the items (V1). The replay doesn't signal the causes it narrates; the seg1 camera misses the mirror (R6). Fix: hover outline, "cause" markers in the replay. |
| Redundancy | concern | No narration, so there is no audio + identical-text redundancy. | The 3D view shows the cue *and* the text form restates it ("insulation is split and three strands poke out") alongside the answer label. In the hunt the text replaces visual noticing instead of supporting it. Fix: in the unhinted zones, 3D learners should get the area name only. Text mode keeps cue descriptions as the equivalent. |
| Spatial contiguity | concern | The band rule sits inside the rating dialog (good). | 3D feedback appears at the top of the screen (`site.css:75`), away from the object it refers to, and the dialog hides the object while rating (`rev-rating-dialog.png`). The replay causes text is a separate panel below the story. Fix: a non-modal side panel so the object stays visible while rating. |
| Temporal contiguity | concern | Replay decisions pause at the moment they refer to (good, `replay-player.js:84-93`). | S1 shows both captions at once for 14 s, not synchronized with the camera (`shot-player.js:66`). The causes overlay appears only after the segment ends (`app.js:446-447`), not when each cause becomes visible. |
| Segmenting | pass/concern | Five modules, four learner-paced replay segments, one control task at a time. | Module 2 renders 15 rating forms on one page (`app.js:285-291`), which is long for B1 readers. Fix: one area per screen in text mode, with next/previous. |
| Pre-training | concern | The pre-check introduces likelihood × severity and controlled conditions (`items.json` pre3, pre4). | The 1–5 scales are defined only by their endpoints. There is no worked example of rating one item before the hunt, and no orientation to the 3D controls. Fix: a 30-second worked example (spill: 3×4=12, Medium) plus a "how to look and select" card. |
| Modality | n/a / concern | The course has no audio (`settings.js` volume controls do nothing). All verbal content is on-screen text. | For a B1 audience, on-screen text over a moving replay costs attention. Consider optional narration for the replay story (with captions), or keep the replay paused while text is shown. |
| Learner control | concern | Play, pause and scrub in the replay; the intro is opt-in; no timers in decisions. | No skip or exit in the replay (A7). 3D feedback auto-dismisses after 14 s (A4). S1 reduced-motion auto-advances. Scrubbing backward resets fired pause points (`replay-player.js:57`), so learners may get re-asked, which is fine. Fix: Exit replay, persistent feedback. |
| Personalization / politeness (supplementary) | pass | Second person, plain tone, a respectful supervisor dialogue. | "Consider the alternative:" for wrong replay answers is a little vague. Say "Not the best choice:" and give the reason. |

## Violation list (prioritized)
1. Signaling in 3D: no highlight, and the views don't frame the items (major).
2. Redundancy: the answer label and full cue text beside the 3D hunt remove the noticing task (critical for objective 1 assessment validity; same as A1).
3. Coherence: replay-only actors and inactive transfer props in hunt views (major).
4. Spatial contiguity: the modal dialog hides the object being rated (minor).
5. Temporal contiguity: untimed S1 captions; the causes overlay arrives late (minor).
6. Segmenting: 15 forms on one text page (minor).
7. Pre-training: no worked rating example and no controls orientation (major for the B1 audience).
8. Learner control: no replay exit; feedback disappears (major).
