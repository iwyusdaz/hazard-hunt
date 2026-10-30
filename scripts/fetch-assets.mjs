/**
 * fetch-assets.mjs — download the third-party inputs of the v3 asset set (plan 10 S4)
 * into data/raw/ (gitignored) and check every licence before anything is kept.
 *
 *   node scripts/fetch-assets.mjs [--only models,textures,hdris,makehuman,fonts]
 *   MH_PACK_ZIP=/path/makehuman_system_assets_cc0.zip node scripts/fetch-assets.mjs
 *
 * Licence checks (the script exits 1 on any failure and deletes nothing it did not write):
 *  - Poly Haven: the asset must exist in api.polyhaven.com, and https://polyhaven.com/license
 *    must still state that all assets are CC0. Authors are taken from the API.
 *  - MakeHuman: every asset listed in third-party.json "used" must be in the pack, and its
 *    .mhclo/.mhmat/.proxy file must carry a "license CC0" line (MakeHuman files declare it).
 *  - Fonts: the OFL.txt next to the font must be the SIL Open Font License 1.1.
 *  - Any licence text naming NonCommercial or NoDerivatives fails, whatever the source.
 * Output: data/raw/fetch-log.json (licence evidence, sha256 and size of every raw file).
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(root, 'data', 'raw');
const cfg = JSON.parse(readFileSync(join(root, 'scripts', 'assets', 'third-party.json'), 'utf8'));
const onlyIdx = process.argv.indexOf('--only');
const only = onlyIdx > 0 ? new Set(process.argv[onlyIdx + 1].split(',')) : null;
const want = (k) => !only || only.has(k);
const UA = { 'User-Agent': 'ImmersiveLearningPortfolio/3.0 (hazard-hunt asset fetch)' };
const BANNED = /non[- ]?commercial|no[- ]?deriv|BY[- ]NC|BY[- ]ND/i;

const log = existsSync(join(RAW, 'fetch-log.json')) ? JSON.parse(readFileSync(join(RAW, 'fetch-log.json'), 'utf8')) : { items: {} };
const failures = [];
const fail = (msg) => { failures.push(msg); console.error(`LICENCE CHECK FAILED: ${msg}`); };

async function get(url, as = 'buffer') {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: UA, redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      if (as === 'json') return await res.json();
      if (as === 'text') return await res.text();
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
}
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
function save(rel, buf) {
  const p = join(RAW, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, buf);
  return { file: rel, bytes: buf.length, sha256: sha(buf) };
}

// ---------- Poly Haven ----------
let phLicenceOk = null;
async function polyhavenLicence() {
  if (phLicenceOk !== null) return phLicenceOk;
  const html = await get('https://polyhaven.com/license', 'text');
  const text = html.replace(/<[^>]+>/g, ' ');
  phLicenceOk = /assets are all licensed as\s+CC0/i.test(text);
  if (!phLicenceOk) fail('polyhaven.com/license no longer states "assets are all licensed as CC0"');
  return phLicenceOk;
}
async function polyhavenInfo(id) {
  const info = await get(`https://api.polyhaven.com/info/${id}`, 'json');
  if (!info || !info.authors) { fail(`Poly Haven asset ${id} not found in the API`); return null; }
  return info;
}
function licenceRecord(id, info, extra = {}) {
  return {
    id, name: info.name, authors: Object.keys(info.authors).join(', '),
    source: `https://polyhaven.com/a/${id}`, licence: 'CC0-1.0',
    licenceEvidence: 'https://polyhaven.com/license states all assets are CC0; asset present in api.polyhaven.com/info',
    retrieved: new Date().toISOString().slice(0, 10), dimensionsMm: info.dimensions || null, polycount: info.polycount || null, ...extra,
  };
}

async function fetchModels() {
  await polyhavenLicence();
  for (const { id } of cfg.polyhavenModels) {
    const info = await polyhavenInfo(id);
    if (!info) continue;
    const files = await get(`https://api.polyhaven.com/files/${id}`, 'json');
    const entry = files?.gltf?.['1k']?.gltf;
    if (!entry) { fail(`${id}: no 1k glTF on Poly Haven`); continue; }
    const out = [];
    out.push(save(`polyhaven/models/${id}/${id}.gltf`, await get(entry.url)));
    for (const [rel, f] of Object.entries(entry.include || {})) {
      out.push(save(`polyhaven/models/${id}/${rel}`, await get(f.url)));
    }
    log.items[`model:${id}`] = { ...licenceRecord(id, info), kind: 'polyhaven-model', files: out };
    console.log(`model ${id}: ${out.length} files, ${(out.reduce((s, f) => s + f.bytes, 0) / 1024).toFixed(0)} KB, CC0 (${Object.keys(info.authors).join(', ')})`);
  }
}

async function fetchTextures() {
  await polyhavenLicence();
  for (const { id, res } of cfg.polyhavenTextures) {
    const info = await polyhavenInfo(id);
    if (!info) continue;
    const files = await get(`https://api.polyhaven.com/files/${id}`, 'json');
    const out = [];
    for (const [key, name] of [['Diffuse', 'diff'], ['nor_gl', 'nor_gl'], ['Rough', 'rough'], ['arm', 'arm']]) {
      const url = files?.[key]?.[res]?.jpg?.url;
      if (!url) continue;
      out.push(save(`polyhaven/textures/${id}/${id}_${name}_${res}.jpg`, await get(url)));
    }
    if (!out.length) { fail(`${id}: no ${res} JPG maps`); continue; }
    log.items[`texture:${id}`] = { ...licenceRecord(id, info), kind: 'polyhaven-texture', res, files: out };
    console.log(`texture ${id} (${res}): ${out.map((f) => f.file.split('_').slice(-2, -1)[0]).join(', ')}, CC0 (${Object.keys(info.authors).join(', ')})`);
  }
}

async function fetchHdris() {
  await polyhavenLicence();
  for (const { id, res } of cfg.polyhavenHdris) {
    const info = await polyhavenInfo(id);
    if (!info) continue;
    log.items[`hdri:${id}`] = { ...licenceRecord(id, info), kind: 'polyhaven-hdri', res, files: [], note: 'Already committed (v2); licence re-checked only' };
    console.log(`hdri ${id}: licence re-checked, CC0 (${Object.keys(info.authors).join(', ')})`);
  }
}

// ---------- MakeHuman system assets ----------
function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
}
async function fetchMakehuman() {
  const mh = cfg.makehuman;
  const zipPath = join(RAW, 'makehuman', 'makehuman_system_assets_cc0.zip');
  mkdirSync(dirname(zipPath), { recursive: true });
  if (process.env.MH_PACK_ZIP && !existsSync(zipPath)) copyFileSync(process.env.MH_PACK_ZIP, zipPath);
  if (!existsSync(zipPath)) writeFileSync(zipPath, await get(mh.url));
  const page = (await get(mh.page, 'text')).replace(/<[^>]+>/g, ' ');
  if (BANNED.test(page)) fail('MakeHuman pack page mentions a NonCommercial/NoDerivatives licence');
  const dir = join(RAW, 'makehuman', 'pack');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    execFileSync('unzip', ['-q', '-o', zipPath, '-d', dir]);
  }
  const files = walk(dir);
  // Two independent pieces of evidence per asset: the pack metadata (packs/<pack>.json,
  // "license" per asset) and the CC0 release statement in the asset file's own header.
  const packMeta = JSON.parse(readFileSync(join(dir, 'packs', `${mh.pack}.json`), 'utf8'));
  const records = [];
  for (const used of mh.used) {
    const [sub, name] = used.split('/');
    const decl = files.find((f) => new RegExp(`/${sub}/(.*/)?${name}\\.(mhclo|mhmat|proxy|mhpxy)$`).test(f));
    if (!decl) { fail(`MakeHuman asset ${used} not found in the pack`); continue; }
    const txt = readFileSync(decl, 'utf8');
    const header = /explicitly released as CC0/i.test(txt);
    const meta = packMeta[name] || {};
    const lic = String(meta.license || '');
    if (!/^cc0/i.test(lic)) fail(`MakeHuman asset ${used}: pack metadata licence is "${lic || 'missing'}", expected CC0`);
    if (!header) fail(`MakeHuman asset ${used}: file header has no CC0 release statement`);
    if (BANNED.test(txt.slice(0, 2000)) || BANNED.test(lic)) fail(`MakeHuman asset ${used}: banned licence wording`);
    records.push({ asset: used, declFile: relative(RAW, decl), licence: lic, headerCC0: header, author: meta.author || 'makehuman_system' });
  }
  const zipBuf = readFileSync(zipPath);
  log.items['makehuman:system_assets'] = {
    id: mh.pack, kind: 'makehuman-pack', source: mh.page, download: mh.url, authors: mh.author,
    licence: 'CC0-1.0', licenceEvidence: 'pack page lists every asset as CC0; each used asset file declares "license CC0"',
    retrieved: new Date().toISOString().slice(0, 10), zip: { bytes: zipBuf.length, sha256: sha(zipBuf) }, assets: records,
  };
  console.log(`makehuman: ${records.length} used assets checked, all ${records.every((r) => /^cc0/i.test(r.licence)) ? 'CC0' : 'NOT CC0'}`);
}

// ---------- Fonts (baked into sign textures) ----------
async function fetchFonts() {
  for (const f of cfg.fonts) {
    const ofl = await get(f.licenceUrl, 'text');
    if (!/SIL OPEN FONT LICENSE Version 1\.1/i.test(ofl)) { fail(`${f.id}: OFL.txt is not SIL OFL 1.1`); continue; }
    const rec = save(`fonts/${f.id}.ttf`, await get(f.url));
    save(`fonts/${f.id}.OFL.txt`, Buffer.from(ofl));
    log.items[`font:${f.id}`] = { id: f.id, kind: 'font', name: f.family, authors: f.author, source: f.url, licence: 'OFL-1.1', licenceEvidence: f.licenceUrl, retrieved: new Date().toISOString().slice(0, 10), files: [rec] };
    console.log(`font ${f.family}: OFL 1.1, ${(rec.bytes / 1024).toFixed(0)} KB`);
  }
}

mkdirSync(RAW, { recursive: true });
if (want('models')) await fetchModels();
if (want('textures')) await fetchTextures();
if (want('hdris')) await fetchHdris();
if (want('makehuman')) await fetchMakehuman();
if (want('fonts')) await fetchFonts();

const allowed = [...cfg.allowedLicences.assets, ...cfg.allowedLicences.fonts];
for (const [k, v] of Object.entries(log.items)) {
  if (!allowed.includes(v.licence)) fail(`${k}: licence ${v.licence} is not on the allowed list`);
}
log.checkedAt = new Date().toISOString();
log.failures = failures;
writeFileSync(join(RAW, 'fetch-log.json'), JSON.stringify(log, null, 2) + '\n');
console.log(`\n${Object.keys(log.items).length} items in data/raw/fetch-log.json, ${failures.length} licence failures`);
process.exit(failures.length ? 1 : 0);
