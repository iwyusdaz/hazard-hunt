/**
 * make-decals.mjs — draw the in-world signs, labels and floor decals for v3 (own work,
 * ImageMagick only). Writes PNGs to data/raw/decals/ plus meta.json (real-world size in
 * metres for each sign, so the app can place them at true scale); process-assets.mjs then
 * encodes them to KTX2 in public/assets/v3/decals/.
 *
 *   node scripts/fetch-assets.mjs --only fonts && node scripts/make-decals.mjs
 *
 * All wording, company names, addresses, ratings and barcodes are fictional. Sign layouts
 * are own designs in the spirit of common safety signs; they are not copies of any
 * standard's artwork. Fonts: Barlow Condensed Bold and Inter (SIL OFL 1.1), baked in.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'data', 'raw', 'decals');
const FONT = join(root, 'data', 'raw', 'fonts', 'barlow-condensed-700.ttf');
const SMALL = join(root, 'data', 'raw', 'fonts', 'inter-600.ttf');
if (!existsSync(FONT) || !existsSync(SMALL)) { console.error('Fonts missing: run node scripts/fetch-assets.mjs --only fonts'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const meta = {};
const m = (args) => execFileSync('magick', args, { stdio: ['ignore', 'ignore', 'inherit'] });

/** Seeded PRNG so re-runs give identical files. */
let seed = 4;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/**
 * Each text line is fitted into its own box with `caption:` (ImageMagick picks the largest
 * point size that fits), so long words never overflow the sign. Box: x, y, w, h as fractions
 * of the sign; size caps the point size as a fraction of the sign height.
 */
function sign(id, { w, h, px = 1024, bg, fg = 'white', border = null, lines, icon = null, label, sizeM, use }) {
  const H = Math.round((px * h) / w);
  const file = join(OUT, `${id}.png`);
  const args = ['-size', `${px}x${H}`, `xc:${bg}`];
  if (border) args.push('-fill', 'none', '-stroke', border, '-strokewidth', String(Math.round(Math.min(px, H) * 0.04)), '-draw', `roundrectangle ${px * 0.025},${px * 0.025} ${px * 0.975},${H - px * 0.025} ${px * 0.03},${px * 0.03}`);
  if (icon) args.push(...icon(px, H));
  args.push('-stroke', 'none');
  for (const l of lines) {
    const bw = Math.round((l.w ?? 0.86) * px), bh = Math.round(l.h * H);
    const x = Math.round((l.x ?? (1 - (l.w ?? 0.86)) / 2) * px), y = Math.round(l.y * H);
    args.push('(', '-background', 'none', '-fill', fg, '-font', l.small ? SMALL : FONT, '-size', `${bw}x${bh}`, '-gravity', l.align || 'center',
      ...(l.size ? ['-pointsize', String(Math.round(l.size * H))] : []), `caption:${l.text}`, ')', '-gravity', 'northwest', '-geometry', `+${x}+${y}`, '-compose', 'over', '-composite');
  }
  // Light wear: soft noise multiplied in so signs are not flat vector panels.
  args.push('(', '-size', `${px}x${H}`, 'xc:gray95', '+noise', 'Gaussian', '-attenuate', '0.25', '-blur', '0x1', ')', '-compose', 'multiply', '-composite');
  args.push(file);
  m(args);
  meta[id] = { label, sizeM, use, kind: 'color', maxSize: px, honesty: 'fictional wording and layout (own design)' };
}
/** Wear an alpha decal: knock random specks out of its alpha (paint and rubber wear). */
function wearAlpha(file, keep = '72%', blur = 2, soft = false) {
  const [w, h] = execFileSync('magick', ['identify', '-format', '%w %h', file]).toString().split(' ');
  const mask = soft ? ['-level', '30%,70%'] : ['-threshold', `${100 - parseFloat(keep)}%`];
  m([file, '(', '+clone', '-alpha', 'extract', '(', '-size', `${w}x${h}`, 'xc:white', '+noise', 'Random', '-colorspace', 'gray', '-blur', `0x${blur}`, ...mask, ')', '-compose', 'multiply', '-composite', ')', '-alpha', 'off', '-compose', 'copyopacity', '-composite', file]);
}
/** Diagonal stripes, tileable when the period divides both sides. */
const stripes = (w, h, period, a, b) => ['-size', `${w}x${h}`, 'xc:black', '-fx', `mod(i+j,${period})<${period / 2} ? ${a} : ${b}`];

