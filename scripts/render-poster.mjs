/**
 * render-poster.mjs — render the 1200×630 poster pair from the real 3D scene.
 *
 * Builds a test-hooks bundle into tmp/poster-build (so the camera can be placed
 * through window.__TEST__), serves it, hides the HTML overlay, and screenshots the
 * canvas. Writes public/poster-<version>.jpg and .webp (each must be ≤ 200 KB).
 *
 * Usage: node scripts/render-poster.mjs [viewId] [--preview]
 *   --preview  writes tmp/poster-preview-<viewId>.png instead of the poster pair
 */
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const viewId = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) || 'aisleNorth';
const preview = process.argv.includes('--preview');
const outDir = join(root, 'tmp', 'poster-build');
const LIMIT = 200 * 1024;

execSync('node scripts/sync-content.mjs', { cwd: root, stdio: 'inherit' });
execSync(`npx vite build --outDir ${outDir} --emptyOutDir`, {
  cwd: root, stdio: 'inherit', env: { ...process.env, VITE_TEST_HOOKS: '1' },
});

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.hdr': 'application/octet-stream', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  let file = join(outDir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(4291, '127.0.0.1', r));

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:4291/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__TEST__?.app?.engine);
await page.addStyleTag({ content: '.app-header,.module-nav,.hud,#overlays,#textmode,.skip-link,dialog{display:none!important}#ui{display:block}.stage{position:fixed;inset:0}#app{width:1200px!important;height:630px!important;visibility:visible!important}' });
await page.evaluate((v) => {
  const { app } = window.__TEST__;
  app.engine.quality.set('high');
  app._gotoView(v);
  window.dispatchEvent(new Event('resize'));
}, viewId);
await page.waitForTimeout(4000); // HDRI + shadow map settle

const png = await page.locator('#app').screenshot({ type: 'png' });
mkdirSync(join(root, 'tmp'), { recursive: true });
if (preview) {
  writeFileSync(join(root, 'tmp', `poster-preview-${viewId}.png`), png);
  console.log(`preview written: tmp/poster-preview-${viewId}.png`);
} else {
  // Encode both formats in the browser (no image dependencies), lowering quality until ≤ 200 KB.
  const encode = async (type) => {
    for (const q of [0.86, 0.8, 0.72, 0.64, 0.56]) {
      const b64 = await page.evaluate(async ({ data, type, q }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${data}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = 1200; c.height = 630;
        c.getContext('2d').drawImage(img, 0, 0, 1200, 630);
        return c.toDataURL(type, q).split(',')[1];
      }, { data: png.toString('base64'), type, q });
      const buf = Buffer.from(b64, 'base64');
      if (buf.length <= LIMIT) return { buf, q };
    }
    throw new Error(`${type} could not be encoded under 200 KB`);
  };
  for (const [type, ext] of [['image/jpeg', 'jpg'], ['image/webp', 'webp']]) {
    const { buf, q } = await encode(type);
    writeFileSync(join(root, 'public', `poster-${version}.${ext}`), buf);
    console.log(`poster-${version}.${ext}: ${(buf.length / 1024).toFixed(1)} KB (quality ${q}, view ${viewId})`);
  }
  // Remove posters from earlier releases so public/ only ships the current pair.
  for (const f of readdirSync(join(root, 'public'))) {
    if (/^poster-\d+\.\d+\.\d+\.(webp|jpg)$/.test(f) && !f.startsWith(`poster-${version}.`)) {
      unlinkSync(join(root, 'public', f));
      console.log(`removed stale poster: ${f}`);
    }
  }
}

await browser.close();
server.close();
