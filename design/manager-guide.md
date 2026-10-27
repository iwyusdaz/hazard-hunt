# Facilitator and manager guide

For team leads and safety managers using Hazard Hunt in onboarding. (Northwind Logistics is fictional; adapt the framing to your site.)

**This course does not replace training required by law or by your employer.** Use it alongside your site's required training, not instead of it.

## Timing (about 45 minutes)
| Module | Minutes | Notes |
|---|---|---|
| 1. Why hazards hide | 5 | Pre-check; optional 14 s intro |
| 2. Practice + assessed hunt | 15 | Part A has hints; Part B doesn't |
| 3. Incident replay | 10 | Content note first; learner-paced |
| 4. Fix it | 8 | Controls ranking + "Is it training?" |
| 5. Speak up + transfer | 7 | Branching conversation, then a new zone |

## Discussion prompts
- "Which hazard in Part B did you walk past at first? Why?" (normalization of risk)
- "The mirror was aligned wrong. Whose job was it to notice?" (system causes, ownership)
- "Which of today's hazards would training alone *not* fix?"
- "What makes a report easy for a busy lead to act on?"

## Common misconceptions
- "If nothing has happened, it's safe." The replay is built around a near-miss to challenge this.
- "Report everything that looks risky." Distractors show why controlled conditions shouldn't flood the queue.
- "The fix is always more training." Module 4 ranks engineering controls above training and PPE.

## Answer key (reference bands)
High (▲▲): blocked fire exit, missing machine guard (amputation risk, severity 5), bent upright, frayed charger supply cable, trailer not secured at the dock, loaded truck across the walkway, blocked battery bay. Medium (▲): spill, hose across the walkway, overhang, leaning stack, misaligned mirror. Controlled conditions: ramped cable, wrapped stack, guarded machine side, striped gate. Full reasoning per item: `content/zones.json`.

## About the learning record
Progress is saved only in the learner's browser (slug-prefixed `localStorage`) and can be downloaded as xAPI-shaped JSON from "My progress". Nothing is sent anywhere. In a real deployment, aggregating which hazards are most often missed would need a learning record store, informed consent, and a clear rule that the data is used to improve the course and the workplace, not to rate individuals.

## Learner job aid: Spot it, rate it, report it
1. **Spot it:** look down (floor), up (racks, mirrors), and at edges (doors, guards, cables).
2. **Rate it:** how likely (1–5) × how bad (1–5). High = act now.
3. **Report it:** Situation, Hazard, Impact, Ask, with one specific request.