// ---------- Safety signs ----------
sign('sign-exit', { w: 0.36, h: 0.18, px: 512, bg: '#F4F1EA', fg: '#C8102E', border: '#C8102E', label: 'EXIT sign', sizeM: [0.36, 0.18], use: 'Lit exit sign over the east fire-exit door',
  icon: (W, H) => ['-fill', '#C8102E', '-draw', `polygon ${W * 0.76},${H * 0.36} ${W * 0.84},${H * 0.36} ${W * 0.84},${H * 0.24} ${W * 0.93},${H * 0.5} ${W * 0.84},${H * 0.76} ${W * 0.84},${H * 0.64} ${W * 0.76},${H * 0.64}`],
  lines: [{ text: 'EXIT', x: 0.1, w: 0.62, y: 0.16, h: 0.68 }] });
sign('sign-fire-extinguisher', { w: 0.2, h: 0.3, px: 512, bg: '#C8102E', label: 'Fire extinguisher sign', sizeM: [0.2, 0.3], use: 'Above each extinguisher bracket',
  icon: (W, H) => ['-fill', 'white', '-draw', `roundrectangle ${W * 0.38},${H * 0.2} ${W * 0.62},${H * 0.6} ${W * 0.08},${W * 0.08}`, '-draw', `rectangle ${W * 0.45},${H * 0.12} ${W * 0.55},${H * 0.2}`, '-draw', `rectangle ${W * 0.55},${H * 0.13} ${W * 0.72},${H * 0.16}`],
  lines: [{ text: 'FIRE', y: 0.65, h: 0.13 }, { text: 'EXTINGUISHER', y: 0.79, h: 0.12 }] });
sign('sign-first-aid', { w: 0.3, h: 0.3, px: 512, bg: '#00843D', label: 'First aid sign', sizeM: [0.3, 0.3], use: 'Above the first-aid kit',
  icon: (W, H) => ['-fill', 'white', '-draw', `rectangle ${W * 0.42},${H * 0.1} ${W * 0.58},${H * 0.58}`, '-draw', `rectangle ${W * 0.26},${H * 0.26} ${W * 0.74},${H * 0.42}`],
  lines: [{ text: 'FIRST AID', y: 0.68, h: 0.2 }] });
sign('sign-eyewash', { w: 0.3, h: 0.3, px: 512, bg: '#00843D', label: 'Emergency eyewash sign', sizeM: [0.3, 0.3], use: 'Above the eyewash station',
  icon: (W, H) => ['-fill', 'none', '-stroke', 'white', '-strokewidth', String(W * 0.035), '-draw', `ellipse ${W * 0.5},${H * 0.3} ${W * 0.28},${H * 0.13} 0,360`, '-fill', 'white', '-stroke', 'none', '-draw', `circle ${W * 0.5},${H * 0.3} ${W * 0.5},${H * 0.22}`, '-fill', '#7FD3F7', '-draw', `circle ${W * 0.38},${H * 0.53} ${W * 0.38},${H * 0.49}`, '-draw', `circle ${W * 0.62},${H * 0.53} ${W * 0.62},${H * 0.49}`],
  lines: [{ text: 'EMERGENCY', y: 0.62, h: 0.14 }, { text: 'EYEWASH', y: 0.77, h: 0.16 }] });
