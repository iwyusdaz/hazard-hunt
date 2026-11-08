/**
 * layout.js — the floor plan of Northwind Logistics Bay 4 (fictional), v3.
 * 1 unit = 1 m, y up. The bay is 48 m (x) by 32 m (z), 10 m to the roof.
 * North wall (z = -16): three dock doors. West wall: charging area.
 * Centre: main walkway (east-west) and the truck route. East: the racking
 * block (two rows with an east-west aisle), the packing station and the
 * east fire exit. South-west: the outbound staging lane, the bay entrance
 * and the safety wall.
 * Pure data and maths (no three.js), so unit tests can read it.
 * @module hazard/layout
 */

export const BAY = { minX: -24, maxX: 24, minZ: -16, maxZ: 16, height: 10 };

/** A rig view from an eye point and a look-at point ({ target, radius, theta, phi }). */
export function look(eye, target) {
  const dx = eye[0] - target[0], dy = eye[1] - target[1], dz = eye[2] - target[2];
  const r = Math.hypot(dx, dy, dz);
  return { target: [...target], radius: r, theta: Math.atan2(dx, dz), phi: Math.acos(dy / r) };
}

// ---------- dock (north wall) ----------
export const DOCK_DOORS = [
  { n: 1, x: -16, trailer: true, restrained: true, signal: 'green', open: true },
  { n: 2, x: -9, trailer: true, restrained: false, signal: 'red', open: true },
  // Door 3 closes between pallet runs (motion system "dock-door-3").
  { n: 3, x: -2, trailer: true, restrained: true, signal: 'green', open: false },
];
export const DOCK_FLOOR_Y = 0;
export const YARD_Y = -1.22;

// ---------- floor markings ----------
/** Main pedestrian walkway, east-west (the floor-markings object: 30 m by 1.2 m). */
export const WALKWAY_MAIN = { x0: -20, x1: 10, z0: -4.5, z1: -3.3 };
/** Walkway from the main walkway south to the bay entrance (crosses the staging lane). */
export const WALKWAY_SOUTH = { x0: -9.6, x1: -8.4, z0: -3.3, z1: 15.9 };
/** Walkway along the south wall of the staging lane (t-neutral-clear-line: 10 m by 1.2 m). */
export const WALKWAY_STAGING = { x0: -21, x1: -11, z0: 14.0, z1: 15.2 };
/** Truck route (white arrows): the north lane, the cross-aisle and the return lane. */
export const TRUCK_LANE_N = { x0: -21, x1: 4, z: -7.2 };
export const CROSS_AISLE_X = 2.6;
export const TRUCK_LANE_S = { z: -0.9 };
/** Hatched keep-clear areas where trucks cross the walkway. */
export const CROSSINGS = [{ x: -17.5, z: -3.9 }, { x: 2.6, z: -3.9 }];

// ---------- racking block ----------
export const RACK = {
  x0: 4, bay: 2.7, bays: 6, depth: 1.124,
  northZ: 1.61, southZ: 6.39, // row centre lines; the aisle runs between them
  beams: [1.75, 3.5],          // beam tops (m)
  frameHeight: 6,
};
export const AISLE = { x0: 4, x1: 4 + 2.7 * 6, z0: RACK.northZ + RACK.depth / 2, z1: RACK.southZ - RACK.depth / 2 };
/** Single storage row along the north wall, east of the dock. */
export const RACK_NORTH_WALL = { x0: 9.2, bays: 5, z: -15.3 };

