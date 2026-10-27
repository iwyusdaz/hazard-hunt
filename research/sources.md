# Sources — verified facts (Hazard Hunt + Incident Replay)

Every claim about real regulations or research in this repo traces to a source below.
Format: claim → source (URL, access date, verification status).

## Regulatory background (background only; the course claims no compliance)

1. **OSHA 29 CFR 1910.178 "Powered industrial trucks"** governs fork trucks / powered industrial trucks in general industry.
   - Source: https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.178 — accessed 2026-10-27, opened and read (via page reader; direct WebFetch is bot-blocked, content read in full).
   - Verified details used: the standard requires daily or per-shift examination of trucks before placement in service (1910.178(q)(7)); "Fire aisles, access to stairways, and fire equipment shall be kept clear" (1910.178(m)(14)); operator training must include pedestrian-traffic topics (1910.178(l)(3)(ii)(D)); battery charging installations must be in designated areas with flushing/neutralizing facilities and ventilation (1910.178(g)(1)–(2)).
1a. **OSHA 29 CFR 1910.37(a)(3) "Exit routes must be free and unobstructed. No materials or equipment may be placed, either permanently or temporarily, within the exit route."** Used in the blocked-exit "why" text.
   - Source: https://www.law.cornell.edu/cfr/text/29/1910.37 (Cornell LII, which reproduces the eCFR text) — accessed 2026-10-27, opened and read; the quoted sentence and paragraph number (a)(3) were checked in the page text. The OSHA page (https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.37) and eCFR both returned HTTP 403/406 to this agent, so the official pages themselves were NOT opened in this revision.
1b. **OSHA 29 CFR 1910.151(c) "Where the eyes or body of any person may be exposed to injurious corrosive materials, suitable facilities for quick drenching or flushing of the eyes and body shall be provided within the work area for immediate emergency use."** Used in the battery-bay/eyewash "why" text (battery electrolyte is corrosive).
   - Source: https://www.law.cornell.edu/cfr/text/29/1910.151 (Cornell LII) — accessed 2026-10-27, opened and read; paragraph (c) checked in the page text. Official OSHA/eCFR pages NOT opened (HTTP 403/406), as above.
   - These are US rules, quoted as background. The course is not a compliance course and does not claim to satisfy any regulation.
2. **NIOSH Hierarchy of Controls** — preferred order: Elimination → Substitution → Engineering controls → Administrative controls → PPE.
   - Source: https://www.cdc.gov/niosh/hierarchy-of-controls/about/index.html — accessed 2026-10-27, opened and read via WebFetch.

## Research base for the design (cited, not copied)

3. **Realistic details help or harm learning depending on task relevance and prior knowledge** — PMC study used by the shared standards: https://pmc.ncbi.nlm.nih.gov/articles/PMC11269326/ — NOT independently re-opened by this repo's build agent; cited through `../00-immersive-standards.md` section 2 (which requires verification before citing; the orchestrator's standards file records it as the shared evidence base). Status: cited via shared standards.
4. **Practice-based training transfer (practitioner summary)** — Devlin Peck, *The ROI of practice-based training*: https://www.devlinpeck.com/content/roi-of-practice-based-training — status: UNVERIFIED (page not opened by this build agent; labeled as a practitioner source in the plan). The design does not depend on any specific number from it; the plan's claim about practice-based formats is presented as the plan's rationale, not as a verified citation.

## Fictional content
- "Northwind Logistics" is a **fictional** company (see ai-literacy-program portfolio thread). All incident events, people, and statistics in the replay and scenarios are fictional, constructed for teaching purposes, and labeled as such in the app.
- Hazard catalog risk ratings (likelihood × severity 1–5 scales) are constructed for teaching, informed by the general structure of workplace risk matrices, not by any proprietary company data.
