import { expect, type Page, test } from "@playwright/test";
import { addPlayers, openGame, resultPoints, startDemoGame } from "./helpers";

// Mirrors the countdown in src/ui/RideScreen.tsx (3 × 800 ms + 450 ms).
const COUNTDOWN_MS = 3 * 800 + 450;
const DURATION_SEC = 20;

/**
 * One ride in demo mode at a steady rhythm, pedaling from the countdown on:
 * on a slope, the countdown is the run-up.
 */
async function rideAt(page: Page, stepMs: number): Promise<void> {
  const totalMs = COUNTDOWN_MS + DURATION_SEC * 1000 + 500;
  for (let t = 0, i = 0; t < totalMs; t += stepMs, i++) {
    await page.keyboard.press(i % 2 ? "ArrowRight" : "ArrowLeft");
    await page.clock.runFor(stepMs);
  }
  await expect(page.getByRole("heading", { name: "Classement" })).toBeVisible();
}

const percentOf = async (page: Page) =>
  Number(
    (await page.getByTestId("ride-grade").textContent())?.replace(/[^\d,]/g, "").replace(",", "."),
  );

test("by default, each their own slope: round 1 measures, then the stronger climbs", async ({
  page,
}) => {
  // Four 20 s rides with a key press every few frames.
  test.setTimeout(120_000);
  await openGame(page, "/fr/", { defaults: true });
  await addPlayers(page, "Léa", "Tom");
  await page.getByRole("button", { name: "Réglages" }).click();
  // The default: distance, each on their own slope.
  await expect(page.getByRole("button", { name: "Distance" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Chacun sa pente" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "20 s", exact: true }).click();
  await page.getByRole("button", { name: "3 tours", exact: true }).click();
  await page.getByRole("button", { name: "Terminé" }).click();
  await startDemoGame(page);

  // Round 1 measures everyone, on the common slope.
  await expect(page.getByText("On mesure ton niveau")).toBeVisible();
  expect(await percentOf(page)).toBe(0);
  await rideAt(page, 260); // Léa, gently
  await page.getByRole("button", { name: /Tom/ }).click();
  await rideAt(page, 140); // Tom, harder
  // Who rides next, and on what slope.
  await expect(page.locator("p").filter({ hasText: "Au suivant" })).toContainText(
    "sur une pente de 0 %",
  );

  // Round 2: Léa, the weakest, stays flat; Tom climbs.
  await page.getByRole("button", { name: /Léa/ }).click();
  await expect(page.getByText("On mesure ton niveau")).toBeHidden();
  await expect(page.getByRole("meter")).toBeVisible();
  expect(await percentOf(page)).toBe(0);
  await rideAt(page, 260);
  const lea = await resultPoints(page);

  await page.getByRole("button", { name: /Tom/ }).click();
  expect(await percentOf(page)).toBeGreaterThan(0.5);
  await rideAt(page, 140);
  const tom = await resultPoints(page);

  // At their own level, both cover about the same distance.
  expect(tom / lea).toBeGreaterThan(0.85);
  expect(tom / lea).toBeLessThan(1.15);
});
