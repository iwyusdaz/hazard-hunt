/**
 * axe-core checks (0 critical or serious) on the v3 states: title, practice,
 * each module, an open info card, the objects list, the judge form, the
 * causes chart, the controls ranking and the speak-up drawers, the menu and
 * text mode.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ready } from './helpers.js';
async function scan(page, label) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const bad = r.violations.filter((v) => ['critical', 'serious'].includes(v.impact));
  expect(bad.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}
test('axe: 0 critical/serious on every v3 state', async ({ page }) => {
  test.setTimeout(400_000);
  await page.addInitScript(() => localStorage.clear());
  await ready(page);
  await scan(page, 'title');
  await page.getByRole('button', { name: /^start$/i }).click();
  await scan(page, 'practice');
  await page.getByRole('button', { name: /skip practice/i }).click();
  await page.waitForFunction(() => window.__TEST__.shell.root.dataset.bayReady === 'ready', null, { timeout: 180_000 });
  await page.waitForTimeout(800);
  await scan(page, 'm1');
  await page.evaluate(() => window.__TEST__.inspect.open('forklift'));
  await page.waitForTimeout(800);
  await scan(page, 'info card');
  await page.keyboard.press('Escape');
  for (const i of [1, 2, 3, 4]) {
    await page.evaluate((n) => window.__TEST__.app.goModule(n), i);
    await page.waitForTimeout(2200);
    await scan(page, `m${i + 1}`);
  }
  const L = (fn) => page.evaluate(fn);
  await L(() => { window.__TEST__.app.goModule(1); window.__TEST__.lessons.openJudge('hazard-spill'); });
  await page.waitForTimeout(800);
  await scan(page, 'judge drawer');
  await L(() => window.__TEST__.lessons.openAreas(window.__TEST__.lessons.zones[0]));
  await page.waitForTimeout(500);
  await scan(page, 'areas drawer');
  await L(() => window.__TEST__.lessons.openCauses());
  await page.waitForTimeout(500);
  await scan(page, 'causes drawer');
  await L(() => window.__TEST__.lessons.openRanking());
  await page.waitForTimeout(500);
  await scan(page, 'ranking drawer');
  await L(() => window.__TEST__.lessons.openSpeakUp());
  await page.waitForTimeout(500);
  await scan(page, 'speak-up drawer');
  await page.keyboard.press('Escape');
  await page.locator('[data-action="menu"]').click();
  await scan(page, 'menu');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__TEST__.ui.toggleTextMode());
  await page.waitForTimeout(1200);
  await scan(page, 'text mode');
});
