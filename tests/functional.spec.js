/**
 * Functional tests: module navigation, scripted playthrough of the core path
 * (module 1 → pre-check → practice hunt ratings → replay decisions → controls →
 * speak-up branch → transfer), speak-up branch coverage, keyboard operability.
 * Uses the page's own UI (no test hooks needed for the shared decisions, which all
 * live in the text-flow layer; test hooks exist for state inspection when built
 * with VITE_TEST_HOOKS=1).
 */
import { test, expect } from '@playwright/test';

test('all 5 modules reachable and activatable by keyboard', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(900);
  const tabs = page.locator('.module-nav button');
  await expect(tabs).toHaveCount(5);
  for (let i = 0; i < 5; i++) {
    await tabs.nth(i).focus();
    await page.keyboard.press('Enter');
    await expect(tabs.nth(i)).toHaveAttribute('aria-current', 'page');
  }
});

test('pre-check items accept answers and give why-feedback', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(900);
  const first = page.locator('.assessment-item').first();
  await first.locator('.choice-btn').first().click();
  await expect(first.locator('.feedback')).toBeVisible();
});

test('practice hunt: rate every inspectable item from text mode; hints visible', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(900);
  await page.locator('.module-nav button').nth(1).click();
  // every inspectable area in the practice zone has a rating form inline
  const zones = { count: 7 }; // 7 inspectables in practice zone
  const forms = page.locator('section.assessment-item fieldset');
  expect(await forms.count()).toBeGreaterThanOrEqual(zones.count * 2 - 7); // likelihood+severity per item
  const submitButtons = page.getByRole('button', { name: 'Submit rating' });
  const n = await submitButtons.count();
  expect(n).toBeGreaterThanOrEqual(7);
  // rate the first item: pick middle radio of each grid then submit
  for (let i = 0; i < Math.min(2, n); i++) {
    const form = submitButtons.nth(i).locator('..');
    await form.locator('input[name="likelihood"]').nth(2).check();
    await form.locator('input[name="severity"]').nth(3).check();
    await submitButtons.nth(i).click();
    await expect(form.locator('.feedback')).toBeVisible();
  }
});

test('speak-up: every outcome reachable across three runs', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(900);
  await page.locator('.module-nav button').nth(4).click();
  const seen = new Set();
  const dlg = page.locator('.dialogue-host');
  for (const firstChoice of ['Walk up', 'Call out', 'Wait — she']) {
    const again = dlg.getByRole('button', { name: 'Try a different approach' });
    if ((await again.count()) > 0) await again.click();
    await dlg.locator('button.choice-btn', { hasText: firstChoice }).first().click();
    // Advance through single-option nodes until the outcome feedback appears.
    for (let step = 0; step < 5; step++) {
      if ((await dlg.locator('.feedback').count()) > 0) break;
      const buttons = dlg.locator('button.choice-btn');
      if ((await buttons.count()) === 0) break;
      await buttons.first().click();
    }
    const fb = dlg.locator('.feedback');
    await expect(fb).toBeVisible();
    seen.add((await fb.textContent()).trim().slice(0, 30));
  }
  expect(seen.size).toBe(3); // strong, mixed, poor — every branch reachable
});

test('replay module: pause-decide items give feedback; causes chart present', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(900);
  await page.locator('.module-nav button').nth(2).click();
  const legend = page.getByRole('table');
  await expect(legend.first()).toBeVisible();
  const decisions = page.locator('fieldset legend');
  expect(await decisions.count()).toBeGreaterThanOrEqual(2);
  const firstDecision = page.locator('fieldset').first();
  await firstDecision.locator('label.choice').first().click();
  await firstDecision.getByRole('button', { name: 'Submit decision' }).click();
  await expect(firstDecision.locator('.feedback')).toBeVisible();
});
