import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "demo.spec.ts",
  timeout: 120_000,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    actionTimeout: 15_000,
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3123",
    viewport: { width: 1440, height: 960 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    timezoneId: "Asia/Tokyo",
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: "node scripts/e2e-server.mjs",
    url: "http://127.0.0.1:3123/api/health",
    timeout: 240_000,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
  },
  outputDir: process.env.E2E_OUT ?? "test-results",
});
