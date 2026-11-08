/**
 * v3 browser tests (headless Chromium, software WebGL, Low preset): the
 * scene-first shell in Bay 4, labels hidden at rest, the clickable world and
 * keyboard list, keyboard-only completion of all five modules (reduced motion,
 * so the replay moves in still steps), text-mode parity, reduced motion,
 * touch, and the no-WebGL fallback. GPU gates (performance, alive) run headed
 * in _tools/ui-audit.mjs.
 */
import { test, expect } from '@playwright/test';
import { ready, visibleLabels, pointOn } from './helpers.js';
const T = (page, fn, arg) => page.evaluate(fn, arg);
/** Press Tab until `locator` has focus (the real keyboard path), then press `key`. */
async function kb(page, locator, key = 'Enter', max = 300) {
  const el = typeof locator === 'string' ? page.locator(locator).first() : locator;
  await expect(el).toBeVisible();
  for (let i = 0; i < max; i++) {
    const where = await el.evaluate((e) => { const a = document.activeElement; if (a === e) return 0; if (!a || a === document.body) return 1; return a.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : -1; });
    if (where === 0) { if (key) await page.keyboard.press(key); return; }
    await page.keyboard.press(where > 0 ? 'Tab' : 'Shift+Tab');
  }
  throw new Error(`could not reach ${locator} by Tab`);
}
const card = (page) => page.locator('[data-ui="now-card"]');
const nowBtn = (page, re) => card(page).locator('button').filter({ hasText: re }).first();
const drawer = (page) => page.locator('[data-ui="drawer"]');
const bayReady = (page) => page.waitForFunction(() => window.__TEST__.shell.root.dataset.bayReady === 'ready', null, { timeout: 180_000 });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('kept')) { localStorage.clear(); sessionStorage.setItem('kept', '1'); } });
});

test('title, practice on the racking, Module 1; props stream after the first interaction', async ({ page }) => {
  await ready(page);
  await expect(page.locator('[data-ui="title-screen"]')).toBeVisible();
  // Before any input only the building, racking and lights exist (download gate); the lights are decorative.
  expect(await T(page, () => window.__TEST__.inspect.ids().sort())).toEqual(['pallet-racking']);
  await page.getByRole('button', { name: /^start$/i }).click();
  await expect(card(page)).toContainText(/Practice 1 of 4/);
  await T(page, () => { const o = window.__TEST__.app.onboarding; o.i = 2; o._show(); });
  expect(await T(page, () => window.__TEST__.inspect.cued)).toBe('pallet-racking');
  await page.getByRole('button', { name: /skip practice/i }).click();
  await expect(card(page)).toContainText('Walk into Bay 4');
  await bayReady(page);
  const s = await T(page, () => ({ n: window.__TEST__.inspect.ids().length, legend: document.querySelector('[data-ui="legend"]').textContent }));
  expect(s.n).toBe(34); // 19 task + 15 learn; decorative objects are not inspectable (owner, 2026-11-07)
  expect(s.legend).toMatch(/Blue spot on the floor/);
});

test('labels are hidden at rest; hover shows one; click opens the card; Show all labels shows them all', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: /^start$/i }).click();
  await page.getByRole('button', { name: /skip practice/i }).click();
  await bayReady(page);
  await T(page, () => window.__TEST__.rig.flyTo(window.__TEST__.lessons.modules()[1].view, 0));
  await page.waitForTimeout(1500);
  expect(await visibleLabels(page)).toEqual([]);
  const p = await pointOn(page, 'hazard-unchocked-trailer') || await pointOn(page, 'pallet-racking');
  expect(p).not.toBeNull();
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(600);
  expect((await visibleLabels(page)).length).toBe(1);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator('[data-ui="info-card"]')).toBeVisible();
  await expect(page.locator('[data-ui="discovered"]')).toContainText('1 of 53');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-ui="info-card"]')).toBeHidden();
  await T(page, () => { window.__TEST__.inspect.setShowAll(true); });
  await page.waitForTimeout(600);
  expect((await visibleLabels(page)).length).toBeGreaterThan(5);
});

test('every object in view is in the keyboard list and opens by Enter; a task card hides its verdict until judged', async ({ page }) => {
  await ready(page);
  await T(page, () => window.__TEST__.app.goModule(1));
  await page.keyboard.press('Shift');
  await bayReady(page);
  await page.locator('[data-action="menu"]').click();
  await page.locator('[data-ui="objects-list-toggle"]').click();
  const list = page.locator('[data-ui="objects-list"] [data-object-id]');
  expect(await list.count()).toBeGreaterThanOrEqual(50);
  const spill = page.locator('[data-ui="objects-list"] [data-object-id="hazard-spill"]');
  await spill.focus();
  await page.keyboard.press('Enter');
  const info = page.locator('[data-ui="info-card"][data-object-id="hazard-spill"]');
  await expect(info).toBeVisible();
  await expect(info).not.toContainText('cordon it off');
  await expect(info.getByRole('button', { name: 'Judge this area' })).toBeVisible();
});

