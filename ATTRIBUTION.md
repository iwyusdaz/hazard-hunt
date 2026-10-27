# Attribution

Every third-party asset in this repo, plus what was made here. `public/attribution.json` is generated from this file by `scripts/build-attribution.mjs` (run as part of `npm run build`).

## Third-party assets

| Asset | Author | Source | License | Retrieved | Changes |
|---|---|---|---|---|---|
| Empty Warehouse 01 (HDRI, 1k .hdr) | Sergej Majboroda | https://polyhaven.com/a/empty_warehouse_01 | CC0 | 2026-10-27 | None. Used for image-based lighting and reflections only (not shown as a background). File renamed with a content hash. |
| Concrete Floor Worn 001 (1k JPG: color, normal GL, roughness) | Dimitrios Savva, Rico Cilliers | https://polyhaven.com/a/concrete_floor_worn_001 | CC0 | 2026-10-27 | None to pixels. Tiled across the floor; files renamed with content hashes. |
| Blue Metal Plate (1k JPG: normal GL, roughness) | Rob Tuytel | https://polyhaven.com/a/blue_metal_plate | CC0 | 2026-10-27 | Only the normal and roughness maps are used, on the painted rack uprights; the color map was not kept. Files renamed with content hashes. |
| Wood Planks Grey (1k JPG: color, normal GL, roughness) | Rob Tuytel | https://polyhaven.com/a/wood_planks_grey | CC0 | 2026-10-27 | None to pixels. Used on pallets; files renamed with content hashes. |
| three.js 0.186.1 | three.js authors | https://github.com/mrdoob/three.js | MIT | 2026-10-27 | None. Bundled by Vite. No Draco/Basis decoders are shipped because this project loads no compressed models or textures. |

Poly Haven license: https://polyhaven.com/license (CC0, no attribution required; credited anyway).

## Made for this repo (repo license applies)

| Item | Notes | License |
|---|---|---|
| Warehouse kit: racking, pallets, boxes, dock doors, charging station, packing bench, floor markings | Procedural three.js geometry with PBR materials | Code MIT |
| Hazard and distractor variants (spill sheen, frayed cable, bent upright, overhang, blocked exit, missing guard, leaning stack, misaligned mirror, cable ramp, wrapped stack, guarded machine) | Procedural geometry and materials | Code MIT |
| Worker figures | Low-detail procedural hi-vis silhouettes with no faces (MakeHuman was not used; see DECISIONS.md) | Code MIT |
| Reach truck | Procedural, medium detail | Code MIT |
| Poster images (`poster-1.0.0.webp`, `.jpg`) | Rendered from the real scene by `scripts/render-poster.mjs` | CC BY 4.0 |
| All course text, hazard catalog, replay story, controls, speak-up scenario, items | Fictional company and incident, constructed for teaching purposes | CC BY 4.0 |
