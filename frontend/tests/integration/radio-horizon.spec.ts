/**
 * Playwright integration tests for radio horizon UI in the coverage panel.
 *
 * The coverage panel (inside .app-sidebar) is rendered when a plan is open.
 * It shows:
 * - #maxRadiusKm — input capped at the radio horizon for the selected node height
 * - A hint: "Radio horizon at X m: Y km max"
 * - A "About the global environment setting" collapsible (details.horizon-note)
 * - A remember-coverage-settings checkbox
 *
 * These tests open a new plan first so the coverage panel is visible.
 * POST /api/plans is mocked so tests run without a live backend.
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_PLAN = {
  id: 'test-plan-horizon-1',
  name: 'Radio Horizon Test Plan',
  description: '',
  firmware_family: 'meshtastic',
  region: 'us_fcc',
  file_path: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

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

/** Open Plan menu → New Plan → confirm → wait for coverage panel. */
async function openNewPlan(page: Page) {
  // aria-hidden arrow span excluded from accessible name, so exact match works
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await page.waitForSelector('.toolbar-dropdown', { timeout: 3000 });
  await page.locator('.toolbar-dropdown-item').filter({ hasText: 'New Plan' }).click();

  // PromptDialog always appears for New Plan — wait deterministically and click OK
  await page.waitForSelector('.prompt-dialog-ok', { timeout: 5000 });
  await page.locator('.prompt-dialog-ok').click();

  // Wait for coverage panel to confirm plan was created and panel rendered
  await page.waitForSelector('#maxRadiusKm', { timeout: 10000 });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

test.describe('Radio Horizon UX', () => {
  test.beforeEach(async ({ page }) => {
    // Mock plan creation so tests run without a live backend
    await page.route('**/api/plans', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ json: MOCK_PLAN });
      } else {
        route.continue();
      }
    });
    // Mock ping so no console noise from the internet-map feature
    await page.route('**/api/import/internet-map/ping', (route) =>
      route.fulfill({ json: { online: true } })
    );

    await page.goto('/');
    await page.waitForSelector('.toolbar');
    await dismissTour(page);
    await openNewPlan(page);
  });

  // ---- Max radius input ----

  test('#maxRadiusKm input is visible in the plan panel', async ({ page }) => {
    await expect(page.locator('#maxRadiusKm')).toBeVisible();
  });

  test('#maxRadiusKm has a numeric default within the horizon cap', async ({ page }) => {
    // With no nodes, the value is auto-clamped to the radio horizon (~11 km at 3m height)
    const val = await page.locator('#maxRadiusKm').inputValue();
    expect(Number(val)).toBeGreaterThanOrEqual(1);
    expect(Number(val)).toBeLessThanOrEqual(50);
  });

  test('#maxRadiusKm label says "Max Radius"', async ({ page }) => {
    await expect(page.locator('label[for="maxRadiusKm"]')).toContainText('Max Radius');
  });

  test('radio horizon hint text is visible', async ({ page }) => {
    // The hint "Radio horizon at X m: Y km max" is rendered inside the coverage panel
    const hint = page.locator('.sidebar-hint', { hasText: /Radio horizon at/ });
    await expect(hint).toBeVisible({ timeout: 5000 });
  });

  test('radio horizon hint contains antenna height and max km', async ({ page }) => {
    const hint = page.locator('.sidebar-hint', { hasText: /Radio horizon at/ });
    await expect(hint).toBeVisible({ timeout: 5000 });
    const text = await hint.textContent();
    // Format: "Radio horizon at X m: Y km max"
    expect(text).toMatch(/Radio horizon at \d+ m: \d+ km max/);
  });

  // ---- Environment setting collapsible ----

  test('"About the global environment setting" collapsible exists', async ({ page }) => {
    const details = page.locator('details.horizon-note').first();
    await expect(details).toBeVisible({ timeout: 5000 });
  });

  test('collapsible summary text is visible', async ({ page }) => {
    const summary = page.locator('details.horizon-note').first().locator('summary');
    await expect(summary).toBeVisible({ timeout: 5000 });
    await expect(summary).toContainText('About the global environment setting');
  });

  test('collapsible is closed by default', async ({ page }) => {
    const details = page.locator('details.horizon-note').first();
    await details.waitFor({ state: 'visible', timeout: 5000 });
    const hasOpen = await details.evaluate((el) => el.hasAttribute('open'));
    expect(hasOpen).toBe(false);
  });

  test('clicking summary opens the collapsible', async ({ page }) => {
    const details = page.locator('details.horizon-note').first();
    await details.waitFor({ state: 'visible', timeout: 5000 });
    await details.locator('summary').click();
    const hasOpen = await details.evaluate((el) => el.hasAttribute('open'));
    expect(hasOpen).toBe(true);
  });

  test('clicking summary again closes the collapsible', async ({ page }) => {
    const details = page.locator('details.horizon-note').first();
    await details.waitFor({ state: 'visible', timeout: 5000 });
    const summary = details.locator('summary');
    await summary.click(); // open
    await summary.click(); // close
    const hasOpen = await details.evaluate((el) => el.hasAttribute('open'));
    expect(hasOpen).toBe(false);
  });

  test('collapsible body describes environment override behaviour', async ({ page }) => {
    const details = page.locator('details.horizon-note').first();
    await details.waitFor({ state: 'visible', timeout: 5000 });
    await details.locator('summary').click();
    const body = details.locator('.horizon-note-body');
    await expect(body).toBeVisible();
    // Body should mention per-node override
    await expect(body).toContainText(/coverage|node|environment/i);
  });

  test('summary is keyboard accessible — Enter toggles open', async ({ page }) => {
    const details = page.locator('details.horizon-note').first();
    await details.waitFor({ state: 'visible', timeout: 5000 });
    const summary = details.locator('summary');
    await summary.focus();
    await expect(summary).toBeFocused();
    await page.keyboard.press('Enter');
    const hasOpen = await details.evaluate((el) => el.hasAttribute('open'));
    expect(hasOpen).toBe(true);
  });

  // ---- Remember checkbox ----

  test('#rememberCoverageSettings checkbox is visible', async ({ page }) => {
    await expect(page.locator('#rememberCoverageSettings')).toBeVisible();
  });

  test('#rememberCoverageSettings is unchecked by default', async ({ page }) => {
    await expect(page.locator('#rememberCoverageSettings')).not.toBeChecked();
  });
});
