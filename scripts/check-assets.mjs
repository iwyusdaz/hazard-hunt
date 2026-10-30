/**
 * check-assets.mjs — verify the v3 asset set and object catalog (plan 10 S4).
 *
 *   node scripts/check-assets.mjs        exit 0 = all checks pass
 *
 * Catalog (content/objects.json, plan 10 §4.1): required fields and types, short <= 25
 *   and more <= 120 words, honesty and role values, unique kebab-case ids, realSize in
 *   metres, every non-empty source listed in research/sources.md (empty only for
 *   fictional objects), asset keys present in the manifest, and realSize within 15% of
 *   the measured model size where one model is the whole object.
 * Files: manifest and public/assets/v3 match one to one, sizes recorded correctly, every
 *   file under public/ at most 20 MB, KTX2/GLB magic bytes.
 * Licences: every manifest entry has an allowed licence; every third-party source in
 *   scripts/assets/third-party.json has a row in ATTRIBUTION.md and public/attribution.json.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const errors = [];
const notes = [];
const err = (m) => errors.push(m);

// ---------- catalog ----------
const HONESTY = ['real', 'reconstructed', 'fictional', 'illustrative', 'time-lapse'];
const ROLES = ['task', 'explore'];
const words = (t) => (String(t || '').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
const catalog = JSON.parse(read('content/objects.json'));
const objects = catalog.objects || [];
const manifest = JSON.parse(read('public/assets/v3/manifest.json')).assets;
const sourcesMd = read('research/sources.md');
const zones = JSON.parse(read('content/zones.json'));
const zoneIds = new Set(JSON.stringify(zones).match(/"id":\s*"((?:hazard|distractor|neutral|t-)[^"]*)"/g).map((s) => s.split('"')[3]));
// Objects whose catalog size is a composed scene object, not one model (reason recorded).
const COMPOSED = {
  conveyor: 'four 3 m conveyor sections make the 12 m line',
  'forklift-controls': 'the steering wheel and lever bank inside the forklift model',
  't-hazard-charging-block': 'battery bay door, cage and eyewash station together',
};
const seen = new Set();
const counts = { task: 0, explore: 0, honesty: {}, scenes: {} };
for (const [i, o] of objects.entries()) {
  const at = `objects.json ${o.id || `#${i}`}`;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(o.id || '')) err(`${at}: id must be kebab-case`);
  if (seen.has(o.id)) err(`${at}: duplicate id`);
  seen.add(o.id);
  for (const k of ['name', 'short', 'more']) if (typeof o[k] !== 'string' || !o[k].trim()) err(`${at}: ${k} missing`);
  if (words(o.short) > 25) err(`${at}: short has ${words(o.short)} words`);
  if (words(o.more) > 120) err(`${at}: more has ${words(o.more)} words`);
  if (typeof o.whyItMatters !== 'string') err(`${at}: whyItMatters must be a string`);
  if (o.role === 'task' && !o.whyItMatters.trim()) err(`${at}: task object without whyItMatters`);
  const sizeOk = (typeof o.realSize === 'number' && o.realSize > 0) || (Array.isArray(o.realSize) && o.realSize.length === 3 && o.realSize.every((x) => typeof x === 'number' && x >= 0) && o.realSize.some((x) => x > 0));
  if (!sizeOk) err(`${at}: realSize must be metres`);
  if (!HONESTY.includes(o.honesty)) err(`${at}: honesty "${o.honesty}"`);
  if (!ROLES.includes(o.role)) err(`${at}: role "${o.role}"`);
  if (typeof o.source !== 'string') err(`${at}: source missing`);
  else if (!o.source) { if (o.honesty !== 'fictional') err(`${at}: empty source on a non-fictional object`); }
  else if (!sourcesMd.includes(o.source)) err(`${at}: source ${o.source} is not in research/sources.md`);
  if (o.role === 'task' && !zoneIds.has(o.id)) err(`${at}: task object id is not in content/zones.json`);
  // asset + scale
  const a = o.asset || '';
  if (a === 'procedural') { /* built by the app */ }
  else if (a.startsWith('decal:')) {
    const d = manifest[a];
    if (!d) err(`${at}: asset ${a} not in the manifest`);
    else if (Array.isArray(o.realSize)) {
      const real = [...o.realSize].filter((x) => x > 0).sort((x, y) => y - x);
      const meas = [...d.sizeM].sort((x, y) => y - x);
      const e = Math.max(...real.map((v, k) => Math.abs(meas[k] - v) / v));
      if (e > 0.15) err(`${at}: realSize off decal size by ${(e * 100).toFixed(0)}%`);
    }
  } else if (!manifest[a]) err(`${at}: asset "${a}" not in public/assets/v3/manifest.json`);
  else if (COMPOSED[o.id]) notes.push(`${o.id}: scale checked in the scene, not here (${COMPOSED[o.id]})`);
  else {
    const s = manifest[a].sizeM;
    let e;
    if (typeof o.realSize === 'number') e = Math.abs(Math.max(...s) - o.realSize) / o.realSize;
    else {
      const m = [...s].sort((x, y) => y - x);
      const r = [...o.realSize].sort((x, y) => y - x);
      e = Math.max(...r.map((v, k) => (v ? Math.abs(m[k] - v) / v : 0)));
    }
    if (e > 0.15) err(`${at}: realSize ${JSON.stringify(o.realSize)} vs model ${JSON.stringify(s)} differs by ${(e * 100).toFixed(1)}%`);
  }
  counts[o.role] = (counts[o.role] || 0) + 1;
  counts.honesty[o.honesty] = (counts.honesty[o.honesty] || 0) + 1;
  counts.scenes[o.scene || '-'] = (counts.scenes[o.scene || '-'] || 0) + 1;
}
for (const id of zoneIds) if (!seen.has(id)) err(`zones.json inspectable ${id} has no catalog entry`);

