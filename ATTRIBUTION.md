# Attribution

Every third-party asset in this repo, plus what was made here. `public/attribution.json` is generated from this file by `scripts/build-attribution.mjs` (run as part of `npm run build`).

## Third-party assets

| Asset | Author | Source | License | Retrieved | Changes |
|---|---|---|---|---|---|
| Empty Warehouse 01 (HDRI, 1k .hdr) | Sergej Majboroda | https://polyhaven.com/a/empty_warehouse_01 | CC0 1.0 | 2026-10-27 | None. Used for image-based lighting and reflections only (not shown as a background). File renamed with a content hash. |
| Concrete Floor Worn 001 (1k JPG: color, normal GL, roughness) | Dimitrios Savva, Rico Cilliers | https://polyhaven.com/a/concrete_floor_worn_001 | CC0 1.0 | 2026-10-27 | None to pixels. Tiled across the floor; files renamed with content hashes. |
| Blue Metal Plate (1k JPG: normal GL, roughness) | Rob Tuytel | https://polyhaven.com/a/blue_metal_plate | CC0 1.0 | 2026-10-27 | Only the normal and roughness maps are used, on the painted rack uprights; the color map was not kept. Files renamed with content hashes. |
| Wood Planks Grey (1k JPG: color, normal GL, roughness) | Rob Tuytel | https://polyhaven.com/a/wood_planks_grey | CC0 1.0 | 2026-10-27 | None to pixels. Used on pallets; files renamed with content hashes. |
| Wet Floor Sign 01 (`WetFloorSign_01-d4a94c3c.glb`) | Fran Calvente | https://polyhaven.com/a/WetFloorSign_01 | CC0 1.0 | 2026-10-28 | Converted to self-contained GLB with resized JPEG textures for warehouse environment dressing. |
| Cardboard Box 01 (`cardboard_box_01-34708497.glb`) | Rahul Chaudhary | https://polyhaven.com/a/cardboard_box_01 | CC0 1.0 | 2026-10-28 | Converted to self-contained GLB with resized JPEG textures for warehouse environment dressing. |
| Barrel 01 (`Barrel_01-9611019b.glb`) | Jorge Camacho | https://polyhaven.com/a/Barrel_01 | CC0 1.0 | 2026-10-28 | Converted to self-contained GLB with resized JPEG textures for warehouse environment dressing. |
| Wooden Crate 01 (`wooden_crate_01-1d3c029f.glb`) | James Ray Cock | https://polyhaven.com/a/wooden_crate_01 | CC0 1.0 | 2026-10-28 | Converted to self-contained GLB with resized JPEG textures for warehouse environment dressing. |
| Korean Fire Extinguisher 01 (`korean_fire_extinguisher_01-79e1e9ff.glb`) | UM JOORIN | https://polyhaven.com/a/korean_fire_extinguisher_01 | CC0 1.0 | 2026-10-28 | Converted to self-contained GLB with resized JPEG textures for warehouse environment dressing. |
| Hanging Industrial Lamp (`hanging_industrial_lamp-c4f36443.glb`) | Kuutti Siitonen | https://polyhaven.com/a/hanging_industrial_lamp | CC0 1.0 | 2026-10-28 | Converted to self-contained GLB with resized JPEG textures for high-bay overhead lighting. |
| Tool Cart (`tool_cart-4bc2c4e8.glb`) | Savva Zakharov | https://polyhaven.com/a/tool_cart | CC0 1.0 | 2026-10-28 | Converted to self-contained GLB with resized JPEG textures for maintenance bay dressing. |
| Ladder Sectioned 01 (`ladder_sectioned_01-87f86eeb.glb`) | MP | https://polyhaven.com/a/ladder_sectioned_01 | CC0 1.0 | 2026-10-28 | Converted to self-contained GLB with resized JPEG textures for warehouse environment dressing. |
| Big Shoulders Stencil Display (Latin 700 WOFF2, via `@fontsource/big-shoulders-stencil-display`) | Patric King, XO Type Co | https://github.com/xotypeco/big_shoulders | SIL OFL 1.1 | 2026-10-28 | Self-hosted Latin WOFF2 subset for display headings. |
| Barlow (Latin 400/600/700 WOFF2, via `@fontsource/barlow`) | Jeremy Tribby | https://github.com/jpt/barlow | SIL OFL 1.1 | 2026-10-28 | Self-hosted Latin WOFF2 subset for body copy and controls. |
| Share Tech Mono (Latin 400 WOFF2, via `@fontsource/share-tech-mono`) | Carrois Apostrophe | https://fonts.google.com/specimen/Share+Tech+Mono | SIL OFL 1.1 | 2026-10-28 | Self-hosted Latin WOFF2 subset for in-world telemetry, tags, and tooltips. |
| three.js 0.186.1 | three.js authors | https://github.com/mrdoob/three.js | MIT | 2026-10-27 | None. Bundled by Vite. |

Poly Haven license: https://polyhaven.com/license (CC0, no attribution required; credited anyway).

## Made for this repo (repo license applies)

| Item | Notes | License |
|---|---|---|
| Warehouse kit: racking, pallets, boxes, dock doors, charging station, packing bench, floor markings, perimeter utility cart, conveyor rollers | Procedural three.js geometry with PBR materials | Code MIT |
| Hazard and distractor variants (spill sheen, frayed cable, bent upright, overhang, blocked exit, missing guard, leaning stack, misaligned mirror, cable ramp, wrapped stack, guarded machine) | Procedural geometry and materials | Code MIT |
| Animated-movie stylized worker & supervisor characters (`src/v2/stylized-character.js`) | Procedural articulated three.js hierarchy with hardhats, hi-vis vests, blinking, breathing, gaze tracking, and clipboard/tablet props | Code MIT |
| Ambient life, cinematic colour grade, and in-world interaction controllers (`src/v2/`) | Volumetric light shafts, warehouse dust motes, spline patrol mover with proximity safety stop, Calm Mode, smooth camera glide | Code MIT |
| Poster images (`poster-2.0.0.webp`, `.jpg`) | Rendered from the real v2.0.0 scene by `scripts/render-poster.mjs` | CC BY 4.0 |
| All course text, hazard catalog, replay story, controls, speak-up scenario, items | Fictional company and incident, constructed for teaching purposes | CC BY 4.0 |
