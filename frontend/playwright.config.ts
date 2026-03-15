/**
 * Playwright Configuration for Integration Tests
 * See https://playwright.dev/docs/test-configuration
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/integration',

  /* Global setup for MSW */
  globalSetup: './tests/integration/setup.ts',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI (2x) and locally (1x) to absorb server-start race conditions */
  retries: process.env.CI ? 2 : 1,

  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use */
  reporter: 'html',

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: 'http://localhost:5173',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            // Disable session-restore to prevent _maybeDontRestoreTabs protocol
            // crash that occurs when Firefox tries to restore windows during
            // parallel test teardown.
            'browser.sessionstore.resume_from_crash': false,
            'browser.sessionstore.max_tabs_undo': 0,
            'browser.sessionstore.max_windows_undo': 0,
          },
        },
      },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
