/**
 * Playwright config (F2-10).
 *
 * Single happy-path E2E test for the Phase 2 Web collaboration beta.
 * Targets chromium only to limit CI flakiness; the SSE-driven UI
 * assertion depends on a real browser EventSource, so jsdom-style
 * unit tests are not sufficient.
 *
 * `webServer` launches `pnpm dev` (Next.js) on port 3000 and waits
 * for the URL to respond. In CI the server is not reused; locally
 * we keep it running between test runs.
 */

import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  testIgnore: "**/global-setup.ts",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  expect: { timeout: 10_000 },
  webServer: {
    command: "pnpm dev",
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
