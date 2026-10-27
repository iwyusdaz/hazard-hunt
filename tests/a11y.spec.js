/**
 * Accessibility: axe on the HTML overlay (menus, HUD, dialogs, text mode, rating
 * dialog). Gate: zero critical or serious issues.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('overlay UI has no critical or serious axe issues', async ({ page }) => {
  await page.goto('/');
  // The app opens in the shared text flow (canvas attached but hidden until the learner enters 3D).
  await expect(page.locator('canvas, [data-webgl-fallback]').first()).toBeAttached({ timeout: 20_000 });
  await expect(page.locator('#textmode .assessment-item').first()).toBeVisible({ timeout: 20_000 });

  const scan = async (label) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('canvas')
      .analyze();
    const bad = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    if (bad.length) console.log(`axe violations (${label}):`, JSON.stringify(bad, null, 2));
    expect(bad, label).toEqual([]);
  };

  await scan('module 1 (text flow)');

  await page.getByRole('button', { name: 'Settings' }).click();
  await scan('settings dialog');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Menu' }).click();
  await scan('menu dialog');
  await page.keyboard.press('Escape');

  // Open the rating dialog from the practice hunt module
  await page.locator('.module-nav button').nth(1).click();
  await page.waitForTimeout(400);
  const rateButtons = page.getByRole('button', { name: /Submit rating/i });
  if ((await rateButtons.count()) > 0) {
    // rating forms are inline in text mode; scan that state
    await scan('practice hunt with rating forms');
  }

  // My progress dialog
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'My progress' }).click();
  await scan('progress dialog');
});
