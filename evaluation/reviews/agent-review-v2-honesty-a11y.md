# Agent review — v2.0.0 honesty & accessibility (hazard-hunt)

Agent review, 2026-10-28. Same test-hooks build. axe-core 4.x run on the whole document in five states; contrast computed from computed styles; attribution verified in source **and in the built output** (`tmp/review-build`).

## 1. axe results — zero critical/serious (gate passes)

| State | Critical/Serious | Other violations |
|---|---|---|
| Menu / Module 1 | **0** | `empty-heading` (minor) ×1, `page-has-heading-one` (moderate) ×1 |
| Hunt + rating dialog open | **0** | none — completely clean |
| 3D replay (paused, replay bar) | **0** | `page-has-heading-one` (moderate), `region` (moderate: `.replay-story` outside a landmark) |
| Module 5 post-check page | **0** | same 2 as menu |
| Debrief (completion summary rendered) | **0** | same 2 as menu |

- **A2-1 (minor)** — `empty-heading`: the `.textmode-title` `<h2>` in the drawer is empty (`src/ui/shell.js` renders the title into `p.app-title` in the header; the drawer h2 gets no text). Fix: drop the empty element or fill it.
- **A2-2 (moderate, pre-existing)** — no `<h1>` anywhere; the app title is a `<p class="app-title">` (`src/ui/shell.js` line 17). Carried from v1; promote `.app-title` to `<h1>` (also clears `page-has-heading-one` on every state).
- **A2-3 (moderate)** — replay-only: `.replay-story` content is not inside a landmark region. Wrap the replay bar/story in a `<section aria-label>` or `role="region"`.

## 2. Contrast of the new tooltip / speech-bubble styles (computed)

All pairs computed against their actual rendered colors (WCAG relative luminance):

| Pair | Ratio | ≥ 4.5:1 |
|---|---|---|
| Tooltip text `#f8fafc` on `#11161d` (`.v2-world-tooltip`, `src/v2/hud-shell.css`) | **17.1:1** | pass |
| Speech-bubble text (same pair) | 17.1:1 | pass |
| Bubble speaker `#ffd166` on `#11161d` | 13.5:1 | pass |
| HUD primary text `#f3f6f8` on surface `#12181f` | 16.9:1 | pass |
| HUD muted `#b8c4ce` on `#12181f` | 10.0:1 | pass |

Tooltip font-size 0.86rem/600 and bubble 0.84rem are small but high-contrast, non-essential (hover-only), `aria-hidden`, and duplicated by the POI list. Pass.

## 3. Honesty — intact

- **Fictional company labels**: header reads "Hazard Hunt — Northwind Logistics (fictional)"; Module 1 opens "Northwind Logistics (fictional) runs this distribution center…"; speak-up section is labelled "(Fictional scenario, constructed for teaching.)". No compliance claims anywhere (checked for compliant/certified/guarantees patterns — clean); disclaimer "This course does not replace training required by law or by your employer." present in Module 1, the Menu dialog, and the completion summary (verified live in the Menu dialog and Module 1).
- **Attributions present in source and build**: `ATTRIBUTION.md` lists all 12 third-party assets (Poly Haven HDRI + 4 texture sets + 8 GLB models with authors/CC0, 3 SIL-OFL fonts with authors, three.js MIT) plus a "made for this repo" table. `npm run build` runs `scripts/build-attribution.mjs`; the built `tmp/review-build/attribution.json` exists with 16 entries matching the table. Model manifest `public/assets/models/manifest.json` carries per-model author/source/license.
- **Poster alt text**: `public/showcase.json` `poster.alt` — "A receiving dock in a night-shift warehouse: a dark spill sheen on the concrete floor in the foreground, blue pallet racking loaded with stock on both sides, an orange pallet jack, red steel drums and a dock door with its red-green traffic signal beyond" — accurate against the rendered poster (`public/poster-2.0.0.jpg`). The app itself renders no `<img>` (poster lives in the showcase), so there is no in-app alt to check.
- **No new audio** shipped (owner decision 9): no audio assets in the build; settings correctly say the course has no audio (carried from R15).

## Findings summary

- No critical or serious axe issues in any of the five states — the a11y gate passes.
- Three small structural a11y items (empty h2, missing h1, replay region) are cheap fixes that would take the axe report to fully clean.
- Honesty labeling, attribution (source + built artifact), and poster accuracy all pass with nothing to fix.

**Verdict:** honesty and accessibility are release-ready; the three structural axe nits are recommended before tagging but none blocks the gate.