sign('sign-ppe', { w: 0.6, h: 0.4, px: 1024, bg: '#005EB8', label: 'PPE required sign', sizeM: [0.6, 0.4], use: 'PPE station at the bay entrance',
  lines: [{ text: 'PPE REQUIRED', y: 0.08, h: 0.3 }, { text: 'BEYOND THIS POINT', y: 0.4, h: 0.16 }, { text: 'Hi-vis vest · Safety shoes · Gloves when handling', small: true, y: 0.72, h: 0.12 }] });
sign('sign-forklift-route', { w: 0.6, h: 0.4, px: 1024, bg: '#FFD100', fg: '#111111', border: '#111111', label: 'Forklift route warning sign', sizeM: [0.6, 0.4], use: 'Ends of the truck route and the staging lane',
  lines: [{ text: 'CAUTION', y: 0.1, h: 0.3 }, { text: 'FORKLIFT ROUTE', y: 0.42, h: 0.2 }, { text: 'Pedestrians use the marked walkway', small: true, y: 0.7, h: 0.12 }] });
sign('sign-battery-charging', { w: 0.6, h: 0.4, px: 1024, bg: '#FFD100', fg: '#111111', border: '#111111', label: 'Battery charging area sign', sizeM: [0.6, 0.4], use: 'Wall above the battery charger',
  lines: [{ text: 'BATTERY CHARGING', y: 0.1, h: 0.26 }, { text: 'No smoking or open flames', small: true, y: 0.44, h: 0.13 }, { text: 'Eye protection required · Eyewash on the left', small: true, y: 0.66, h: 0.12 }] });
sign('sign-rack-load', { w: 0.4, h: 0.3, px: 1024, bg: '#F7F7F2', fg: '#111111', border: '#FF6A13', label: 'Rack load-rating sign', sizeM: [0.4, 0.3], use: 'End of each rack row (figures fictional)',
  lines: [{ text: 'RACK LOAD RATING', y: 0.09, h: 0.17 }, { text: 'Max per level   1,000 kg', small: true, y: 0.33, h: 0.13 }, { text: 'Max per bay   4,000 kg', small: true, y: 0.5, h: 0.13 }, { text: 'Report any damage to the shift supervisor', small: true, y: 0.73, h: 0.1 }] });
sign('sign-estop', { w: 0.12, h: 0.05, px: 512, bg: '#FFD100', fg: '#111111', label: 'Emergency stop label', sizeM: [0.12, 0.05], use: 'Label under the conveyor stop button',
  lines: [{ text: 'EMERGENCY STOP', y: 0.15, h: 0.7 }] });
sign('sign-bay4', { w: 2.4, h: 0.6, px: 2048, bg: '#12181F', fg: '#F3F6F8', label: 'Bay 4 wall sign', sizeM: [2.4, 0.6], use: 'High on the north wall',
  icon: (W, H) => ['-fill', '#FF6A13', '-draw', `rectangle 0,${H * 0.86} ${W},${H}`],
  lines: [{ text: 'NORTHWIND LOGISTICS', align: 'west', x: 0.04, w: 0.6, y: 0.1, h: 0.26 }, { text: 'DISTRIBUTION BAY 4', align: 'west', x: 0.04, w: 0.8, y: 0.38, h: 0.42 }] });
for (const n of [1, 2, 3]) {
  sign(`sign-dock-${n}`, { w: 0.6, h: 0.6, px: 512, bg: '#FFD100', fg: '#111111', label: `Dock ${n} number`, sizeM: [0.6, 0.6], use: `Above dock door ${n}`,
    lines: [{ text: 'DOCK', y: 0.06, h: 0.22 }, { text: String(n), y: 0.3, h: 0.64 }] });
}
sign('sign-fire-door', { w: 0.4, h: 0.2, px: 1024, bg: '#00843D', label: 'Fire exit keep clear sign', sizeM: [0.4, 0.2], use: 'On the fire-exit door leaf',
  lines: [{ text: 'FIRE EXIT', y: 0.1, h: 0.46 }, { text: 'KEEP CLEAR', y: 0.6, h: 0.3 }] });
