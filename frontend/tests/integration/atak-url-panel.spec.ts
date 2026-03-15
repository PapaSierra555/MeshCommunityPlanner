/**
 * Playwright integration tests for the ATAK Integration panel.
 *
 * The panel lives inside details.horizon-note[summary="ATAK Integration"] within
 * .app-sidebar — it only renders when a plan is open. Tests open a new plan via a
 * mocked POST /api/plans, then mock /api/atak/local-url to return a predictable URL.
 *
 * All external network calls are intercepted so tests run without a live backend.
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOCK_PLAN = {
  id: 'test-plan-atak-1',
  name: 'ATAK Test Plan',
  description: '',
  firmware_family: 'meshtastic',
  region: 'us_fcc',
  file_path: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const MOCK_LOCAL_URL = 'http://192.168.1.100:8321/api/atak/nodes.kml';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function dismissTour(page: Page) {
  const overlay = page.locator('.tour-overlay');
  if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
    await overlay.click({ position: { x: 5, y: 5 } });
    await overlay.waitFor({ state: 'hidden', timeout: 3000 });
  }
}

/** Open Plan menu → New Plan → confirm → wait for sidebar. */
async function openNewPlan(page: Page) {
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await page.waitForSelector('.toolbar-dropdown', { timeout: 3000 });
  await page.locator('.toolbar-dropdown-item').filter({ hasText: 'New Plan' }).click();
  await page.waitForSelector('.prompt-dialog-ok', { timeout: 5000 });
  await page.locator('.prompt-dialog-ok').click();
  await page.waitForSelector('.app-sidebar', { timeout: 10000 });
}

