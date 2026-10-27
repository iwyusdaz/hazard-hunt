# Decisions — hazard-hunt

| # | Decision | Alternatives | Rationale | Date |
|---|---|---|---|---|
| 1 | Near-miss only; no injury shown; content note before the replay | Dramatic accident | Avoids distress; keeps attention on causes (plan 04 §4) | 2026-10-27 |
| 2 | Distractors in every zone (ramped cable, wrapped stack, guarded machine, striped gate) | Hazards only | Trains discrimination; reduces over-reporting | 2026-10-27 |
| 3 | Learner-paced replay with pause points, scrubber, and a step-wise frozen-moment orbit | Passive video | Causal chain is the content | 2026-10-27 |
| 4 | Workers are faceless procedural hi-vis silhouettes; **MakeHuman not used** | MakeHuman CC0 exports | MakeHuman exports could not be produced in this environment (no desktop app). The plan already sets workers to low realism ("faces aren't the cue"), so silhouettes meet the learning need. | 2026-10-27 |
| 5 | Warehouse built procedurally from primitives with CC0 PBR textures (Poly Haven) and a CC0 HDRI for lighting | Downloaded 3D models | Full control over hazard cues; small download (about 4.6 MB total build); license-clean | 2026-10-27 |
| 6 | All learning decisions live in one shared text flow; 3D adds selection, viewpoints and the replay on top | Separate 3D and text implementations | Text-mode parity by construction: the same items and scoring code serve both | 2026-10-27 |
| 7 | Assessed-zone points-of-interest list includes every inspectable area | List hazards only | A hazards-only list would give the answers away (plan 04 §11) | 2026-10-27 |
| 8 | Severity-5 hazards with likelihood ≥ 2 are always banded High | Pure score thresholds | With scores alone, rare-but-fatal hazards (bent upright, frayed charging cable, unchocked trailer) came out Medium, contradicting the manager guide and safety practice. Rule shown to learners with every rating. | 2026-10-27 |
| 9 | Cinematic budget: S1 (14 s) + replay R1–R4 (63 s) = 77 s | Plan's 15 s S1 + 80 s replay ≈ 95 s with a documented exception | The authored segments came in shorter, so no exception to the 90 s budget is needed | 2026-10-27 |
| 10 | Intro S1 plays only on request (button in Module 1) | Autoplay on load | Learner control; nothing plays near the pre-check | 2026-10-27 |
| 11 | No Draco/Basis decoders in this build | Ship them per template | The project loads no compressed models or textures; shipping them would add 1.7 MB of transfer for nothing | 2026-10-27 |
| 12 | Unchocked-trailer item cites no regulation paragraph | Cite 1910.178(k) | eCFR was bot-blocked when checking the exact wheel-chock paragraph; per the honesty rules the item explains the hazard without a citation | 2026-10-27 |
| 13 | Content in `content/*.json`, copied into the build by `scripts/sync-content.mjs` | Inline in code | Designers can edit content without touching JavaScript (standards 3.4) | 2026-10-27 |
| 14 | README evaluation notice says reviews and performance tests are "in progress" | Use the standard notice now | The standard notice states agent reviews are complete; that would be false until they run. Switch to the verbatim notice once they have. | 2026-10-27 |
| 16 | Merge static, non-inspectable meshes per material at load; presets toggle real-time shadows | Instancing; leave as is | Measured 395 draw calls on Medium (budget 300). Merging keeps inspectables and moving vehicles separate for raycasting and the replay; result 122 on Medium | 2026-10-27 |
| 15 | Linked companion repos `ai-literacy-program` and `should-this-be-a-course` | Name only | Both exist on GitHub (checked with `gh repo view`, 2026-10-27) | 2026-10-27 |
