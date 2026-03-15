/**
 * Playwright integration tests for coverage settings UI.
 * Verifies max radius input, remember checkbox, and stale settings warning.
 *
 * #maxRadiusKm and #rememberCoverageSettings live inside the plan panel and
 * are only rendered when a plan is open, so every test opens a plan first.
 *
 * POST /api/plans is mocked so tests run without a live backend.
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_PLAN = {
  id: 'test-plan-coverage-1',
  name: 'Test Plan',
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

/**
 * Open Plan menu → New Plan → confirm name dialog → wait for coverage panel.
 * Requires that POST /api/plans is already mocked by the caller.
 */
async function openNewPlan(page: Page) {
  // aria-hidden arrow span is excluded from accessible name, so exact match works
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await page.waitForSelector('.toolbar-dropdown', { timeout: 3000 });
  await page.locator('.toolbar-dropdown-item').filter({ hasText: 'New Plan' }).click();

  // PromptDialog always appears for New Plan — wait deterministically and click OK
  await page.waitForSelector('.prompt-dialog-ok', { timeout: 5000 });
  await page.locator('.prompt-dialog-ok').click();

  // Wait for the coverage input to confirm the plan was created and panel rendered
  await page.waitForSelector('#maxRadiusKm', { timeout: 10000 });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

test.describe('Coverage Settings', () => {
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

    // Each test gets a fresh browser context, so localStorage starts empty.
    // No addInitScript needed.
    await page.goto('/');
    await page.waitForSelector('.toolbar');
    await dismissTour(page);

    // Open a plan so coverage settings are visible
    await openNewPlan(page);
  });

  // ---- Max radius input ----

  test('max radius input is visible in sidebar with a numeric default', async ({ page }) => {
    // With no nodes, the value is clamped to the radio horizon cap (~11 km at 3m height)
    const input = page.locator('#maxRadiusKm');
    await expect(input).toBeVisible();
    const val = await input.inputValue();
    expect(Number(val)).toBeGreaterThanOrEqual(1);
    expect(Number(val)).toBeLessThanOrEqual(50);
  });

  test('max radius input accepts values within the horizon cap', async ({ page }) => {
    // Use 8 km — well within the ~11 km horizon at 3m antenna height
    const input = page.locator('#maxRadiusKm');
    await input.fill('8');
    await input.press('Enter');
    await expect(input).toHaveValue('8');
  });

  test('radio horizon hint is visible in coverage panel', async ({ page }) => {
    const hint = page.locator('.sidebar-hint', { hasText: /Radio horizon at/ });
    await expect(hint).toBeVisible();
  });

  test('max radius input commits value on Enter', async ({ page }) => {
    // 6 km is within the ~11 km horizon cap at default 3m antenna height
    const input = page.locator('#maxRadiusKm');
    await input.fill('6');
    await input.press('Enter');
    await expect(input).toHaveValue('6');
  });

  // ---- Remember checkbox ----

  test('remember checkbox is present and unchecked by default', async ({ page }) => {
    const checkbox = page.locator('#rememberCoverageSettings');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();
  });

  test('checking remember persists settings to localStorage', async ({ page }) => {
    // Use 8 km — within the ~11 km horizon cap at default 3m antenna height
    const input = page.locator('#maxRadiusKm');
    await input.fill('8');
    await input.press('Enter');
    await page.locator('#rememberCoverageSettings').check();

    const saved = await page.evaluate(() => localStorage.getItem('meshPlanner_coverageSettings'));
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(parsed.maxRadiusKm).toBe(8);
  });

  test('unchecking remember removes settings from localStorage', async ({ page }) => {
    // Enable remember with a specific value
    await page.locator('#maxRadiusKm').fill('20');
    await page.locator('#rememberCoverageSettings').check();

    let saved = await page.evaluate(() => localStorage.getItem('meshPlanner_coverageSettings'));
    expect(saved).not.toBeNull();

    // Uncheck — should clear localStorage immediately
    await page.locator('#rememberCoverageSettings').uncheck();

    saved = await page.evaluate(() => localStorage.getItem('meshPlanner_coverageSettings'));
    expect(saved).toBeNull();
  });

  test('saved radius is restored on page reload', async ({ page }) => {
    // Use 8 km — within the ~11 km horizon cap at default 3m antenna height
    await page.locator('#maxRadiusKm').fill('8');
    await page.locator('#maxRadiusKm').press('Enter');
    await page.locator('#rememberCoverageSettings').check();

    // Verify saved to localStorage
    const saved = await page.evaluate(() => localStorage.getItem('meshPlanner_coverageSettings'));
    expect(saved).not.toBeNull();

    // Reload — React re-mounts and reads localStorage (route mocks persist across reload)
    await page.reload();
    await page.waitForSelector('.toolbar');
    await dismissTour(page);
    await openNewPlan(page);

    await expect(page.locator('#maxRadiusKm')).toHaveValue('8');
    await expect(page.locator('#rememberCoverageSettings')).toBeChecked();
  });

  // ---- Accessibility ----

  test('max radius input has accessible label', async ({ page }) => {
    const label = page.locator('label[for="maxRadiusKm"]');
    await expect(label).toBeVisible();
    await expect(label).toContainText('Max Radius');
  });
});