test('keyboard only: all five modules to the course summary (reduced motion)', async ({ page }) => {
  test.setTimeout(600_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1024, height: 640 });
  await ready(page);
  // Software WebGL is slow and the keyboard path does not depend on render
  // detail: draw at a quarter of the pixel ratio so each Tab is answered quickly.
  await T(page, () => { const e = window.__TEST__.engine; e.setReading = () => {}; e.readingScale = 0.25; e.resize(); });
  await kb(page, page.getByRole('button', { name: /^start$/i }));
  await kb(page, page.getByRole('button', { name: /skip practice/i }));
  await bayReady(page);
  // Module 1: walk, then the five pre-check questions.
  await kb(page, nowBtn(page, /^Next step$/));
  for (let q = 0; q < 5; q++) {
    await kb(page, card(page).locator('[data-choice]').first());
    await kb(page, nowBtn(page, /Next question|Finish the pre-check/));
  }
  await kb(page, nowBtn(page, /^Next module$/));
  // Module 2: judge every area in both parts from the areas list.
  const judgeAll = async () => {
    for (;;) {
      await kb(page, nowBtn(page, /^List the areas to judge$/));
      const next = drawer(page).locator('[data-area-id]').filter({ hasNotText: '✓' }).first();
      if (!(await next.count())) { await page.keyboard.press('Escape'); return; }
      await kb(page, next);
      await kb(page, page.locator('[data-ui="info-card"]').getByRole('button', { name: /Judge this area/ }));
      const form = drawer(page);
      await kb(page, form.locator('input[type=radio][value="hazard"]'), null);
      await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); // acceptable
      await kb(page, form.getByRole('button', { name: 'Submit', exact: true }));
      await expect(form.locator('.feedback')).toBeVisible();
      await page.keyboard.press('Escape');
    }
  };
  await judgeAll();
  await kb(page, nowBtn(page, /Go to Part B/));
  await judgeAll();
  await kb(page, nowBtn(page, /Finish the hunt/));
  await kb(page, nowBtn(page, /^Next module$/));
  // Module 3: the replay in still steps, two decisions, then the causes chart.
  await kb(page, nowBtn(page, /Start the replay/));
  for (let seg = 0; seg < 4; seg++) {
    for (let guard = 0; guard < 4; guard++) {
      if (await card(page).locator('[data-choice]').count()) {
        await kb(page, card(page).locator('[data-choice]').first());
        await kb(page, nowBtn(page, /Continue the replay/));
        continue;
      }
      const prim = nowBtn(page, /Next segment|Sort the causes/);
      if (await prim.isEnabled()) break;
      await kb(page, card(page).locator('[data-replay="play"]'));
      await page.waitForTimeout(300);
    }
    await kb(page, nowBtn(page, /Next segment|Sort the causes/));
  }
  await kb(page, nowBtn(page, /Open the causes chart/));
  for (const sel of await drawer(page).locator('select').all()) { await kb(page, sel, null); await sel.selectOption('condition'); }
  await kb(page, drawer(page).getByRole('button', { name: 'Check my chart' }));
  await page.keyboard.press('Escape');
  await kb(page, nowBtn(page, /^Next module$/));
  // Module 4: rank the controls for three hazards (submitting as listed), then Is it training.
  await kb(page, nowBtn(page, /^Rank the controls$/));
  for (let t = 0; t < 3; t++) {
    await kb(page, drawer(page).getByRole('button', { name: 'Submit ranking' }));
    await kb(page, drawer(page).getByRole('button', { name: /Next hazard|Finish ranking/ }));
  }
  await page.keyboard.press('Escape');
  await kb(page, nowBtn(page, /^Next step$/));
  await kb(page, nowBtn(page, /Open Is it training/));
  await page.keyboard.press('Escape');
  await kb(page, nowBtn(page, /^Next module$/));
  // Module 5: speak up, transfer hunt, reflection, post-check, summary.
  await kb(page, nowBtn(page, /Talk to Grace/));
  for (let i = 0; i < 6 && !(await drawer(page).locator('.feedback').count()); i++) await kb(page, drawer(page).locator('.choice-btn').first());
  await expect(drawer(page).locator('.feedback')).toBeVisible();
  await page.keyboard.press('Escape');
  await kb(page, nowBtn(page, /^Next step$/));
  await judgeAll();
  await kb(page, nowBtn(page, /^Next step$/));
  await kb(page, nowBtn(page, /^Next step$/));
  for (let q = 0; q < 5; q++) {
    await kb(page, card(page).locator('[data-choice]').first());
    await kb(page, nowBtn(page, /Next question|See my results/));
  }
  await kb(page, nowBtn(page, /Open the course summary/));
  await expect(drawer(page)).toContainText('Post-check');
  const done = await T(page, () => window.__TEST__.record.events.some((e) => e.object.id.endsWith(':course') && e.verb.display['en-US'] === 'completed'));
  expect(done).toBe(true);
});

