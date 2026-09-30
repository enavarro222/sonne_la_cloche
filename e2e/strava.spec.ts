import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import FitParser from "fit-file-parser";
import { addPlayers, chooseSettings, openGame, ride, startDemoGame } from "./helpers";

test("each player takes their game to their phone, and to Strava", async ({ page, context }) => {
  test.setTimeout(150_000);
  // Demo games offer Strava only in test mode.
  await openGame(page, "/fr/?dev");
  await chooseSettings(page, { duration: "20 s", rounds: "3 tours" });
  await addPlayers(page, "Léa", "Tom");
  await startDemoGame(page);
  for (let i = 0; i < 6; i++) {
    await ride(page, { durationSec: 20, pedal: i % 2 === 0 });
    if (i < 5) await page.getByRole("button", { name: /^Au suivant/ }).click();
  }

  // End of the game: one QR code per player.
  await page.getByRole("button", { name: "📱 Sur vos téléphones" }).click();
  const dialog = page.getByRole("dialog", { name: "Chacun récupère sa partie" });
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

  // Without the Strava server (a local copy of the game), only the download.
  await expect(phone.getByText(/^Importe-le ensuite sur strava\.com/)).toBeVisible();
  await expect(phone.getByRole("button", { name: "Publier sur Strava" })).toBeHidden();
  // With it, publishing too.
  await context.route("**/api/strava/status", (route) =>
    route.fulfill({ json: { configured: true } }),
  );
  await phone.reload();
  await expect(phone.getByRole("button", { name: "Publier sur Strava" })).toBeVisible();
  await expect(phone.getByText(/^Importe-le ensuite/)).toBeHidden();
  await expect(phone.getByText("Léa", { exact: true })).toBeVisible();
  await expect(phone.getByText(/^1er sur 2 · \d+ points$/)).toBeVisible();
  await expect(phone.getByRole("listitem")).toHaveCount(3);

  // The same results picture as the tablet's, redrawn from the link.
  const picture = phone.getByRole("img", {
    name: "Résultats de la partie : classement et récompenses",
  });
  await expect(picture).toBeVisible();
  expect(await picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1080);
  const [image] = await Promise.all([
    phone.waitForEvent("download"),
    phone.getByRole("button", { name: "Partager l'image" }).click(),
  ]);
  expect(image.suggestedFilename()).toBe("sonne-la-cloche.png");

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
  expect(fit.sessions?.[0]?.sub_sport).toBe("virtual_activity");

  // Publishing: Strava's consent page and the server are stood in for.
  let sent: Record<string, string> = {};
  let returnedState = "";
  await phone.route("**/api/strava/authorize?**", async (route) => {
    returnedState = new URL(route.request().url()).searchParams.get("state") ?? "";
    await route.fulfill({
      status: 302,
      headers: { Location: `/strava/?code=ok&state=${encodeURIComponent(returnedState)}` },
    });
  });
  await phone.route("**/api/strava/upload", async (route) => {
    sent = route.request().postDataJSON() as Record<string, string>;
    await route.fulfill({ json: { url: "https://www.strava.com/activities/99" } });
  });
  await phone.getByRole("button", { name: "Publier sur Strava" }).click();
  await expect(
    phone.getByRole("status").filter({ hasText: "C'est publié sur Strava !" }),
  ).toBeVisible();
  await expect(phone.getByRole("link", { name: "Voir l'activité sur Strava" })).toHaveAttribute(
    "href",
    "https://www.strava.com/activities/99",
  );
  expect(sent.name).toBe("🔔 Sonne la cloche !");
  expect(sent.description).toMatch(/^1er sur 2 avec \d+ points en 3 passages\. http/);
  expect(sent.sportType).toBe("VirtualRide");
  expect(
    Buffer.from(sent.file ?? "", "base64")
      .subarray(8, 12)
      .toString(),
  ).toBe(".FIT");
  // Back on the player's page, without the code in the address.
  expect(new URL(phone.url()).search).toBe("");

  // Strava's app sends people back in a new tab or browser: that works too.
  const other = await context.newPage();
  await other.route("**/api/strava/upload", async (route) => {
    await route.fulfill({ json: { url: "https://www.strava.com/activities/100" } });
  });
  await other.goto(`/strava/?code=ok&state=${encodeURIComponent(returnedState)}`);
  await expect(other.getByRole("status")).toContainText("C'est publié sur Strava !");
  await expect(other.getByText("Léa", { exact: true })).toBeVisible();

  // A server without Strava credentials sends people back with a clear message.
  const unset = await context.newPage();
  await unset.goto(`/strava/?error=not_configured&state=${encodeURIComponent(returnedState)}`);
  await expect(unset.getByRole("status")).toContainText("pas encore configurée");
  await expect(unset.getByRole("button", { name: "Télécharger le fichier .fit" })).toBeVisible();
});

test("a page opened without a game says so", async ({ page }) => {
  await page.goto("/strava/#nothing-here");
  await expect(page.getByText(/Ce lien ne contient pas de partie/)).toBeVisible();
});
