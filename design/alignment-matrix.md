# Alignment matrix

Objective → in-world activity → feedback → assessment. Every row exists in both the 3D view and text mode (the decisions live in the shared text flow; 3D adds visual selection on top).

| Objective | Activity | Feedback | Assessment item(s) |
|---|---|---|---|
| 1. Identify and rate hazards | Module 2 Part A: practice-zone hunt with hints (4 hazards). Part B: assessed zone, no hints (6 hazards). | Per item: your band vs the reference band, with the likelihood × severity reasoning and the right control | Pre-check items pre3; risk rating on every assessed-zone hazard; transfer hunt (2 hazards); post-check post2 |
| 2. Hazards vs controlled conditions | Distractors in every zone: ramped cable, wrapped stack, guarded machine, striped gate. Neutral items too. | "Controlled condition" feedback explaining what the control is and why over-reporting buries real hazards | Pre-check pre4; distractor handling in assessed and transfer zones |
| 3. Analyze incident causes | Module 3: four-segment learner-paced near-miss replay with two pause-and-decide points; causes chart | Per decision: why the choice helps or hurts; causes overlay after each segment | Two replay decision items; causes chart (condition / behavior / system); post-check post3 |
| 4. Hierarchy of controls | Module 4: rank 5 controls for each of 3 hazards (overhang, frayed cable, mirror); "Is it training?" table | Your tier order vs the hierarchy, with the reasoning for each hazard | Ranking score per hazard (inversion count); pre-check pre5; post-check post1, post5 |
| 5. Report clearly | Module 5: branching conversation reporting a blocked exit to a busy supervisor | Outcome debrief (strong / mixed / poor) explaining what made the report fast and complete, or not | Branch outcome; post-check post4 |

Coverage check: every objective has at least one practice activity, feedback, and an assessed item. Checked by reading `content/` against this table (2026-10-27); the unit tests also confirm the hazard and distractor counts and that every speak-up outcome is reachable.

Transfer task: the transfer hunt in a new zone (no hints) plus a written reflection ("one condition that looks risky but is controlled, one that looks normal but is not"). The reflection isn't auto-graded.
