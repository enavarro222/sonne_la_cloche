import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  // Only does something with E2E_COVERAGE set (see e2e/coverage.ts).
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: true,
  // A demo ride pedals key by key, each step rendering its frames (the
  // drawings' SVG filters): run side by side, the CPU-bound ones take three
  // or four times as long as alone. Fewer at once locally, and more time.
  workers: process.env.CI ? undefined : 3,
  timeout: 90_000,
  forbidOnly: !!process.env.CI,
  // Shared CI runners are slower and noisier: one retry absorbs a stray timeout.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: URL,
    locale: "fr-FR",
    trace: "retain-on-failure",
  },
  // The two target screens of the MVP.
  projects: [
    { name: "tablet", use: { ...devices["Galaxy Tab S4 landscape"] } },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } },
    },
  ],
  // Tests run against the production build, as served in real life.
  webServer: {
    command: `pnpm build && pnpm preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: URL,
    reuseExistingServer: !process.env.CI,
  },
});
