# Agent review: cognitive walkthrough

Agent review. Written by a reviewer agent that did not build the course.

**Persona:** Ahmed, 30, temporary worker, intermediate English. He needs visual, low-text interaction (`design/personas.md:9`). He uses the training-station desktop with a mouse. **Path:** the core learning path for objectives 1–2 (spot, rate, discriminate), then 3 and 5.

Questions at each step: (Q1) Will he know what to do? (Q2) Will he see progress? (Q3) Will he get usable feedback?

| Step | Q1 | Q2 | Q3 | Notes / where the answer is no |
|---|---|---|---|---|
| 1. Open app, Module 1 | yes | n/a | n/a | The text is about B1. It includes "normalization of risk" and "contributing causes", which are hard for B1. The POI header floats over the text (`rev-menu.png`), which is confusing. |
| 2. Pre-check (5 items) | yes | **no** | yes | No "1 of 5" and no score. Feedback is shown per item. |
| 3. Play intro S1 (optional) | yes | yes ("Shot 1 of 1 — purpose: orient") | n/a | "purpose: orient" is designer jargon on screen (`shot-player.js:65`). Both captions show at once. |
| 4. Module 2: decide how to hunt | **no** | — | — | Module 2 opens as a long text page with 7 rating forms for Part A, followed by 8 more for Part B. Ahmed (low-text need) has to find the small "Go to: Receiving dock" buttons to reach 3D. Nothing says the 3D view is the intended path. |
| 5. Go to: Receiving dock | **no** | — | — | The camera looks south at the transfer zone (`rev-low-dock.png`). None of the dock hazards are visible. He sees a striped gate and a loaded truck, which belong to the transfer zone. Clicking them does nothing, because they aren't active in Module 2 (`app.js:137-141`). There is no feedback for the click. |
| 6. Turn the camera to find items | **no** | — | — | Nothing tells him he can drag or use the ◀▶ pad. Each step is 11°. The spill and dock signal are 20+ m away and a few pixels in size (V5, V6). |
| 7. Click an item | partly | — | — | No hover highlight. Clicks may hit the wrong object (V9). |
| 8. Rating dialog | partly | — | yes | The heading names the hazard (A1), so the dialog tells him the answer before he has decided. The "Likelihood × severity" radios are clear. The band rule sentence is long ("score 15 or more, or any severity-5 hazard...") for B1. |
| 9. Ramped cable (distractor) | **no** | — | partly | He thinks it is controlled, but the only options are likelihood and severity. If he picks 1×1, the feedback says "controlled condition", but he can't tell whether his judgment was counted. He also can't see the yellow ramp the text mentions (V3). |
| 10. Feedback after rating | yes | **no** | yes, but it disappears after 14 s | Feedback is long (2–4 sentences of B1+), so a slow reader can lose it (A4). There is no running count of "4 of 7 rated" in 3D. |
| 11. Zone complete | yes | yes | yes | It only completes once *every* item, including neutral and distractor items, has been rated. This contradicts "leave alone the ones that only look risky" (`app.js:185-188`, `app.js:286`). |
| 12. Part B, assessed zone | **no** | **no** | yes | The views miss the bent upright, mirror and leaning stack (V2). The parked truck that he may have learned is "neutral" is now an assessed-zone object in practice-zone data (realism R4). |
| 13. Module 3 replay | yes | partly (time readout, no segment count) | yes | Seg1 frames a carton and not the mirror (R6). Decision dialogs work. The "Contributing causes" overlay adds text he only reads, with nothing to do. |
| 14. Leave the replay | **no** | — | — | There is no Exit button, and the replay bar stays on screen in later modules (A7). |
| 15. Module 4 ranking | yes | yes ("Next hazard") | partly | "Close — compare your order" even for a reversed order; the correct order is not shown (H-8). |
| 16. Module 5 speak-up | yes | yes | yes | Strong. The outcomes are clear and he can retry. |
| 17. Transfer hunt (no hints) | partly | **no** | yes | 3D: the transfer view faces the empty north wall (V1). Text: the rating heading gives the answer (A1). There is no input for the reflection (H-5). |
| 18. End of course | **no** | **no** | **no** | No post-check, no summary, no "you finished". "My progress" is in the menu only. |

## Places where the answer is "no" (action list)
1. Step 4: make 3D the obvious entry for the hunt (a "Start the hunt in 3D" button first, with the list as the alternative).
2. Steps 5, 6, 12, 17: re-aim the views (V1). Add a one-line "drag or use ◀ ▶ to look around" tip.
3. Step 5: give feedback on clicks at inactive objects ("This belongs to a later zone").
4. Steps 8, 17: remove the answer label from the heading.
5. Step 9: add a "Controlled condition" response.
6. Steps 2, 10, 12: add progress counters (pre-check n/5, zone n/N rated).
7. Step 10: keep feedback until dismissed, shorten it to 1–2 sentences, and put details behind "More".
8. Step 14: add an Exit/Skip button to the replay, and clear the overlay on module change.
9. Step 18: add a post-check plus a completion summary with pre/post scores and the hazards he missed.
10. Step 3: remove "purpose: orient" from the learner-facing UI.