// ---------- zones and stations ----------
export const SPOTS = {
  spill: [-10.2, 0, -10.6],
  tallStack: [-4.4, 0, -12.6],
  receivingPallets: [[-14.2, -12.6], [-12.8, -12.6], [-14.2, -11.2]],
  receivingWorker: [-13.4, 0, -11.0],
  hose: [-4.2, 0, -3.9],
  graceDesk: [7.0, 0, -14.3],
  grace: [5.4, 0, -13.2],
  charger: { z: -1.4 },
  frayedCable: [-23.15, 0.02, -0.55],
  cableRamp: [-21.6, 0, 1.6],
  reachTruck: [-21.3, 0, -3.4],
  eyewash: { z: 3.2 },
  mirror: [3.9, 0, 0.55],
  overhangBay: 2, // north row, bay index (0 = west)
  leaningBay: 3, // south row, top beam
  exitDoor: { z: 4.0 },
  exitPallets: [[22.75, 3.35], [22.75, 4.75]],
  packingBench: [18.6, 0, 12.0],
  conveyor: { x0: 4.6, z: 10.3, sections: 4 },
  estop: [16.4, 0, 10.3],
  straddleTruck: [-8.95, 0, 10.0],
  gate: [-9.0, 0, 7.6],
  batteryDoor: { z: 11.6 },
  batteryCart: [-22.9, 0, 11.6],
  stagingPallets: [[-20.4, 12.4], [-19.0, 12.4], [-17.6, 12.4], [-16.2, 12.4], [-6.6, 12.6], [-5.2, 12.6], [-3.8, 12.6], [-6.6, 11.2]],
  entranceDoor: { x: -9.0 },
  ppe: { x: -6.2 },
  firstAid: { x: -4.4 },
  extinguishers: [{ wall: 'S', u: -3.3 }, { wall: 'E', u: 7.2 }],
  bollards: [[-10.1, 7.6], [-7.9, 7.6], [0.9, -4.75], [4.3, -4.75], [0.9, -3.05], [4.3, -3.05]],
};

/** High-bay lights: a 4 x 4 grid; one over the far aisle flickers (failing driver). */
export const LIGHTS = (() => {
  const out = [];
  for (const x of [-17, -6, 5, 16]) for (const z of [-11, -3.5, 4, 11.5]) out.push({ x, z, y: 8.6, failing: x === 16 && z === 4 });
  return out;
})();
export const ROOF_LIGHTS = [{ x: -11.5, z: -2, w: 3, d: 14 }, { x: 10.5, z: -2, w: 3, d: 14 }];

// ---------- forklift route (loop, metres; speed in m/s) ----------
export const FORKLIFT_ROUTE = {
  points: [[-17.5, -7.2], [-9, -7.2], [2.6, -7.2], [2.6, -0.9], [-9, -0.9], [-17.5, -0.9]],
  speed: 2.2, // 7.9 km/h, a walking-pace site limit
  stopAt: 1, // pauses at dock door 2's lane, as if waiting for the restraint
  stopSeconds: 5,
};

// ---------- views ----------
export const VIEWS = {
  home: look([-15.5, 4.2, 13.8], [-2, 1.2, -4]),
  overview: look([-17.5, 5.2, 12.5], [-2, 1.0, -5]),
  dock: look([-6.5, 2.6, -2.2], [-9.5, 1.0, -12.5]),
  charging: look([-14.5, 2.4, 4.8], [-22, 0.9, -1]),
  practice: look([-4.5, 3.6, 3.5], [-13, 0.8, -7.5]),
  aisleWest: look([-1.2, 2.3, 6.8], [9, 1.6, 3.4]),
  aisleEast: look([22, 2.4, 9.2], [13.5, 1.8, 3.8]),
  packing: look([13.4, 2.4, 15.2], [18.2, 0.9, 11.4]),
  // Down the racking aisle from its west end (a view across the rows would sit inside the racks).
  assessed: look([0.5, 3.2, 5.6], [12, 1.2, 4.4]),
  // Aimed at the near side of the parked truck. G2: the old target (-12.5, 0.8, 12) lay
  // behind the truck, so the rig's collision pull-in put the camera past the truck and the
  // gate, and the transfer hunt showed an empty floor (straddle load and gate unclickable).
  staging: look([-1.2, 3.2, 4.6], [-8.6, 0.8, 9.0]),
  safetyWall: look([-5.5, 1.9, 8.8], [-5.2, 1.2, 15.6]),
  // Grace at her desk, the working floor and the dock behind her.
  grace: look([9.4, 1.75, -10.6], [5.0, 1.2, -13.0]),
  replay: look([-1.6, 2.4, 9.4], [8.5, 1.1, 3.6]),
  // Close views a learner walks to (ui-audit exploration states).
  dockClose: look([-7.0, 1.7, -10.6], [-8.6, 1.0, -15.4]),
  chargingClose: look([-19.4, 1.6, 0.9], [-23.4, 0.7, 0.6]),
  receiving: look([-11.0, 2.0, -7.6], [-15.4, 0.6, -11.6]),
  benchClose: look([16.0, 1.8, 13.6], [18.4, 0.9, 11.0]),
  exitClose: look([18.6, 1.8, 6.4], [23.6, 1.3, 4.0]),
};

export const BOUNDS = [BAY.minX + 1, BAY.maxX - 1, BAY.minZ + 1, BAY.maxZ - 1];
