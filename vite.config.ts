import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const page = (path: string) => resolve(import.meta.dirname, path);
const { version } = JSON.parse(readFileSync(page("package.json"), "utf8")) as { version: string };

export default defineConfig({
  plugins: [react()],
  // package.json's version, shown discreetly on the home screen.
  define: { __APP_VERSION__: JSON.stringify(version) },
  // One static page per language (/fr/, /en/) plus a root page that redirects:
  // no server rewrite rule needed wherever the build is hosted.
  appType: "mpa",
  build: {
    // Source maps let the e2e coverage point back to src/ (E2E_COVERAGE=1).
    sourcemap: !!process.env.E2E_COVERAGE,
    rollupOptions: {
      input: {
        root: page("index.html"),
        fr: page("fr/index.html"),
        en: page("en/index.html"),
        strava: page("strava/index.html"),
        feedback: page("feedback/index.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/**/*.d.ts"],
      reporter: ["text-summary", "lcov"],
    },
  },
});
