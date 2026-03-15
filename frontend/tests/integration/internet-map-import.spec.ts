/**
 * Playwright integration tests for the Internet Map Import feature.
 *
 * Covers:
 * - "Import Nodes (Internet)" menu item visibility and disabled state
 * - Offline guard: ping endpoint returning {online:false} disables the button
 * - Online guard: ping endpoint returning {online:true} leaves button enabled
 * - Modal opens when button is clicked while online
 * - Modal shows MeshCore source card and Fetch Nodes button
 * - Fetch: intercept internet-map API to return mock nodes
 * - Modal shows node count and node list
 *
 * All external network calls are intercepted via Playwright route mocking
 * so tests are fully offline-capable.
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function dismissTour(page: Page) {
  const overlay = page.locator('.tour-overlay');
  if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
    await overlay.click({ position: { x: 5, y: 5 } });
    await overlay.waitFor({ state: 'hidden', timeout: 3000 });
  }
}

/** Open the Plan dropdown in the toolbar. */
async function openPlanMenu(page: Page) {
  await page.locator('.toolbar-menu-btn').filter({ hasText: 'Plan' }).first().click();
  await page.waitForSelector('.toolbar-dropdown', { timeout: 3000 });
}

const MOCK_NODES = [
  { name: 'Node Alpha', lat: 25.1, lon: -80.2, description: 'Type: Repeater' },
  { name: 'Node Beta', lat: 25.2, lon: -80.3, description: 'Type: Client' },
  { name: 'Node Gamma', lat: 25.3, lon: -80.4, description: '' },
];

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  // Always mock the ping endpoint — tests control online/offline per describe block
  await page.route('**/api/import/internet-map/ping', (route) =>
    route.fulfill({ json: { online: true } })
  );

  await page.goto('/');
  await page.waitForSelector('.toolbar', { timeout: 10000 });
  await dismissTour(page);
});

// ---------------------------------------------------------------------------
// Menu item structure
// ---------------------------------------------------------------------------

test.describe('Plan menu — Import Nodes (Internet) item', () => {
  test('Import Nodes (Internet) is visible in the Plan menu', async ({ page }) => {
    await openPlanMenu(page);
    const btn = page.locator('button').filter({ hasText: /Import Nodes \(Internet\)/ });
    await expect(btn).toBeVisible();
  });

  test('Import Nodes (Internet) is disabled when no plan is open', async ({ page }) => {
    await openPlanMenu(page);
    const btn = page.locator('button').filter({ hasText: /Import Nodes \(Internet\)/ });
    // No plan open → button has "disabled" CSS class (not the HTML disabled attr)
    await expect(btn).toHaveClass(/disabled/);
  });
});

// ---------------------------------------------------------------------------
// Offline guard — ping returns {online: false}
// ---------------------------------------------------------------------------

test.describe('Offline guard', () => {
  test('button shows "(offline)" suffix when ping returns offline', async ({ page }) => {
    // Override the mock to return offline
    await page.route('**/api/import/internet-map/ping', (route) =>
      route.fulfill({ json: { online: false } })
    );

    await page.reload();
    await page.waitForSelector('.toolbar', { timeout: 10000 });
    await dismissTour(page);

    // Wait for the ping to resolve (AppLayout useEffect sets state)
    await page.waitForTimeout(500);

    await openPlanMenu(page);
    const btn = page.locator('button').filter({ hasText: /Import Nodes \(Internet\).*\(offline\)/ });
    await expect(btn).toBeVisible();
  });

  test('button has "disabled" class when ping returns offline', async ({ page }) => {
    await page.route('**/api/import/internet-map/ping', (route) =>
      route.fulfill({ json: { online: false } })
    );

    await page.reload();
    await page.waitForSelector('.toolbar', { timeout: 10000 });
    await dismissTour(page);
    await page.waitForTimeout(500);

    await openPlanMenu(page);
    const btn = page.locator('button').filter({ hasText: /Import Nodes \(Internet\)/ });
    await expect(btn).toHaveClass(/disabled/);
  });

  test('button has offline tooltip when ping returns offline', async ({ page }) => {
    await page.route('**/api/import/internet-map/ping', (route) =>
      route.fulfill({ json: { online: false } })
    );

    await page.reload();
    await page.waitForSelector('.toolbar', { timeout: 10000 });
    await dismissTour(page);
    await page.waitForTimeout(500);

    await openPlanMenu(page);
    const btn = page.locator('button').filter({ hasText: /Import Nodes \(Internet\)/ });
    await expect(btn).toHaveAttribute('title', /No internet connection/);
  });
});

// ---------------------------------------------------------------------------
// Online guard — ping returns {online: true}
// ---------------------------------------------------------------------------

