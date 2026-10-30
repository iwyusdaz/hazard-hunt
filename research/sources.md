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

## v3 object catalog sources (added 2026-10-31, stage S4)

Each source below was opened by the S4 build agent on 2026-10-31 and the quoted paragraph was found in the page text (Cornell LII pages fetched with a browser user agent; OSHA, EU-OSHA, FHWA and Wikipedia pages fetched directly; HSG76 downloaded as PDF and searched with `pdftotext`). `content/objects.json` cites only URLs from this file. The US rules are background, as above: the course claims no compliance.

5. **29 CFR 1910.22 Walking-working surfaces.** (a)(1) places of employment and passageways kept clean and orderly; (a)(3) surfaces kept free of hazards "such as sharp or protruding objects, loose boards, corrosion, leaks, spills, snow, and ice". Used for the spill, the hose and the cable ramp.
   - Source: https://www.law.cornell.edu/cfr/text/29/1910.22
6. **29 CFR 1910.26 Dockboards.** (b)(1) dockboards designed to stop transfer vehicles running off the edge; (c) portable dockboards secured in place. Used for the dock leveller.
   - Source: https://www.law.cornell.edu/cfr/text/29/1910.26
7. **29 CFR 1910.36 Design and construction requirements for exit routes.** (d)(1) an exit route door opens from the inside at all times without keys, tools or special knowledge; a panic bar that locks only from the outside is permitted. Used for the fire-exit door.
   - Source: https://www.law.cornell.edu/cfr/text/29/1910.36
8. **29 CFR 1910.37(b)(2).** Each exit must be clearly visible and marked by a sign reading "Exit". Used for the exit sign (1910.37(a)(3) is already entry 1a).
   - Source: https://www.law.cornell.edu/cfr/text/29/1910.37
9. **29 CFR 1910.132(a) Personal protective equipment.** PPE shall be provided, used and maintained wherever hazards make it necessary. Used for the PPE station.
   - Source: https://www.law.cornell.edu/cfr/text/29/1910.132
10. **29 CFR 1910.151(b).** Adequate first aid supplies shall be readily available. Used for the first-aid kit (1910.151(c) is entry 1b).
    - Source: https://www.law.cornell.edu/cfr/text/29/1910.151
11. **29 CFR 1910.157(c)(1) Portable fire extinguishers.** Extinguishers are mounted, located and identified so that they are readily accessible. Used for the extinguisher.
    - Source: https://www.law.cornell.edu/cfr/text/29/1910.157
12. **29 CFR 1910.176 Handling materials, general.** (a) safe clearances for aisles and at loading docks; aisles kept clear; permanent aisles "appropriately marked"; (b) material stored in tiers "stacked, blocked, interlocked and limited in height so that they are stable and secure against sliding or collapse"; (c) storage areas kept free of tripping hazards. Used for floor markings, wrapped, leaning and overhanging loads.
    - Source: https://www.law.cornell.edu/cfr/text/29/1910.176
