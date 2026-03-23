/**
 * Playwright integration tests for Coverage Hatch Mode toggle.
 * Runs against the live dev server.
 */

import { test, expect } from '@playwright/test';

test.describe('Coverage Hatch Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.toolbar');

    // Dismiss WelcomeTour overlay if present
    const overlay = page.locator('.tour-overlay');
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await overlay.click({ position: { x: 5, y: 5 } });
      await overlay.waitFor({ state: 'hidden', timeout: 3000 });
    }
  });

  async function openToolsMenu(page: import('@playwright/test').Page) {
    const toolsBtn = page.locator('.toolbar-menu-btn', { hasText: 'Tools' });
    await toolsBtn.click();
    await page.waitForSelector('.toolbar-dropdown');
  }

  test('Tools menu contains "Coverage Hatch Mode" item', async ({ page }) => {
    await openToolsMenu(page);
    const item = page.locator('.toolbar-dropdown-item', { hasText: 'Coverage Hatch Mode' });
    await expect(item).toBeVisible();
  });

  test('Coverage Hatch Mode item has a tooltip', async ({ page }) => {
    await openToolsMenu(page);
    const item = page.locator('.toolbar-dropdown-item', { hasText: 'Coverage Hatch Mode' });
    const title = await item.getAttribute('title');
    expect(title).toBeTruthy();
    expect(title!.length).toBeGreaterThan(10);
  });

  test('Coverage Hatch Mode appears after Elevation Heatmap in the menu', async ({ page }) => {
    await openToolsMenu(page);
    const items = page.locator('.toolbar-dropdown-item');
    const texts = await items.allTextContents();
    const elevationIdx = texts.findIndex((t) => t.includes('Elevation Heatmap'));
    const hatchIdx = texts.findIndex((t) => t.includes('Coverage Hatch Mode'));
    expect(elevationIdx).toBeGreaterThanOrEqual(0);
    expect(hatchIdx).toBeGreaterThan(elevationIdx);
  });

  test('clicking toggle shows checkmark', async ({ page }) => {
    await openToolsMenu(page);
    const item = page.locator('.toolbar-dropdown-item', { hasText: 'Coverage Hatch Mode' });
    await item.click();

    // Re-open the menu to inspect the updated label
    await openToolsMenu(page);
    const updatedItem = page.locator('.toolbar-dropdown-item', { hasText: 'Coverage Hatch Mode' });
    await expect(updatedItem).toContainText('✓');
  });

  test('clicking toggle twice removes checkmark', async ({ page }) => {
    // Toggle on
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Coverage Hatch Mode' }).click();

    // Toggle off
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Coverage Hatch Mode' }).click();

    // Re-open and verify no checkmark
    await openToolsMenu(page);
    const item = page.locator('.toolbar-dropdown-item', { hasText: 'Coverage Hatch Mode' });
    const text = await item.textContent();
    expect(text).not.toContain('✓');
  });

  test('Elevation Heatmap toggle is independent of Coverage Hatch Mode', async ({ page }) => {
    // Enable Coverage Hatch Mode
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Coverage Hatch Mode' }).click();

    // Toggle Elevation Heatmap
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();

    // Coverage Hatch Mode should still be checked
    await openToolsMenu(page);
    const hatchItem = page.locator('.toolbar-dropdown-item', { hasText: 'Coverage Hatch Mode' });
    await expect(hatchItem).toContainText('✓');
  });

  test('toggle is keyboard accessible from Tools menu', async ({ page }) => {
    await openToolsMenu(page);

    // Tab through menu items until Coverage Hatch Mode is focused
    const item = page.locator('.toolbar-dropdown-item', { hasText: 'Coverage Hatch Mode' });
    await item.focus();
    await expect(item).toBeFocused();

    // Activate with Enter
    await page.keyboard.press('Enter');

    // Re-open and verify checkmark
    await openToolsMenu(page);
    const updated = page.locator('.toolbar-dropdown-item', { hasText: 'Coverage Hatch Mode' });
    await expect(updated).toContainText('✓');
  });

  test('toggle is accessible via Space key', async ({ page }) => {
    await openToolsMenu(page);
    const item = page.locator('.toolbar-dropdown-item', { hasText: 'Coverage Hatch Mode' });
    await item.focus();
    await page.keyboard.press(' ');

    await openToolsMenu(page);
    const updated = page.locator('.toolbar-dropdown-item', { hasText: 'Coverage Hatch Mode' });
    await expect(updated).toContainText('✓');
  });
});
