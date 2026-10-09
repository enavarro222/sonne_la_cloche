import type { Locator } from "@playwright/test";
import { expect, test } from "./fixtures";
import { addPlayers, openGame } from "./helpers";

async function centre(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("not on screen");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test("players: drag to reorder, tap for other colours, remove with the pin", async ({ page }) => {
  await openGame(page);
  await addPlayers(page, "Léa", "Tom", "Zoé");
  const names = () => page.locator("li[class*=rider] [class*=riderName]").allTextContents();
  expect(await names()).toEqual(["Léa", "Tom", "Zoé"]);
  await expect(page.getByRole("button", { name: /C'est parti/ })).toContainText("Léa");

  // Zoé's sheet dropped on Léa's: she rides first.
  const sheet = (name: string) => page.locator("li[class*=rider]").filter({ hasText: name });
  const from = await centre(sheet("Zoé"));
  const to = await centre(sheet("Léa"));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x - 20, from.y, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(names).toEqual(["Zoé", "Léa", "Tom"]);
  await expect(page.getByRole("button", { name: /C'est parti/ })).toContainText("Zoé");
  // Remembered after a reload.
  await page.reload();
  await expect.poll(names).toEqual(["Zoé", "Léa", "Tom"]);

  // A tap on the cyclist: the next colours nobody wears.
  const swatch = sheet("Léa").locator("[class*=swatch]");
  const before = await swatch.getAttribute("style");
  await page.getByRole("button", { name: "Changer les couleurs de Léa" }).click();
  await expect(swatch).not.toHaveAttribute("style", before ?? "");

  await page.getByRole("button", { name: "Retirer Tom" }).click();
  await expect.poll(names).toEqual(["Zoé", "Léa"]);
});
