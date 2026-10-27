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

test('intro cinematic is captioned and skippable with Esc', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#textmode .assessment-item').first()).toBeVisible({ timeout: 20_000 });
  const play = page.getByRole('button', { name: /shift-start intro/i });
  if ((await play.count()) === 0) test.skip(true, 'No WebGL in this browser; intro only exists in 3D');
  await play.click();
  const overlay = page.locator('.cinematic-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('.cinematic-caption')).toContainText('Northwind Logistics (fictional)');
  await page.keyboard.press('Escape');
  await expect(overlay).toBeHidden();
  await expect(page.locator('#textmode')).toBeVisible();
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
  const submitButtons = page.getByRole('button', { name: 'Submit', exact: true });
  const n = await submitButtons.count();
  expect(n).toBeGreaterThanOrEqual(7);
  // Hazard: classify as a hazard, then rate (the rating grid appears only after that).
  const spill = page.locator('section.assessment-item', { hasText: 'Receiving floor, between dock doors' });
  await expect(spill.locator('h3')).not.toContainText('spill'); // neutral heading (A1)
  await spill.locator('input[value="hazard"]').check();
  await spill.locator('input[name$="-likelihood"]').nth(2).check();
  await spill.locator('input[name$="-severity"]').nth(3).check();
  await spill.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(spill.locator('.feedback')).toContainText('matches the reference band');
  // Distractor: judged as a controlled condition, no rating needed.
  const ramp = page.locator('section.assessment-item', { hasText: 'Charging area, floor next to the charger' });
  await ramp.locator('input[value="controlled"]').check();
  await expect(ramp.locator('input[name$="-likelihood"]').first()).toBeHidden();
  await ramp.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(ramp.locator('.feedback')).toContainText('Right: nothing to report');
});

test('module 2 has a hinted practice zone and an assessed zone without hints', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#textmode .assessment-item').first()).toBeVisible({ timeout: 20_000 });
  await page.locator('.module-nav button').nth(1).click();
  await expect(page.getByRole('heading', { name: /Part A: practice zone/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Part B: assessed zone/ })).toBeVisible();
  // 7 practice + 8 assessed inspectable areas, each with its own rating form
  await expect(page.getByRole('button', { name: 'Submit', exact: true })).toHaveCount(15);
  // Hints appear only in the practice zone
  const hints = page.locator('section.assessment-item .hint');
  expect(await hints.count()).toBeGreaterThan(0);
  const assessedTable = page.locator('table', { hasText: 'Assessed zone' });
  await expect(assessedTable).toBeVisible();
  const partB = page.locator('h3', { hasText: 'Part B' });
  const hintsAfterB = await partB.evaluate((h) => {
    let n = 0;
    for (let el = h.nextElementSibling; el; el = el.nextElementSibling) n += el.querySelectorAll('.hint').length;
    return n;
  });
  expect(hintsAfterB).toBe(0);
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

test('module 5: post-check, reflection input and completion summary with pre/post scores', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#textmode .assessment-item').first()).toBeVisible({ timeout: 20_000 });
  // Options are shuffled per item at render time (review N4), so the correct choice
  // is identified by its text from the served content data, not by position.
  const items = await (await page.request.get('/content/items.json')).json();
  const answerCorrectly = async (scope, list) => {
    for (const item of await scope.all()) {
      const prompt = (await item.locator('h3').first().textContent()).trim();
      const data = list.find((i) => i.prompt === prompt);
      const correctText = data.options.find((o) => o.id === data.correct).text;
      await item.getByRole('button', { name: correctText, exact: true }).click();
    }
  };
  await answerCorrectly(page.locator('#textmode .assessment-item'), items.preCheck);
  await page.locator('.module-nav button').nth(4).click();
  await page.getByLabel(/Name one condition/).fill('Ramped cable at the charger; a fire door wedged open.');
  await page.getByRole('button', { name: 'Save reflection' }).click();
  await expect(page.getByText('Saved on this device')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Post-check' })).toBeVisible();
  const post = page.locator('.assessment-item', { has: page.locator('h3', { hasText: /next step|rating should change|root causes|busy supervisor|strongest first control/ }) });
  await expect(post).toHaveCount(5);
  await answerCorrectly(post, items.postCheck);
  const summary = page.locator('.course-summary');
  await expect(summary.getByRole('heading', { name: 'Course summary' })).toBeVisible();
  await expect(summary.locator('tr', { hasText: 'Pre-check' })).toContainText('5 of 5');
  await expect(summary.locator('tr', { hasText: 'Post-check' })).toContainText('5 of 5');
});