sign('sign-grace-desk', { w: 0.5, h: 0.12, px: 1024, bg: '#12181F', fg: '#F3F6F8', label: 'Shift supervisor desk sign', sizeM: [0.5, 0.12], use: 'Front of the supervisor desk',
  lines: [{ text: 'SHIFT SUPERVISOR', y: 0.18, h: 0.64 }] });

// ---------- Carton shipping labels (fictional) ----------
for (const n of [1, 2, 3]) {
  const id = `label-carton-${n}`;
  const W = 512, H = 768;
  const bars = [];
  let x = 40;
  while (x < W - 40) { const bw = 2 + Math.floor(rnd() * 6); if (rnd() > 0.4) bars.push(`rectangle ${x},${H - 230} ${x + bw},${H - 110}`); x += bw + 2 + Math.floor(rnd() * 4); }
  const dest = [['HARBOUR CITY DC', 'Unit 7, Quay Road'], ['WESTFIELD STORE 112', '40 Market Lane'], ['NORTH RIDGE DEPOT', 'Gate C, Mill Street']][n - 1];
  m(['-size', `${W}x${H}`, 'xc:#FBFAF6', '-fill', '#111', '-draw', `rectangle 0,0 ${W},92`,
    '-font', FONT, '-fill', '#FBFAF6', '-pointsize', '56', '-gravity', 'northwest', '-annotate', '+28+14', 'NORTHWIND',
    '-fill', '#111', '-font', SMALL, '-pointsize', '26', '-annotate', '+28+120', 'SHIP TO', '-font', FONT, '-pointsize', '58', '-annotate', '+28+152', dest[0],
    '-font', SMALL, '-pointsize', '28', '-annotate', '+28+228', dest[1], '-annotate', '+28+300', `PO 48-${1200 + n * 37}   WT ${[12, 18, 7][n - 1]} kg`,
    '-annotate', '+28+345', `CARTON ${n} OF 4`, '-stroke', '#111', '-strokewidth', '3', '-draw', `line 20,400 ${W - 20},400`, '-stroke', 'none',
    '-draw', bars.join(' '), '-font', SMALL, '-pointsize', '24', '-gravity', 'south', '-annotate', '+0+70', `(00) 3 0${n}12 4400 ${5100 + n * 913} 2`,
    '(', '-size', `${W}x${H}`, 'xc:gray96', '+noise', 'Gaussian', '-attenuate', '0.3', '-blur', '0x0.8', ')', '-compose', 'multiply', '-composite', join(OUT, `${id}.png`)]);
  meta[id] = { label: `Carton shipping label ${n}`, sizeM: [0.1, 0.15], use: 'Shipping labels on cartons', kind: 'color', maxSize: 512, honesty: 'fictional company, address and barcode' };
}
// Handling marks printed on cartons: this-way-up arrows and keep-dry umbrella-free text mark.
m(['-size', '512x256', 'xc:none', '-fill', '#2A1A0E', '-stroke', 'none',
  '-draw', 'polygon 96,40 156,110 120,110 120,200 72,200 72,110 36,110', '-draw', 'polygon 236,40 296,110 260,110 260,200 212,200 212,110 176,110',
  '-draw', 'rectangle 30,214 302,226', '-font', FONT, '-pointsize', '64', '-gravity', 'east', '-annotate', '+30-20', 'THIS', '-annotate', '+30+44', 'WAY UP', join(OUT, 'mark-this-way-up.png')]);
meta['mark-this-way-up'] = { label: 'This way up handling mark', sizeM: [0.2, 0.1], use: 'Printed on carton sides (alpha)', kind: 'color', maxSize: 512, honesty: 'own design of a common handling mark' };

