# Art Bible — Hazard Hunt v2.0.0 ("Northwind Logistics, Bay 4, Night Shift")

## 1. Visual Direction & Mood

**Setting:** Northwind Logistics (fictional), Distribution Bay 4 during the night shift.
**Mood:** A living, working distribution centre with tall blue-and-orange pallet racking, cold high-bay LED fixtures cutting through faint warehouse dust, high-visibility vests and safety markings that pop against worn concrete, and continuous background logistics activity that yields safely when a person approaches.

Every learning cue (12 hazards, 4 controlled distractors, 3 neutral areas) remains the sharpest, most readable silhouette in its zone, while the surrounding bay feels inhabited and grounded.

---

## 2. Colour Palette & Cinematic Grade

| Swatch Role | Hex | Usage |
|---|---|---|
| **Safety Yellow** | `#FFD100` | Hi-vis vests, hardhats, cable ramps, floor aisle lines, HUD primary accent, hover outlines |
| **Hi-Vis Orange** | `#FF6A13` | Rack beams, machine guards, warning beacons, secondary HUD accent |
| **Concrete Slate** | `#8A8D8F` | Worn warehouse floor slab, structural columns, neutral industrial surfaces |
| **LED White** | `#E8F1F5` | High-bay overhead luminaires, skylight shafts, primary HUD text (`#F3F6F8`) |
| **Alarm Red** | `#D7263D` | Unsecured dock lock signal, lockout tags, fire safety equipment, critical alerts |
| **HUD Slate Surface** | `#12181F` | Floating HUD drawer (`rgba(18, 24, 31, 0.90)`), dialogs, in-world tooltips (≥ 12.5:1 contrast with `#F3F6F8`) |

### Grade & Atmosphere (`applyCaseGrade('hazard-hunt')`)
- **Tone mapping:** `THREE.AgXToneMapping` (fallback `ACESFilmicToneMapping`), exposure `1.16`.
- **Atmosphere:** Exponential height/distance fog (`#222C36`, density `0.014`) + procedural gradient sky dome (`#16202B` zenith → `#2B3947` horizon → `#1C2024` ground) so no unlit black void is ever visible.
- **Image-Based Lighting:** Poly Haven `empty_warehouse_01` (1K HDRI, CC0) used strictly for reflections and ambient fill (`environmentIntensity = 0.6`); all visible architecture within 30 m is real 3D geometry.
- **Anti-Greenscreen Grounding:** Every 3D prop, Poly Haven GLB asset, and character receives a radial contact shadow disc (`v2-contact-shadow`) and shadow-casting/receiving PBR materials.

---

## 3. Typography (`src/styles/case-fonts.css`)

All fonts are self-hosted WOFF2 subsets (`font-display: swap`) under SIL OFL 1.1:

| Role | CSS Variable | Typeface | Weight(s) | Usage |
|---|---|---|---|---|
| **Display** | `--font-display` | **Big Shoulders Stencil Display** | 700 | App header, module headings, industrial bay signage |
| **Body** | `--font-body` | **Barlow** | 400, 600, 700 | Course narrative, rating forms, controls ranking, dialogue choices, buttons |
| **In-World Accent** | `--font-accent` | **Share Tech Mono** | 400 | In-world hover tooltips, character callout badges, scanner/tablet telemetry, xAPI log view |

**Accessibility:** Clicking **Plain font** in the header sets `html[data-plain-font="on"]` (persisted in `localStorage`), switching all three roles to clean system sans-serif / monospace fallbacks.

---

## 4. Reference Board

References inform lighting, wear, and colour balance only; only license-verified CC0 assets are shipped:
- Poly Haven `empty_warehouse_01` HDRI reference shoots (Sergej Majboroda, CC0) — high-bay luminaire spacing and concrete specular roll-off: https://polyhaven.com/a/empty_warehouse_01
- OSHA Warehouse Safety & Powered Industrial Trucks visual guidance (Public Domain, US Dept. of Labor) — rack clearance, dock lock signals, aisle striping: https://www.osha.gov/warehousing
- NIOSH Hierarchy of Controls framework (Public Domain, CDC/NIOSH) — Elimination → Substitution → Engineering → Administrative → PPE: https://www.cdc.gov/niosh/hierarchy-of-controls/

