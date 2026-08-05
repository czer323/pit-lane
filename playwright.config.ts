import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  timeout: 30_000,
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/serve-mocked-ui.mjs",
    url: "http://127.0.0.1:4174/track_entry.html",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
