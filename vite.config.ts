import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const page = (path: string) => resolve(import.meta.dirname, path);

export default defineConfig({
  plugins: [react()],
  // One static page per language (/fr/, /en/) plus a root page that redirects:
  // no server rewrite rule needed wherever the build is hosted.
  appType: "mpa",
  build: {
    rollupOptions: {
      input: {
        root: page("index.html"),
        fr: page("fr/index.html"),
        en: page("en/index.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
  },
});