// ---------- files ----------
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const v3dir = join(root, 'public', 'assets', 'v3');
const onDisk = walk(v3dir).map((p) => relative(join(root, 'public'), p)).filter((p) => !p.endsWith('manifest.json'));
const listed = new Map();
for (const [k, v] of Object.entries(manifest)) {
  if (v.file) listed.set(v.file, { key: k, bytes: v.bytes });
  for (const m of Object.values(v.maps || {})) listed.set(m.file, { key: k, bytes: m.bytes });
}
for (const f of onDisk) if (!listed.has(f)) err(`file ${f} is not in the manifest`);
let v3bytes = 0;
for (const [f, { key, bytes }] of listed) {
  const p = join(root, 'public', f);
  if (!existsSync(p)) { err(`manifest ${key}: ${f} missing on disk`); continue; }
  const size = statSync(p).size;
  v3bytes += size;
  if (size !== bytes) err(`manifest ${key}: ${f} is ${size} bytes, manifest says ${bytes}`);
  const head = readFileSync(p).subarray(0, 12);
  if (f.endsWith('.glb') && head.toString('latin1', 0, 4) !== 'glTF') err(`${f}: not a GLB`);
  if (f.endsWith('.ktx2') && head.toString('latin1', 1, 7) !== 'KTX 20') err(`${f}: not KTX2`);
}
const allPublic = walk(join(root, 'public'));
const largest = allPublic.map((p) => [relative(root, p), statSync(p).size]).sort((a, b) => b[1] - a[1])[0];
for (const p of allPublic) if (statSync(p).size > 20 * 1024 * 1024) err(`${relative(root, p)} is over 20 MB`);

// ---------- licences and attribution ----------
const ALLOWED = /^(CC0-1\.0|PD|CC-BY-4\.0|own work|CC0-1\.0 inputs)/;
for (const [k, v] of Object.entries(manifest)) if (!ALLOWED.test(v.licence || '')) err(`manifest ${k}: licence "${v.licence}" not allowed`);
const attrMd = read('ATTRIBUTION.md');
const attrJson = JSON.parse(read('public/attribution.json'));
const tp = JSON.parse(read('scripts/assets/third-party.json'));
const need = [
  ...tp.polyhavenModels.map((m) => `https://polyhaven.com/a/${m.id}`),
  ...tp.polyhavenTextures.map((t) => `https://polyhaven.com/a/${t.id}`),
  ...tp.polyhavenHdris.map((h) => `https://polyhaven.com/a/${h.id}`),
  tp.makehuman.page,
  'https://github.com/makehumancommunity/mpfb2/blob/master/LICENSE.md',
  'https://github.com/google/fonts/tree/main/ofl/barlowcondensed',
  'https://github.com/google/fonts/tree/main/ofl/inter',
];
for (const url of need) {
  if (!attrMd.includes(`| ${url} |`)) err(`ATTRIBUTION.md has no row with source ${url}`);
  const row = attrJson.find((r) => r.source === url);
  if (!row) err(`public/attribution.json has no row with source ${url} (run node scripts/build-attribution.mjs)`);
  else if (!/^(CC0 1\.0|SIL OFL 1\.1|CC BY 4\.0)$/.test(row.license)) err(`attribution.json ${url}: licence ${row.license}`);
}
for (const [k, v] of Object.entries(manifest)) {
  if (v.kind === 'polyhaven-model' || v.kind === 'polyhaven-texture') {
    if (!need.includes(v.source)) err(`manifest ${k}: source ${v.source} has no third-party.json entry`);
  }
}

// ---------- report ----------
const mb = (b) => (b / 1048576).toFixed(2);
console.log(`catalog: ${objects.length} objects (task ${counts.task}, explore ${counts.explore}); scenes ${JSON.stringify(counts.scenes)}; honesty ${JSON.stringify(counts.honesty)}`);
console.log(`files: ${listed.size} in public/assets/v3, ${mb(v3bytes)} MB; largest file under public/: ${largest[0]} (${mb(largest[1])} MB)`);
console.log(`licences: ${Object.keys(manifest).length} manifest entries, ${need.length} third-party sources attributed in ATTRIBUTION.md and attribution.json`);
for (const n of notes) console.log(`note: ${n}`);
if (errors.length) { console.error(`\nFAIL: ${errors.length} problem(s)\n  ${errors.join('\n  ')}`); process.exit(1); }
console.log('PASS');