---

## 5. Hero Viewpoints (`Warehouse.VIEWS`)

1. **`dock` — Receiving dock** (`[-3, 1.7, -6]`, yaw `0.15`, pitch `-0.12`): Frames the open dock door with red dock-lock signal (`hazard-unchocked-trailer`), glossy floor spill (`hazard-spill`), and shrink-wrapped pallet stack (`distractor-secured-stack`).
2. **`main` — Main floor** (`[-6, 1.7, 8]`, yaw `0.82`, pitch `-0.12`): Frames the walkway hose trip hazard (`hazard-trip-hose`) and central racking bays.
3. **`charging` — Charging area** (`[-20, 1.7, 15]`, yaw `0.8`, pitch `-0.3`): Frames the battery charger with frayed supply cable (`hazard-frayed-cable`), ramped cable protector (`distractor-ramped-cable`), and locked-out parked reach truck (`neutral-parked-truck`).
4. **`packing` — Packing station** (`[22, 1.7, 18]`, yaw `-0.785`, pitch `-0.1`): Frames the cutting machine bench with its guarded west side (`distractor-guarded-machine`), exposed east blade (`hazard-missing-guard`), and overhanging pallet (`hazard-overhang`).
5. **`aisleNorth` — Aisle, north end** (`[21, 1.7, -5]`, yaw `2.72`, pitch `0.08`): Hero poster shot looking down the main racking aisle toward the misaligned convex mirror (`hazard-misaligned-mirror`) and leaning carton stack (`hazard-leaning-stack`).
6. **`aisleSouth` — Aisle, west entrance looking east** (`[17, 1.7, 1]`, yaw `-1.57`, pitch `-0.1`): Frames the kinked blue upright (`hazard-damaged-upright`), clear aisle floor (`neutral-empty-aisle-end`), and blocked east fire exit (`hazard-blocked-exit`).
7. **`transfer` — Transfer zone (staging lane)** (`[2, 1.7, 7]`, yaw `3.14`, pitch `-0.12`): Frames the striped self-closing gate (`t-distractor-striped-gate`), straddle-loaded reach truck (`t-hazard-straddle-load`), and blocked battery-bay door / eyewash station (`t-hazard-charging-block`).

---

## 6. 3D Asset List & Sources

### Curated Poly Haven CC0 3D Models (`public/assets/models/`)
| Asset ID | File | Author | License | Scene Placement |
|---|---|---|---|---|
| `WetFloorSign_01` | `WetFloorSign_01-d4a94c3c.glb` | Fran Calvente | CC0 1.0 | Staged beside the north dock wall & safety station (away from the unguarded spill cue) |
| `cardboard_box_01` | `cardboard_box_01-34708497.glb` | Rahul Chaudhary | CC0 1.0 | Staging pallets and packing bench |
| `Barrel_01` | `Barrel_01-9611019b.glb` | Jorge Camacho | CC0 1.0 | Receiving dock chemical/supply bay |
| `wooden_crate_01` | `wooden_crate_01-1d3c029f.glb` | James Ray Cock | CC0 1.0 | Heavy freight bay along north-west rack row |
| `korean_fire_extinguisher_01` | `korean_fire_extinguisher_01-79e1e9ff.glb` | UM JOORIN | CC0 1.0 | Mounted by dock pillar and east fire exit |
| `hanging_industrial_lamp` | `hanging_industrial_lamp-c4f36443.glb` | Kuutti Siitonen | CC0 1.0 | Suspended along the high-bay ceiling truss |
| `tool_cart` | `tool_cart-4bc2c4e8.glb` | Savva Zakharov | CC0 1.0 | Maintenance bay beside battery charging station |
| `ladder_sectioned_01` | `ladder_sectioned_01-87f86eeb.glb` | MP | CC0 1.0 | Secured maintenance storage along west wall |

