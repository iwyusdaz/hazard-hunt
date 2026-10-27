/**
 * Validates dist/showcase.json against schemas/showcase.schema.json (copied from
 * the showcase repo), checks the version equals the release tag, and checks the
 * files the showcase requires are present in dist/.
 * Usage: node scripts/validate-showcase.mjs <version>
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const version = process.argv[2];
if (!version) { console.error('usage: node scripts/validate-showcase.mjs <version>'); process.exit(1); }

const manifest = JSON.parse(readFileSync('dist/showcase.json', 'utf8'));
const schema = JSON.parse(readFileSync('schemas/showcase.schema.json', 'utf8'));
const errors = [];

for (const key of schema.required || []) if (!(key in manifest)) errors.push(`missing required property "${key}"`);
for (const [key, def] of Object.entries(schema.properties || {})) {
  if (!(key in manifest)) continue;
  const v = manifest[key];
  if (def.type === 'string' && typeof v !== 'string') errors.push(`${key}: must be a string`);
  if (def.type === 'number' && typeof v !== 'number') errors.push(`${key}: must be a number`);
  if (def.type === 'array' && !Array.isArray(v)) errors.push(`${key}: must be an array`);
  if (def.type === 'object' && (typeof v !== 'object' || Array.isArray(v))) errors.push(`${key}: must be an object`);
  if (def.enum && !def.enum.includes(v)) errors.push(`${key}: must be one of ${def.enum.join(', ')}`);
  if (def.pattern && typeof v === 'string' && !new RegExp(def.pattern).test(v)) errors.push(`${key}: does not match ${def.pattern}`);
  if (def.maxLength && typeof v === 'string' && v.length > def.maxLength) errors.push(`${key}: longer than ${def.maxLength}`);
  if (def.items?.enum && Array.isArray(v)) for (const item of v) if (!def.items.enum.includes(item)) errors.push(`${key}: "${item}" not allowed`);
  if (def.required && typeof v === 'object') for (const k of def.required) if (!(k in v)) errors.push(`${key}: missing "${k}"`);
}

if (manifest.version !== version) errors.push(`version mismatch: showcase.json ${manifest.version} vs tag ${version}`);

for (const f of ['index.html', 'attribution.json', manifest.poster?.webp, manifest.poster?.jpg]) {
  if (!f || !existsSync(join('dist', f))) errors.push(`dist/ is missing ${f}`);
}
for (const f of [manifest.poster?.webp, manifest.poster?.jpg]) {
  if (f && existsSync(join('dist', f)) && statSync(join('dist', f)).size > 200 * 1024) errors.push(`${f} is over 200 KB`);
}

if (errors.length) {
  console.error('showcase.json validation failed:\n' + errors.map((e) => ' - ' + e).join('\n'));
  process.exit(1);
}
console.log(`showcase.json valid; version ${version}; required files present`);
