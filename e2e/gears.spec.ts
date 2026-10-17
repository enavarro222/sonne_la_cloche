import { expect, test } from "./fixtures";
import { addPlayers, openGame, startDemoGame } from "./helpers";

test("virtual gears: on from the settings, shifted with + and − during the ride", async ({
  page,
}) => {
  await openGame(page);
  await addPlayers(page, "Léa", "Tom");
  await expect(page.getByTestId("gears-mode")).toContainText("Vitesses du vélo");

  await page.getByTestId("gears-mode").click();
  await page.getByRole("button", { name: "Virtuelles" }).click();
  await page.getByRole("button", { name: "Terminé" }).click();
  await expect(page.getByTestId("gears-mode")).toContainText(
    "Vitesses virtuellesPignon unique 34 × 14",
  );

  await startDemoGame(page);
  // 34 × 14 is closest to virtual gear 15 of 24.
  const gear = page.getByTestId("ride-gear");
  await expect(gear).toHaveText("vitesse 15/24");
  await page.keyboard.press("+");
  await page.keyboard.press("+");
  await expect(gear).toHaveText("vitesse 17/24");
  await page.keyboard.press("-");
  await expect(gear).toHaveText("vitesse 16/24");
});
