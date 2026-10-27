# Accessibility plan

Maps features to the [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/), [Xbox Accessibility Guidelines](https://learn.microsoft.com/en-us/gaming/accessibility/guidelines) (XAG) and WCAG 2.1 AA for the HTML layer. "Tested" means automated or scripted checks in `tests/`; nothing here has been reviewed by an assistive-technology user.

| Need | Feature | Guideline | Status |
|---|---|---|---|
| Screen reader | All UI is semantic HTML over the canvas; live-region announcements for ratings, feedback and views | WCAG 1.3.1, 4.1.2, 4.1.3 | Tested (axe; ariaSnapshot) |
| Can't use the 3D view | Text mode covers every objective and every assessment decision (shared text flow) | GAG "provide an alternative"; XAG 101 | Tested (functional suite runs entirely in the text flow) |
| Keyboard only | Every control is a button, radio or link; arrow keys look around; points-of-interest list | WCAG 2.1.1, 2.4.3 | Tested |
| Pointer alternatives | On-screen look buttons; ranking uses up/down buttons, never drag | WCAG 2.5.1 | Tested |
| Giving answers away | Assessed-zone POI list includes hazards, distractors and neutral items | Plan 04 §11 | Built |
| Color vision | Risk bands use icons (●, ▲, ▲▲) and words; hints are text plus an icon | WCAG 1.4.1 | Built |
| Motion sensitivity | Reduced-motion setting (follows the OS, plus a toggle): cinematics become stills; FOV setting | WCAG 2.3.3; XAG 117 | Built |
| Flashing | No flashing content | WCAG 2.3.1 | Built (no flashing elements exist) |
| Time | No timers anywhere; pause anywhere | WCAG 2.2.1, 2.2.2 | Built |
| Hearing | All cinematic content is captioned; no audio is needed to complete any task | WCAG 1.2.2 | Built |
| Reading level | Plain English at about B1; adjustable text size and high-contrast setting | WCAG 1.4.4, 1.4.3 | Built |
| Distressing content | Content note before the replay; near-miss only, no injury | GAG "content warnings" | Built |

**Known gaps:** Guidepup/VoiceOver automation was not run (it needs macOS permission dialogs; see `../SYSTEM-CHANGES.md`). The 3D hunt needs vision; the text-mode hunt is the equivalent. No review by a daily screen-reader user.
