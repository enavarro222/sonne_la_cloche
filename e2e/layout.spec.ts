import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { addPlayers, openGame, ride, startDemoGame } from "./helpers";

// A full party: 8 children with long names.
const PLAYERS = [
  "Anne-Charlotte",
  "Maximilien",
  "Léa",
  "Tom",
  "Jean-Baptiste",
  "Zoé",
  "Marguerite",
  "Sam",
];

/** Everything fits in the screen: no page scroll, no clipped main area. */
async function expectFitsScreen(page: Page) {
  const overflow = await page.evaluate(() => {
    const main = document.querySelector("main");
    return {
      pageX: document.documentElement.scrollWidth - innerWidth,
      pageY: document.documentElement.scrollHeight - innerHeight,
      mainY: main ? main.scrollHeight - main.clientHeight : 0,
    };
  });
  expect(overflow).toEqual({ pageX: 0, pageY: 0, mainY: 0 });
}

test("every screen fits a full party without scrolling", async ({ page }) => {
  await openGame(page);
  await addPlayers(page, ...PLAYERS);
  await expectFitsScreen(page);

  await startDemoGame(page);
  await expect(page.getByText("Au tour d'Anne-Charlotte")).toBeVisible();
  await expectFitsScreen(page);

  await ride(page, { durationSec: 30, pedal: true });
  await expectFitsScreen(page);
});

test("the settings screen fits", async ({ page }) => {
  await openGame(page);
  await page.getByRole("button", { name: /Réglages/ }).click();
  await expectFitsScreen(page);
});

test("touch targets are at least 44px", async ({ page }) => {
  await openGame(page);
  await addPlayers(page, "Léa", "Tom");
  const small = await page
    .getByRole("button")
    .evaluateAll(
      (buttons) =>
        buttons
          .map((b) => b.getBoundingClientRect())
          .filter((r) => r.width > 0 && (r.width < 44 || r.height < 44)).length,
    );
  expect(small).toBe(0);
});