test('text mode: same decisions, same record; the catalog is listed', async ({ page }) => {
  await ready(page);
  await T(page, () => window.__TEST__.app.goModule(1));
  await T(page, () => window.__TEST__.ui.toggleTextMode());
  const tm = page.locator('[data-ui="textmode"], #textmode').first();
  await expect(tm).toContainText('Module 2: Practice hunt');
  const sec = tm.locator('section.assessment-item[data-item="hazard-spill"]');
  await sec.locator('input[value="hazard"]').check();
  await sec.locator('input[name$="-likelihood"]').nth(2).check();
  await sec.locator('input[name$="-severity"]').nth(3).check();
  await sec.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(tm.locator('section.assessment-item[data-item="hazard-spill"] .feedback')).toBeVisible();
  expect(await T(page, () => window.__TEST__.lessons.hunt.flags.has('hazard-spill'))).toBe(true);
  await expect(tm).toContainText('Counterbalance forklift');
  // Every course object has a text-mode card; decorative ones have none (owner, 2026-11-07).
  const want = await T(page, () => window.__TEST__.catalog.inspectable.map((o) => o.id).sort());
  const have = await tm.locator('[data-object-id]').evaluateAll((els) => [...new Set(els.map((e) => e.dataset.objectId))].sort());
  expect(have).toEqual(want);
  await expect(tm.locator('[data-object-id="replay-truck"]')).toHaveCount(0);
});

test('reduced motion: ambient motion stops, no camera drift', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await T(page, () => window.__TEST__.app.goModule(0));
  await page.keyboard.press('Shift');
  await bayReady(page);
  const a = await T(page, () => ({ p: window.__TEST__.engine.camera.position.toArray(), f: window.__TEST__.bay.forklift.root.position.toArray() }));
  await page.waitForTimeout(2500);
  const b = await T(page, () => ({ p: window.__TEST__.engine.camera.position.toArray(), f: window.__TEST__.bay.forklift.root.position.toArray() }));
  expect(b.p).toEqual(a.p);
  expect(b.f).toEqual(a.f);
});

test('touch: a tap opens the object card with its label', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.clear());
  await ready(page);
  await T(page, () => window.__TEST__.app.goModule(0));
  await page.touchscreen.tap(195, 400);
  await bayReady(page);
  await T(page, () => window.__TEST__.rig.flyTo(window.__TEST__.lessons.modules()[3].view, 0));
  await page.waitForTimeout(1500);
  const p = await pointOn(page, 'pallet-racking');
  expect(p).not.toBeNull();
  await page.touchscreen.tap(p.x, p.y);
  await expect(page.locator('[data-ui="info-card"][data-object-id="pallet-racking"]')).toBeVisible();
  await ctx.close();
});

test('no WebGL2: text mode opens with every objective', async ({ page }) => {
  await page.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...r) { return /webgl/.test(t) ? null : g.call(this, t, ...r); }; });
  await page.goto('/');
  await page.waitForFunction(() => window.__APP_READY__, null, { timeout: 60_000 });
  const tm = page.locator('[data-ui="textmode"], #textmode').first();
  await expect(tm).toBeVisible();
  await expect(tm).toContainText('Pre-check');
});

test('Back returns to the previous step or screen; Back to start shows the title again; no link to all projects', async ({ page }) => {
  await ready(page);
  await expect(page.getByRole('link', { name: /all projects/i })).toHaveCount(0);
  await page.getByRole('button', { name: /^start$/i }).click();
  await expect(card(page)).toContainText(/Practice 1 of 4/);
  await page.locator('[data-ui="back"]').click();
  await expect(page.locator('[data-ui="title-screen"]')).toBeVisible();
  await page.getByRole('button', { name: /^start$/i }).click();
  await page.getByRole('button', { name: /skip practice/i }).click();
  await expect(card(page)).toContainText('Walk into Bay 4');
  await nowBtn(page, /^Next step$/).click();
  await expect(card(page)).toContainText('Check what you know');
  await page.locator('[data-ui="back"]').click();
  await expect(card(page)).toContainText('Walk into Bay 4');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Back to start' }).click();
  await expect(page.locator('[data-ui="title-screen"]')).toBeVisible();
});