// ---------- Floor decals (alpha) ----------
// Tyre marks: overlapping dark rubber streaks along gentle curves.
{
  const W = 2048, H = 512, d = [];
  for (let k = 0; k < 14; k++) {
    const y0 = 140 + rnd() * 240, amp = 30 + rnd() * 60, ph = rnd() * 6.28, wdt = 12 + rnd() * 16, a = (0.05 + rnd() * 0.12).toFixed(3);
    const pts = [];
    for (let x = 0; x <= W; x += 64) pts.push(`${x},${(y0 + amp * Math.sin(x / 520 + ph)).toFixed(1)}`);
    d.push('-stroke', `rgba(18,16,14,${a})`, '-strokewidth', String(wdt.toFixed(1)), '-fill', 'none', '-draw', `polyline ${pts.join(' ')}`);
  }
  m(['-size', `${W}x${H}`, 'xc:none', ...d, '-blur', '0x2', '(', '+clone', '-alpha', 'extract', '(', '-size', `${W}x${H}`, 'xc:gray', '+noise', 'Random', '-blur', '0x1.2', ')', '-compose', 'multiply', '-composite', ')', '-compose', 'copyopacity', '-composite', join(OUT, 'floor-tyre-marks.png')]);
  meta['floor-tyre-marks'] = { label: 'Tyre marks', sizeM: [8, 2], use: 'Truck routes and the turn at the aisle ends (alpha decal)', kind: 'color', maxSize: 2048, honesty: 'illustrative wear' };
}
// Old oil stain (not the hazard spill: dull, dried and faded).
m(['-size', '1024x1024', 'xc:none', '-fill', 'rgba(30,24,16,0.35)', '-draw', 'ellipse 512,512 330,250 0,360', '-fill', 'rgba(30,24,16,0.25)', '-draw', 'ellipse 640,430 200,140 0,360', '-draw', 'ellipse 380,600 160,110 0,360',
  '-channel', 'RGBA', '-blur', '0x40', join(OUT, 'floor-oil-stain-old.png')]);
wearAlpha(join(OUT, 'floor-oil-stain-old.png'), '100%', 6, true);
meta['floor-oil-stain-old'] = { label: 'Old dried oil stain', sizeM: [1.2, 1.2], use: 'Under parked-truck spots; dull and dried so it never reads as the live spill hazard', kind: 'color', maxSize: 1024, honesty: 'illustrative wear' };
// Hatched keep-clear zone (yellow and black diagonal stripes, worn).
m([...stripes(1024, 1024, 256, 'rgb(255,209,0)', 'rgb(20,20,20)'),
  '(', '-size', '1024x1024', 'xc:white', '+noise', 'Random', '-colorspace', 'gray', '-blur', '0x3', '-threshold', '78%', '-negate', '-level', '0%,100%', ')', '-compose', 'multiply', '-composite', join(OUT, 'floor-hatch-keep-clear.png')]);
meta['floor-hatch-keep-clear'] = { label: 'Hatched keep-clear zone', sizeM: [1, 1], use: 'Tiled in front of exits, extinguishers, the eyewash and the dock edge', kind: 'color', maxSize: 1024, honesty: 'common floor-marking practice; layout fictional' };
// Walkway text and pedestrian symbol stencil (alpha) for the marked walkway.
m(['-size', '1024x512', 'xc:none', '-fill', 'rgba(255,209,0,0.92)', '-draw', 'circle 220,110 220,70', '-draw', 'polygon 200,160 250,160 270,300 236,300 226,240 214,300 180,300',
  '-draw', 'polygon 196,170 150,250 170,262 214,190', '-draw', 'polygon 254,170 300,250 280,262 236,190', '-draw', 'polygon 186,300 222,300 214,440 180,440', '-draw', 'polygon 228,300 264,300 290,440 256,440',
  '(', '-background', 'none', '-fill', 'rgba(255,209,0,0.92)', '-font', FONT, '-size', '600x300', '-gravity', 'west', 'caption:WALKWAY', ')', '-gravity', 'northwest', '-geometry', '+360+106', '-composite', join(OUT, 'floor-walkway-stencil.png')]);
