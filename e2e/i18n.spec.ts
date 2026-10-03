import { expect, test } from "./fixtures";
import { addPlayers, openGame, startDemoGame } from "./helpers";

for (const [locale, path, title] of [
  ["en-US", "/en/", "Ring the Bell!"],
  ["fr-FR", "/fr/", "Sonne la cloche !"],
  ["de-DE", "/fr/", "Sonne la cloche !"],
] as const) {
  test.describe(`browser in ${locale}`, () => {
    test.use({ locale });
    test(`the root page redirects to ${path}`, async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL(path);
      await expect(page).toHaveTitle(title);
    });
  });
}

test("a bookmarked language wins over the browser language", async ({ page }) => {
  await page.goto("/en/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Who pedals the hardest?" })).toBeVisible();
  await expect(page.getByText("Joueurs")).toHaveCount(0);
});

test("switching language keeps the game going, without reloading", async ({ page }) => {
  await openGame(page);
  await addPlayers(page, "Léa", "Tom");
  await startDemoGame(page);
  await expect(page.getByText("Au tour de Léa")).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { marker: boolean }).marker = true;
  });

  await page.getByRole("link", { name: "EN" }).click();
  await expect(page).toHaveURL("/en/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle("Ring the Bell!");
  await expect(page.getByText("Léa's turn")).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL("/fr/");
  await expect(page.getByText("Au tour de Léa")).toBeVisible();

  // Same page instance: nothing was reloaded, the bike stays connected.
  expect(await page.evaluate(() => (window as unknown as { marker?: boolean }).marker)).toBe(true);
});
