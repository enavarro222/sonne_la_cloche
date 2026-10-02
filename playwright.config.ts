import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
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
