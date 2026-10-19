import { expect, test } from "./fixtures";
import { addPlayers, openGame, ride, startDemoGame } from "./helpers";

test("a ride started too soon is cancelled, the gears changed, then ridden", async ({ page }) => {
  await openGame(page);
  await addPlayers(page, "Léa", "Tom");
  await startDemoGame(page);

  // Cancelled during the countdown: nothing counted, the same rider waits.
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByRole("heading", { name: /Au tour de Léa/ })).toBeVisible();
  await expect(
    page.getByText("Passage annulé, rien n'est compté.", { exact: false }),
  ).toBeVisible();

  // Only how the bike is ridden may change mid-game.
  await page.getByRole("button", { name: "Réglages" }).click();
  await expect(page.getByText("Durée d'un passage")).toHaveCount(0);
  await expect(page.getByText("Nombre de tours")).toHaveCount(0);
  await page.getByRole("button", { name: "Virtuelles" }).click();
  await page.getByRole("button", { name: "Terminé" }).click();

  await page.getByRole("button", { name: "C'est parti !" }).click();
  await expect(page.getByTestId("ride-gear")).toHaveText("vitesse 15/24");
  await page.getByRole("button", { name: "Vitesse plus dure" }).click();
  await expect(page.getByTestId("ride-gear")).toHaveText("vitesse 16/24");
  await ride(page, { durationSec: 30, pedal: false });
  await expect(page.getByRole("button", { name: /Au suivant/ })).toBeVisible();
});

test("a ride cancelled mid-way, then ridden again", async ({ page }) => {
  await openGame(page);
  await addPlayers(page, "Léa", "Tom");
  await startDemoGame(page);
  await page.clock.runFor(5000);
  await expect(page.getByTestId("ride-score")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "C'est parti !" }).click();
  await ride(page, { durationSec: 30, pedal: false });
});
