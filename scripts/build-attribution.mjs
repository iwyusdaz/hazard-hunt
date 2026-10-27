/**
 * build-attribution.mjs — generate public/attribution.json from the
 * "Third-party assets" table in ATTRIBUTION.md (build contract 08 5.4):
 * an array of { asset, author, source, license, changes }.
 * Fails the build if the table is missing or a row has an empty field.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const md = readFileSync(join(root, 'ATTRIBUTION.md'), 'utf8');

const section = md.split(/^## Third-party assets\s*$/m)[1]?.split(/^## /m)[0];
if (!section) throw new Error('ATTRIBUTION.md: "## Third-party assets" section not found');

const rows = section
  .split('\n')
  .filter((l) => l.trim().startsWith('|'))
  .map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));

const [header, , ...body] = rows; // skip the |---| separator row
const col = (name) => {
  const i = header.findIndex((h) => h.toLowerCase() === name);
  if (i < 0) throw new Error(`ATTRIBUTION.md: column "${name}" missing`);
  return i;
};
const idx = { asset: col('asset'), author: col('author'), source: col('source'), license: col('license'), changes: col('changes') };

const out = body.map((r, n) => {
  const entry = Object.fromEntries(Object.entries(idx).map(([k, i]) => [k, r[i] || '']));
  for (const [k, v] of Object.entries(entry)) {
    if (!v) throw new Error(`ATTRIBUTION.md row ${n + 1}: empty "${k}"`);
  }
  return entry;
});

writeFileSync(join(root, 'public', 'attribution.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`attribution.json: ${out.length} entries`);
