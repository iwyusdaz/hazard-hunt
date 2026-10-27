/**
 * sync-content.mjs — copy content/*.json into public/content/ before `vite build`
 * so the app can fetch them at runtime while content/ stays the canonical,
 * designer-editable location (standards 4.2).
 */
import { mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'public', 'content'), { recursive: true });
for (const f of readdirSync(join(root, 'content'))) {
  if (f.endsWith('.json')) copyFileSync(join(root, 'content', f), join(root, 'public', 'content', f));
}
console.log('content synced to public/content/');