wearAlpha(join(OUT, 'floor-walkway-stencil.png'));
meta['floor-walkway-stencil'] = { label: 'Walkway floor stencil', sizeM: [1.6, 0.8], use: 'Painted at intervals along the pedestrian walkway', kind: 'color', maxSize: 1024, honesty: 'own design; layout fictional' };
// Direction arrow for the truck route.
m(['-size', '512x1024', 'xc:none', '-fill', 'rgba(243,246,248,0.9)', '-draw', 'polygon 256,40 470,330 330,330 330,980 182,980 182,330 42,330', join(OUT, 'floor-arrow.png')]);
wearAlpha(join(OUT, 'floor-arrow.png'));
meta['floor-arrow'] = { label: 'Truck route arrow', sizeM: [0.6, 1.2], use: 'One-way arrows on the truck route', kind: 'color', maxSize: 1024, honesty: 'own design; layout fictional' };
// Dock edge chevrons (yellow and black stripes, tileable).
m([...stripes(512, 128, 128, 'rgb(255,209,0)', 'rgb(20,20,20)'),
  '(', '-size', '512x128', 'xc:white', '+noise', 'Random', '-colorspace', 'gray', '-blur', '0x2', '-threshold', '80%', '-negate', ')', '-compose', 'multiply', '-composite', join(OUT, 'stripe-dock-edge.png')]);
meta['stripe-dock-edge'] = { label: 'Dock edge stripes', sizeM: [1, 0.25], use: 'Tiled along the dock edge and the leveller lip', kind: 'color', maxSize: 512, honesty: 'common marking; own drawing' };

// ---------- Carton sides (corrugated board, tape, print; used per face on carton models) ----------
{
  const W = 512, H = 512;
  const board = join(OUT, 'tmp-board.png');
  // Kraft fibre: warm brown base, fine noise, faint flute ridges every 8 px.
  m(['-size', `${W}x${H}`, 'xc:#C29A6B', '(', '-size', `${W}x${H}`, 'xc:gray88', '+noise', 'Gaussian', '-attenuate', '0.5', '-motion-blur', '0x6+0', '-colorspace', 'gray', ')', '-compose', 'multiply', '-composite',
    '(', '-size', `${W}x${H}`, 'xc:white', '-fx', 'mod(i,8)<4 ? 0.95 : 1.0', '-blur', '0x0.8', ')', '-compose', 'multiply', '-composite', board]);
  // Plain side: brown tape band across the top flap seam.
  m([board, '-fill', 'rgba(150,104,52,0.85)', '-draw', `rectangle 0,0 ${W},40`, '-fill', 'rgba(255,255,255,0.08)', '-draw', `rectangle 0,6 ${W},12`, join(OUT, 'carton-side-plain.png')]);
  meta['carton-side-plain'] = { label: 'Carton side (plain)', sizeM: [0.6, 0.4], use: 'Carton faces without a label', kind: 'color', maxSize: 512, honesty: 'own procedural texture' };
  // Label side: the same board with handling marks and a shipping label.
  m([board, '-fill', 'rgba(150,104,52,0.85)', '-draw', `rectangle 0,0 ${W},40`,
    '(', join(OUT, 'mark-this-way-up.png'), '-resize', '180x90', ')', '-gravity', 'northwest', '-geometry', '+24+70', '-compose', 'over', '-composite',
    '(', join(OUT, 'label-carton-1.png'), '-resize', '150x225', ')', '-gravity', 'northwest', '-geometry', '+320+230', '-compose', 'over', '-composite',
    '-font', FONT, '-fill', 'rgba(40,26,14,0.85)', '-pointsize', '40', '-gravity', 'southwest', '-annotate', '+24+24', 'NORTHWIND', '-pointsize', '24', '-annotate', '+24+70', 'MAX 18 kg', join(OUT, 'carton-side-label.png')]);
  meta['carton-side-label'] = { label: 'Carton side (label and handling marks)', sizeM: [0.6, 0.4], use: 'Front and side faces of cartons', kind: 'color', maxSize: 512, honesty: 'fictional company, address and barcode' };
  execFileSync('rm', ['-f', board]);
}
// ---------- Rack upright face: blue paint with teardrop slots every 50.8 mm (tiles along V) ----------
{
  const W = 128, H = 512; // 128 px across a 76 mm face; 512 px = 4 slot pitches (203 mm)
  const slots = [];
  for (let k = 0; k < 4; k++) {
    const y = 40 + k * 128;
    slots.push('-draw', `circle 64,${y + 14} 64,${y + 2}`, '-draw', `polygon 54,${y + 18} 74,${y + 18} 69,${y + 58} 59,${y + 58}`);
  }
  m(['-size', `${W}x${H}`, 'xc:#1F5FA8', '(', '-size', `${W}x${H}`, 'xc:gray50', '+noise', 'Gaussian', '-attenuate', '0.25', ')', '-compose', 'overlay', '-composite',
    '-fill', '#0B0F14', ...slots, '-fill', 'rgba(255,255,255,0.10)', '-draw', `rectangle 0,0 6,${H}`, '-draw', `rectangle ${W - 6},0 ${W},${H}`, join(OUT, 'rack-upright-face.png')]);
  meta['rack-upright-face'] = { label: 'Rack upright face', sizeM: [0.076, 0.203], use: 'Front face of rack uprights (tiles vertically)', kind: 'color', maxSize: 512, honesty: 'own procedural texture; slot pitch 50.8 mm as on common teardrop racking' };
}