/** Expand the "ATAK Integration" collapsible in the sidebar. */
async function openAtakPanel(page: Page) {
  const details = page.locator('details.horizon-note', { hasText: 'ATAK Integration' });
  await details.waitFor({ state: 'visible', timeout: 5000 });
  const isOpen = await details.evaluate((el) => el.hasAttribute('open'));
  if (!isOpen) {
    await details.locator('summary').click();
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

test.describe('ATAK Integration panel', () => {
  test.beforeEach(async ({ page }) => {
    // Mock plan creation
    await page.route('**/api/plans', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ json: MOCK_PLAN });
      } else {
        route.continue();
      }
    });

    // Mock the local-url detection endpoint
    await page.route('**/api/atak/local-url', (route) =>
      route.fulfill({ json: { url: MOCK_LOCAL_URL } })
    );

    // Suppress console noise from the internet-map ping
    await page.route('**/api/import/internet-map/ping', (route) =>
      route.fulfill({ json: { online: true } })
    );

    await page.goto('/');
    await page.waitForSelector('.toolbar', { timeout: 10000 });
    await dismissTour(page);
    await openNewPlan(page);
  });

  // ---- Collapsible presence ----

  test('"ATAK Integration" collapsible exists in the sidebar', async ({ page }) => {
    const details = page.locator('details.horizon-note', { hasText: 'ATAK Integration' });
    await expect(details).toBeVisible({ timeout: 5000 });
  });

  test('"ATAK Integration" collapsible is closed by default', async ({ page }) => {
    const details = page.locator('details.horizon-note', { hasText: 'ATAK Integration' });
    await details.waitFor({ state: 'visible', timeout: 5000 });
    const hasOpen = await details.evaluate((el) => el.hasAttribute('open'));
    expect(hasOpen).toBe(false);
  });

  test('clicking summary opens the ATAK collapsible', async ({ page }) => {
    const details = page.locator('details.horizon-note', { hasText: 'ATAK Integration' });
    await details.waitFor({ state: 'visible', timeout: 5000 });
    await details.locator('summary').click();
    const hasOpen = await details.evaluate((el) => el.hasAttribute('open'));
    expect(hasOpen).toBe(true);
  });

  test('clicking summary again closes the ATAK collapsible', async ({ page }) => {
    const details = page.locator('details.horizon-note', { hasText: 'ATAK Integration' });
    await details.waitFor({ state: 'visible', timeout: 5000 });
    const summary = details.locator('summary');
    await summary.click(); // open
    await summary.click(); // close
    const hasOpen = await details.evaluate((el) => el.hasAttribute('open'));
    expect(hasOpen).toBe(false);
  });

  // ---- URL display ----

  test('URL input shows the detected KML endpoint after panel opens', async ({ page }) => {
    await openAtakPanel(page);
    const urlInput = page.locator('input[aria-label="ATAK KML network link URL"]');
    await expect(urlInput).toBeVisible({ timeout: 5000 });
    // Allow brief "Detecting local IP..." transient before the API resolves
    await expect(urlInput).not.toHaveValue('Detecting local IP...', { timeout: 3000 }).catch(() => {});
    const value = await urlInput.inputValue();
    expect(value).toContain('192.168.1.100');
    expect(value).toContain('8321');
    expect(value).toContain('nodes.kml');
  });

  test('URL input is read-only', async ({ page }) => {
    await openAtakPanel(page);
    const urlInput = page.locator('input[aria-label="ATAK KML network link URL"]');
    await expect(urlInput).toBeVisible();
    const readOnly = await urlInput.getAttribute('readonly');
    expect(readOnly).not.toBeNull();
  });

  test('hint text "Point ATAK at this URL" is visible after opening', async ({ page }) => {
    await openAtakPanel(page);
    const hint = page.locator('.sidebar-hint', { hasText: /Point ATAK at this URL/ });
    await expect(hint).toBeVisible({ timeout: 3000 });
  });

  test('instruction hint mentions KML Network Link', async ({ page }) => {
    await openAtakPanel(page);
    const hint = page.locator('.sidebar-hint', { hasText: /KML Network Link/ });
    await expect(hint).toBeVisible({ timeout: 3000 });
  });

  // ---- Override IP ----

  test('Override IP input is visible after opening', async ({ page }) => {
    await openAtakPanel(page);
    const overrideInput = page.locator('input[aria-label*="Override server IP"]');
    await expect(overrideInput).toBeVisible({ timeout: 3000 });
  });

  test('typing an IP override updates the URL host', async ({ page }) => {
    await openAtakPanel(page);
    const overrideInput = page.locator('input[aria-label*="Override server IP"]');
    await overrideInput.fill('10.0.0.42');
    const urlInput = page.locator('input[aria-label="ATAK KML network link URL"]');
    const value = await urlInput.inputValue();
    expect(value).toContain('10.0.0.42');
    expect(value).not.toContain('192.168.1.100');
  });

  test('clearing the IP override restores the detected URL', async ({ page }) => {
    await openAtakPanel(page);
    const overrideInput = page.locator('input[aria-label*="Override server IP"]');
    await overrideInput.fill('10.0.0.42');
    await overrideInput.fill('');
    const urlInput = page.locator('input[aria-label="ATAK KML network link URL"]');
    const value = await urlInput.inputValue();
    expect(value).toContain('192.168.1.100');
  });

  // ---- Copy button ----

  test('"Copy URL" button is visible and enabled', async ({ page }) => {
    await openAtakPanel(page);
    const copyBtn = page.locator('button', { hasText: 'Copy URL' });
    await expect(copyBtn).toBeVisible({ timeout: 3000 });
    await expect(copyBtn).not.toBeDisabled();
  });

  // ---- Plan filter checkbox ----

  test('"This plan only" checkbox is visible when a plan is open', async ({ page }) => {
    await openAtakPanel(page);
    const checkbox = page.locator('label', { hasText: 'This plan only' });
    await expect(checkbox).toBeVisible({ timeout: 3000 });
  });

  test('"This plan only" checkbox is unchecked by default', async ({ page }) => {
    await openAtakPanel(page);
    const checkbox = page.locator('label', { hasText: 'This plan only' }).locator('input[type="checkbox"]');
    await expect(checkbox).not.toBeChecked();
  });

  test('checking "This plan only" appends plan_id to the URL', async ({ page }) => {
    await openAtakPanel(page);
    const checkbox = page.locator('label', { hasText: 'This plan only' }).locator('input[type="checkbox"]');
    await checkbox.check();
    const urlInput = page.locator('input[aria-label="ATAK KML network link URL"]');
    const value = await urlInput.inputValue();
    expect(value).toContain('plan_id=');
    expect(value).toContain(String(MOCK_PLAN.id));
  });

  test('unchecking "This plan only" removes plan_id from the URL', async ({ page }) => {
    await openAtakPanel(page);
    const checkbox = page.locator('label', { hasText: 'This plan only' }).locator('input[type="checkbox"]');
    await checkbox.check();
    await checkbox.uncheck();
    const urlInput = page.locator('input[aria-label="ATAK KML network link URL"]');
    const value = await urlInput.inputValue();
    expect(value).not.toContain('plan_id=');
  });

  // ---- Keyboard accessibility ----

  test('summary is keyboard accessible — Enter toggles open', async ({ page }) => {
    const details = page.locator('details.horizon-note', { hasText: 'ATAK Integration' });
    await details.waitFor({ state: 'visible', timeout: 5000 });
    const summary = details.locator('summary');
    await summary.focus();
    await expect(summary).toBeFocused();
    await page.keyboard.press('Enter');
    const hasOpen = await details.evaluate((el) => el.hasAttribute('open'));
    expect(hasOpen).toBe(true);
  });
});
