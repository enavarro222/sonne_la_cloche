import { test as base, type Page } from "@playwright/test";
import MCR from "monocart-coverage-reports";
import { coverageOptions, E2E_COVERAGE } from "./coverage";

export { expect } from "@playwright/test";

/** Every e2e test, measuring the code its pages run when E2E_COVERAGE is set. */
export const test = base.extend<{ coverage: undefined }>({
  coverage: [
    async ({ context }, use) => {
      if (!E2E_COVERAGE) {
        await use(undefined);
        return;
      }
      // Pages opened during the test (a phone, a new tab) count too.
      const pages = new Set<Page>();
      const track = (page: Page) => {
        pages.add(page);
        void page.coverage.startJSCoverage({ resetOnNavigation: false }).catch(() => undefined);
      };
      context.pages().forEach(track);
      context.on("page", track);
      await use(undefined);
      const mcr = MCR(coverageOptions);
      for (const page of pages) {
        // A page closed by the test (a tab that closes itself) took its coverage with it.
        const entries = await page.coverage.stopJSCoverage().catch(() => null);
        if (entries) await mcr.add(entries);
      }
    },
    { auto: true },
  ],
});