// ---------- Fabric for the hi-vis vests (tileable) ----------
// Fluorescent yellow polyester mesh: colour tile and a matching tangent-space normal map
// derived from a height map with Sobel filters.
m(['-size', '256x256', 'pattern:hexagons', '-negate', '-blur', '0x1.2', '-normalize', join(OUT, 'tmp-mesh-height.png')]);
m([join(OUT, 'tmp-mesh-height.png'), '-level', '0%,100%', '+level-colors', '#B9C800,#E4F21A', join(OUT, 'fabric-hivis-mesh.png')]);
meta['fabric-hivis-mesh'] = { label: 'Hi-vis mesh fabric (colour)', sizeM: [0.05, 0.05], use: 'Tiled on vest bodies', kind: 'color', maxSize: 256, honesty: 'own procedural texture' };
m([join(OUT, 'tmp-mesh-height.png'), '-colorspace', 'gray',
  '(', '-clone', '0', '-morphology', 'Convolve', 'Sobel:0', '-evaluate', 'multiply', '0.5', '-evaluate', 'add', '50%', ')',
  '(', '-clone', '0', '-morphology', 'Convolve', 'Sobel:90', '-evaluate', 'multiply', '0.5', '-evaluate', 'add', '50%', ')',
  '(', '-clone', '0', '-fill', 'gray(255)', '-colorize', '100', ')', '-delete', '0', '-channel', 'RGB', '-combine', '-define', 'png:color-type=2', join(OUT, 'fabric-hivis-mesh-normal.png')]);
meta['fabric-hivis-mesh-normal'] = { label: 'Hi-vis mesh fabric (normal)', sizeM: [0.05, 0.05], use: 'Normal map for vest bodies', kind: 'normal', maxSize: 256, honesty: 'own procedural texture' };
execFileSync('rm', ['-f', join(OUT, 'tmp-mesh-height.png')]);

writeFileSync(join(OUT, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
console.log(`decals: ${Object.keys(meta).length} textures in data/raw/decals/`);