13. **29 CFR 1910.178, further paragraphs checked in the Cornell LII text** (entry 1 covers (g)(1)–(2), (l)(3)(ii)(D), (m)(14), (q)(7)): (g)(10) smoking prohibited in the charging area; (h)(2) auxiliary lighting on the truck where general lighting is under 2 lumens per square foot; (k)(1) highway-truck brakes set and wheel chocks placed before trucks are boarded by powered industrial trucks (this resolves DECISIONS #12: the paragraph is now verified); (l)(3)(i)(C) training covers truck controls and instrumentation; (m)(5)(i) an unattended truck has forks fully lowered, controls neutral, power off and brakes set; (n)(4) drivers slow down and sound the horn where vision is obstructed; (o)(1) only stable or safely arranged loads are handled.
    - Source: https://www.law.cornell.edu/cfr/text/29/1910.178
14. **29 CFR 1910.212(a)(1) Machine guarding.** Guarding protects operators and others from point-of-operation hazards, ingoing nip points and rotating parts. Used for the cutting machine and the conveyor.
    - Source: https://www.law.cornell.edu/cfr/text/29/1910.212
15. **29 CFR 1926.555(a)(1)–(3) Conveyors** (a construction-industry rule, quoted only as background on how conveyor stops work): means for stopping at the operator's station; emergency stop switches arranged so the conveyor cannot restart until the switch is reset.
    - Source: https://www.law.cornell.edu/cfr/text/29/1926.555
16. **HSE, *Warehousing and storage: A guide to health and safety* (HSG76, 2007).** Free PDF, opened and searched. Paragraphs used: 200 (lighting in working and access areas); 262 (clean up spillages immediately); 426 (a hand pallet truck gets a safety inspection at least every 12 months); 501–502 (separate pedestrians and vehicles; barriers and kerbs, clear walkways, crossing points); 476–478 (roller conveyor drawing-in hazards and guards); 507 (pedestrian safeguards, including high-visibility clothing); 509 (avoid blind corners; where unavoidable, warning signs and suitably placed mirrors); 530–531 (dock levellers and their hazards); 543 (vehicle restraints, interlocks, key custody and traffic lights at docks; the outside convention is green to move, red to stay); 612–613 (pallet load patterns; stretch wrapping gives greater security); 639 (protect racking likely to be struck, with column guards in a conspicuous colour); 641–643 (any damage reduces load capacity; report damage immediately; regular inspections); 634 (racking carries a clear notice of its maximum load; Figure 48 shows an example).
    - Source: https://www.hse.gov.uk/pubns/priced/hsg76.pdf (catalogue page https://www.hse.gov.uk/pubns/books/hsg76.htm). UK guidance, background only.
17. **EU-OSHA vehicle safety e-guide, "Blue safety spotlight".** A light on a forklift roof projects a blue spot on the floor in the direction of travel to warn pedestrians; described as especially effective in noisy places. Used for the forklift's blue spot.
    - Source: https://eguides.osha.europa.eu/vehicle-safety/good-practices/blue-safety-spotlight
18. **OSHA eTool, Powered Industrial Trucks: Pedestrian traffic.** Separate forklift traffic from pedestrians where possible; warn pedestrians by horn, hand signal or warning light. Advisory, not a standard.
    - Source: https://osha.gov/etools/powered-industrial-trucks/workplace/pedestrian-traffic
19. **Pallet (Wikipedia).** The GMA pallet is 48 × 40 × 6 in (1,219 × 1,016 × 152 mm), the most common size in North America. Used for the pallet's real size.
    - Source: https://en.wikipedia.org/wiki/Pallet
20. **FHWA, Federal Size Regulations for Commercial Motor Vehicles.** States must allow semitrailers of at least 48 ft (14.63 m); semitrailers up to 53 ft run without a permit in many states. Used for the trailer's real size (the model is a 53 ft box trailer).
    - Source: https://ops.fhwa.dot.gov/freight/publications/size_regs_final_rpt/index.htm

## Research base for the design (cited, not copied)

3. **Realistic details help or harm learning depending on task relevance and prior knowledge** — PMC study used by the shared standards: https://pmc.ncbi.nlm.nih.gov/articles/PMC11269326/ — NOT independently re-opened by this repo's build agent; cited through `../00-immersive-standards.md` section 2 (which requires verification before citing; the orchestrator's standards file records it as the shared evidence base). Status: cited via shared standards.
4. **Practice-based training transfer (practitioner summary)** — Devlin Peck, *The ROI of practice-based training*: https://www.devlinpeck.com/content/roi-of-practice-based-training — status: UNVERIFIED (page not opened by this build agent; labeled as a practitioner source in the plan). The design does not depend on any specific number from it; the plan's claim about practice-based formats is presented as the plan's rationale, not as a verified citation.

## Fictional content
- "Northwind Logistics" is a **fictional** company (see ai-literacy-program portfolio thread). All incident events, people, and statistics in the replay and scenarios are fictional, constructed for teaching purposes, and labeled as such in the app.
- Hazard catalog risk ratings (likelihood × severity 1–5 scales) are constructed for teaching, informed by the general structure of workplace risk matrices, not by any proprietary company data.