### Animated-Movie Stylized Characters (`src/v2/stylized-character.js`)
- **`worker-1` (Receiving Associate):** Articulated stylized character in safety-yellow hardhat and reflective hi-vis vest holding a clipboard at `[-14, 0, -6]`. Breathes, blinks, shifts posture, and tracks the learner's camera when nearby.
- **`worker-2` (Staging Associate):** Articulated stylized character in hardhat and hi-vis vest holding an inspection tablet at `[-8, 0, 15]`.
- **`supervisor-sam` (Shift Supervisor Sam):** Articulated character in white supervisor hardhat and hi-vis vest near the east exit / staging aisle (`[11, 0, -10]`), providing diegetic context for Module 5's speak-up scenario.
- **`replayPedestrian` (Incident Replay Actor):** Articulated character shown exclusively during Module 3's 3D incident replay (`[20, 0, -2.4]`), walking and gesturing as the reach truck approaches the blind corner.

---

## 7. Ambient Life Systems (`src/v2/ambient-life.js`)

1. **Volumetric Skylight & High-Bay Light Shafts:** Five translucent additive light cones descending from the high-bay fixtures (`[-20, 6.2, -14]`, `[0, 6.2, -14]`, `[-20, 6.2, 8]`, `[8, 6.2, 8]`, `[24, 6.2, 14]`) with gentle atmospheric shimmer.
2. **Floating Warehouse Dust Motes:** 220 soft-particle motes drifting lazily through the high-bay light volumes across the 60 m × 40 m floor.
3. **Patrolling Perimeter Utility Cart / Tug:** A background autonomous material-handling cart cruising a safe perimeter loop (`[-28, 0, -15]` → `[10, 0, -15]` → `[10, 0, -5]` → `[-28, 0, -5]`) with rotating wheels, a flashing amber safety beacon, and automatic proximity safety stop (`stopRadius: 4.0 m`) whenever the learner's camera approaches.
4. **Animated Packing-Line Conveyor Rollers:** A roller conveyor extension alongside the packing station (`x = 26, z = 16.2`) with continuously turning rollers and a reciprocating parcel tote.
5. **Living Characters:** Continuous chest breathing, natural periodic blinking (every 2.6–5.7 s), subtle weight shifts, and head/eye gaze tracking toward the learner.
6. **Calm Mode & Reduced Motion:** Opening any rating dialog (`#task-dialog`) or replay decision point engages `life.setCalmMode(true)` (slowing ambient motion to 30% and dimming particles so the learning task has zero visual competition). Enabling `prefers-reduced-motion` or the Settings reduced-motion toggle pauses all non-essential motion completely.

---

## 8. In-World Interaction & Full-Bleed HUD (`src/v2/in-world-interaction.js`)

- **Full-Bleed 3D Stage + Collapsible Floating Drawer:** The 3D warehouse canvas (`#app`) stays visible across all modules whenever WebGL2 is active, with `#textmode` styled as a floating, translucent industrial HUD drawer on the left that can be collapsed via the **Hide panel / Show panel** header button to expose 100% of the 3D bay.
- **Glowing Floor Viewpoint Rings:** Pulsing safety-yellow floor rings with floating octahedron beacons mark all 7 `Warehouse.VIEWS` stand points; clicking a ring smoothly glides the camera to that viewpoint.
- **Smooth Camera Glide + Free WASD/Arrow Walk:** Selecting a viewpoint button, POI item, or floor ring smoothly glides the camera (`glideTo`, cubic ease-in-out; instant cut when reduced motion is enabled or in unit tests). Learners can also look freely by dragging or using arrow keys/look-pad, and walk with `W/A/S/D` inside the bay bounds.
- **Hover Outlines & Projected Tooltips:** Hovering any active inspectable shows the high-contrast yellow 3D bounding box (`Warehouse.highlight`) plus a floating `--font-accent` tooltip naming the area.
