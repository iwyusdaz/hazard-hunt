/**
 * capture-views.mjs — revision evidence: screenshot every zone view (default aim)
 * and each inspectable as framed by the POI "aim at item" action, on one preset.
 * Builds a test-hooks bundle into tmp/views-build and serves it on 127.0.0.1:4292.
 * Writes evaluation/results/revisions/<preset>-view-<id>.png and -item-<id>.png.
 *
 * Usage: node scripts/capture-views.mjs [preset] [--items]
 */
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const preset = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) || 'medium';
const items = process.argv.includes('--items');
const outDir = join(root, 'tmp', 'views-build');
const shots = join(root, 'evaluation', 'results', 'revisions');
mkdirSync(shots, { recursive: true });

execSync('node scripts/sync-content.mjs', { cwd: root, stdio: 'inherit' });
execSync(`npx vite build --outDir ${outDir} --emptyOutDir`, { cwd: root, stdio: 'inherit', env: { ...process.env, VITE_TEST_HOOKS: '1' } });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer((req, res) => {
  let file = join(outDir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(4292, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:4292/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__TEST__?.app?.zones);
  await page.evaluate((p) => window.__TEST__.engine.quality.set(p), preset);
  await page.waitForTimeout(2500);
  const views = await page.evaluate(() => window.__TEST__.app.zones.flatMap((z) => z.views));
  for (const v of views) {
    await page.evaluate((id) => { const a = window.__TEST__.app; a.gotoModule(1); a._gotoView(id); a._show3D(); }, v);
    await page.waitForTimeout(900);
    writeFileSync(join(shots, `${preset}-view-${v}.png`), await page.locator('#app').screenshot());
  }
  if (items) {
    const list = await page.evaluate(() => window.__TEST__.app.zones.flatMap((z) => z.inspectables.map((i) => [z.id, i.id])));
    for (const [zid, id] of list) {
      await page.evaluate(({ zid, id }) => {
        const a = window.__TEST__.app;
        a.gotoModule(zid === 'transfer' ? 4 : 1);
        a._aimAtItem(id, a.zones.find((z) => z.id === zid));
        a.warehouse.highlight(id);
      }, { zid, id });
      await page.waitForTimeout(700);
      writeFileSync(join(shots, `${preset}-item-${id}.png`), await page.locator('#app').screenshot());
    }
  }
  console.log(`screenshots written to ${shots}`);
} finally {
  await browser.close();
  server.close();
}
