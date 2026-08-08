import { defineConfig } from "@playwright/test";

/**
 * Real-app e2e config: targets the LOCAL dev server (layer 1).
 *
 * Run with: pnpm test:e2e --config=playwright.auth.config.ts
 * Requires the dev server running: vp dev
 */
export default defineConfig({
  testDir: "tests/auth",
  timeout: 60_000,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
});