test.describe('Online guard', () => {
  test('button does NOT have "(offline)" suffix when online', async ({ page }) => {
    await page.waitForTimeout(400); // let ping resolve
    await openPlanMenu(page);
    const btn = page.locator('button').filter({ hasText: /Import Nodes \(Internet\)/ }).first();
    const text = await btn.textContent();
    expect(text).not.toContain('(offline)');
  });

  test('button does NOT have "disabled" class solely from offline when online', async ({ page }) => {
    await page.waitForTimeout(400);
    await openPlanMenu(page);
    const btn = page.locator('button').filter({ hasText: /Import Nodes \(Internet\)/ }).first();
    const cls = await btn.getAttribute('class') ?? '';
    // May be disabled due to no plan, but NOT due to offline flag — verify no "(offline)" text
    const text = await btn.textContent();
    expect(text).not.toContain('offline');
    // Confirm the offline-specific tooltip is absent
    const title = await btn.getAttribute('title');
    expect(title).not.toMatch(/No internet connection/);
  });
});

// ---------------------------------------------------------------------------
// Modal opens when a plan is active (intercept plans API for reliability)
// ---------------------------------------------------------------------------

const MOCK_PLAN = {
  id: 'test-plan-import-1',
  name: 'Import Test Plan',
  description: '',
  firmware_family: 'meshtastic',
  region: 'us_fcc',
  file_path: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

test.describe('Internet Map Import Modal', () => {
  test.beforeEach(async ({ page }) => {
    // Mock plan creation so opening a new plan works without a live backend
    await page.route('**/api/plans', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ json: MOCK_PLAN });
      } else {
        route.continue();
      }
    });

    // Intercept the internet-map data endpoint to return controlled nodes
    await page.route('**/api/import/internet-map*', (route) => {
      if (route.request().url().includes('ping')) {
        route.fulfill({ json: { online: true } });
        return;
      }
      route.fulfill({
        json: {
          source: 'meshcore',
          nodes: MOCK_NODES,
          count: MOCK_NODES.length,
        },
      });
    });

    // Open a new plan so the Import Nodes (Internet) button is enabled
    await page.getByRole('button', { name: 'Plan', exact: true }).click();
    await page.waitForSelector('.toolbar-dropdown', { timeout: 3000 });
    await page.locator('.toolbar-dropdown-item').filter({ hasText: 'New Plan' }).click();
    // PromptDialog always appears for New Plan — wait deterministically and click OK
    await page.waitForSelector('.prompt-dialog-ok', { timeout: 5000 });
    await page.locator('.prompt-dialog-ok').click();
    await page.waitForSelector('.app-sidebar', { timeout: 10000 });
  });

  /** Open Plan menu and click Import Nodes (Internet). */
  async function openImportModal(page: import('@playwright/test').Page) {
    await openPlanMenu(page);
    await page.locator('button').filter({ hasText: /Import Nodes \(Internet\)/ }).first().click();
    await page.locator('.imim-overlay').waitFor({ state: 'visible', timeout: 5000 });
  }

  test('modal shows MeshCore Map card', async ({ page }) => {
    await openImportModal(page);
    await expect(page.locator('.imim-overlay')).toContainText('MeshCore Map');
  });

  test('modal has Fetch Nodes button in phase 1', async ({ page }) => {
    await openImportModal(page);
    await expect(page.locator('button').filter({ hasText: /Fetch Nodes/i })).toBeVisible();
  });

  test('modal title says "Import Nodes — MeshCore Map"', async ({ page }) => {
    await openImportModal(page);
    await expect(page.locator('.imim-title')).toContainText('Import Nodes — MeshCore Map');
  });

  test('fetching nodes shows node list table with correct count', async ({ page }) => {
    await openImportModal(page);
    await page.locator('button').filter({ hasText: /Fetch Nodes/i }).click();
    await page.waitForSelector('.imim-table', { timeout: 10000 });
    await expect(page.locator('.imim-table')).toBeVisible();
    await expect(page.locator('.imim-count-badge')).toContainText(`${MOCK_NODES.length} nodes found`);
  });

  test('node names appear in the table after fetch', async ({ page }) => {
    await openImportModal(page);
    await page.locator('button').filter({ hasText: /Fetch Nodes/i }).click();
    await page.waitForSelector('.imim-table', { timeout: 10000 });
    await expect(page.locator('.imim-table')).toContainText('Node Alpha');
    await expect(page.locator('.imim-table')).toContainText('Node Beta');
  });

  test('X button closes the modal', async ({ page }) => {
    await openImportModal(page);
    await page.locator('button[title="Close"]').click();
    await expect(page.locator('.imim-overlay')).not.toBeVisible();
  });
});
