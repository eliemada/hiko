import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "demo.spec.ts",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  reporter: "list",
  use: { baseURL: process.env.DEMO_BASE_URL ?? "http://127.0.0.1:4174", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: process.env.DEMO_BASE_URL ? undefined : {
    command: "node scripts/serve-demo.mjs", env: { DEMO_PORT: "4174" },
    url: "http://127.0.0.1:4174", reuseExistingServer: false,
  },
});
