import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import FitParser from "fit-file-parser";
import { addPlayers, chooseSettings, openGame, ride, startDemoGame } from "./helpers";

test("each player can take their game to Strava from a QR code", async ({ page, context }) => {
  test.setTimeout(150_000);
  await openGame(page);
  await chooseSettings(page, { duration: "20 s", rounds: "3 tours" });
  await addPlayers(page, "Léa", "Tom");
  await startDemoGame(page);
  for (let i = 0; i < 6; i++) {
    await ride(page, { durationSec: 20, pedal: i % 2 === 0 });
    if (i < 5) await page.getByRole("button", { name: /^Au suivant/ }).click();
  }

  // End of the game: one QR code per player.
  await page.getByRole("button", { name: "Strava", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Mets ta partie sur Strava" });
  await expect(dialog.getByRole("img", { name: "Léa, scanne avec ton téléphone" })).toBeVisible();
  await dialog.getByRole("button", { name: "Tom" }).click();
  await expect(dialog.getByRole("img", { name: "Tom, scanne avec ton téléphone" })).toBeVisible();
  await dialog.getByRole("button", { name: "Léa" }).click();
  const link = dialog.getByRole("link", { name: "ou ouvre-la sur cet appareil" });
  const address = await link.getAttribute("href");
  expect(address).toMatch(/\/strava\/#[A-Za-z0-9_-]+$/);

  // The player's page, as their phone would open it.
  const phone = await context.newPage();
  await phone.goto(address ?? "");
  await expect(phone.getByText("Léa", { exact: true })).toBeVisible();
  await expect(phone.getByText(/^1er sur 2 · \d+ points$/)).toBeVisible();
  await expect(phone.getByRole("listitem")).toHaveCount(3);

  const [download] = await Promise.all([
    phone.waitForEvent("download"),
    phone.getByRole("button", { name: "Télécharger le fichier .fit" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^sonne-la-cloche-\d{4}-\d{2}-\d{2}-Lea\.fit$/);
  const bytes = readFileSync(await download.path());
  const fit = await new FitParser({ mode: "list" }).parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  expect(fit.laps).toHaveLength(3);
  expect(fit.sessions?.[0]?.sub_sport).toBe("indoor_cycling");

  // Publishing: Strava's consent page and the server are stood in for.
  let sent: Record<string, string> = {};
  await phone.route("**/api/strava/authorize?**", async (route) => {
    const state = new URL(route.request().url()).searchParams.get("state") ?? "";
    await route.fulfill({ status: 302, headers: { Location: `/strava/?code=ok&state=${state}` } });
  });
  await phone.route("**/api/strava/upload", async (route) => {
    sent = route.request().postDataJSON() as Record<string, string>;
    await route.fulfill({ json: { url: "https://www.strava.com/activities/99" } });
  });
  await phone.getByRole("button", { name: "Publier sur Strava" }).click();
  await expect(phone.getByRole("status")).toContainText("C'est publié sur Strava !");
  await expect(phone.getByRole("link", { name: "Voir l'activité sur Strava" })).toHaveAttribute(
    "href",
    "https://www.strava.com/activities/99",
  );
  expect(sent.name).toBe("🔔 Sonne la cloche !");
  expect(sent.description).toMatch(/^1er sur 2 avec \d+ points en 3 passages\. http/);
  expect(sent.sportType).toBe("Ride");
  expect(
    Buffer.from(sent.file ?? "", "base64")
      .subarray(8, 12)
      .toString(),
  ).toBe(".FIT");
  // Back on the player's page, without the code in the address.
  expect(new URL(phone.url()).search).toBe("");
});

test("a page opened without a game says so", async ({ page }) => {
  await page.goto("/strava/#nothing-here");
  await expect(page.getByText(/Ce lien ne contient pas de partie/)).toBeVisible();
});
