import type { CoverageReportOptions } from "monocart-coverage-reports";

/**
 * Coverage of the e2e tests (E2E_COVERAGE=1): Chromium's own V8 coverage,
 * mapped back to src/ through the build's source maps. Each worker adds its
 * pages to a shared cache; the global teardown writes the report.
 */
export const E2E_COVERAGE = !!process.env.E2E_COVERAGE;

export const coverageOptions: CoverageReportOptions = {
  name: "e2e coverage",
  outputDir: "coverage/e2e",
  reports: ["lcovonly", "console-summary"],
  // The game's own bundles only, and only our sources inside them.
  entryFilter: (entry) => entry.url.includes("/assets/"),
  // Paths as Codecov expects them (src/…). Dependencies keep theirs: they
  // have a src/ of their own (node_modules/…/src/), and are filtered out.
  sourcePath: (filePath) => {
    if (filePath.includes("node_modules")) return filePath;
    const at = filePath.lastIndexOf("src/");
    return at === -1 ? filePath : filePath.slice(at);
  },
  sourceFilter: (sourcePath) => sourcePath.startsWith("src/"),
};
