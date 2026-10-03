import { expect, test } from "./fixtures";
import { addPlayers, chooseSettings, openGame, resultPoints, ride, startDemoGame } from "./helpers";

const start = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "C'est parti !" });

test("needs two players and a bike before starting", async ({ page }) => {
  await openGame(page);
  await expect(start(page)).toBeDisabled();
  await expect(page.getByText("Ajoute au moins 2 joueurs")).toBeVisible();

  await addPlayers(page, "Léa");
  await expect(start(page)).toBeDisabled();

  await addPlayers(page, "Tom");
  await expect(page.getByText("Connecte le vélo, ou essaie sans")).toBeVisible();
  await expect(start(page)).toBeDisabled();

  await page.getByRole("button", { name: "Essayer sans vélo" }).click();
  await expect(start(page)).toBeEnabled();
  await expect(page.getByText(/^Mode démo : pendant la course/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Essayer sans vélo" })).toHaveCount(0);
});

test("refuses the same name twice", async ({ page }) => {
  await openGame(page);
  await addPlayers(page, "Léa");
  await page.getByRole("textbox").fill("  léa ");
  await page.getByRole("textbox").press("Enter");
  await expect(page.getByRole("alert")).toHaveText("léa joue déjà");
  await expect(page.getByRole("listitem")).toHaveCount(1);
});

test("plays a whole game and announces the winner", async ({ page, context }) => {
  // Six simulated rides: each one runs ~1200 animation frames.
  test.setTimeout(120_000);
  // Stand-in for the device's share menu: records what it is given.
  await page.addInitScript(() => {
    const w = window as unknown as { shared: unknown };
    w.shared = null;
    navigator.canShare = () => true;
    navigator.share = async (data?: ShareData) => {
      const file = data?.files?.[0];
      const bitmap = file ? await createImageBitmap(file) : null;
      w.shared = {
        text: data?.text,
        type: file?.type,
        size: [bitmap?.width, bitmap?.height],
      };
    };
  });
  await openGame(page);
  await chooseSettings(page, { duration: "20 s", rounds: "3 tours" });
  await addPlayers(page, "Léa", "Tom");
  await startDemoGame(page);

  // Léa pedals every time, Tom never does.
  for (let round = 1; round <= 3; round++) {
    await expect(page.getByText(`Au tour de Léa`)).toBeVisible();
    await expect(page.getByText(`Tour ${round}/3`)).toBeVisible();
    await ride(page, { durationSec: 20, pedal: true });
    expect(await resultPoints(page)).toBeGreaterThan(400);
    await expect(page.getByText("Au suivant : Tom")).toBeVisible();
    // Ride details: ← → every 170 ms is about 95 rpm, 150 W in demo mode; a
    // little real time slips in between two key presses, slowing it down.
    await expect(page.getByText(/^en moyenne · max (8\d|9\d|10\d)$/)).toBeVisible();
    await expect(page.getByText(/^en moyenne · max 1[2-7]\d$/)).toBeVisible();
    await page.getByRole("button", { name: "Au suivant : Tom" }).click();

    await expect(page.getByText(`Au tour de Tom`)).toBeVisible();
    await ride(page, { durationSec: 20, pedal: false });
    expect(await resultPoints(page)).toBe(0);
    if (round < 3) {
      await expect(page.getByText("Au suivant : Léa")).toBeVisible();
      await expect(page.getByText(`Tour ${round + 1}/3`)).toBeVisible();
      await page.getByRole("button", { name: "Au suivant : Léa" }).click();
    }
  }

  await expect(page.getByText("Léa sonne la cloche !")).toBeVisible();
  await expect(page.getByText("Partie terminée, bravo à tous !")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Au suivant/ })).toHaveCount(0);
  const ranking = page.locator("tbody tr");
  await expect(ranking.first()).toContainText("Léa");
  await expect(ranking.last()).toContainText("Tom");

  // Cumulative total: three rides of Léa.
  const leaTotal = Number(await ranking.first().locator("td").last().textContent());
  expect(leaTotal).toBeGreaterThan(1200);

  // Per-round detail and end-of-game awards.
  await expect(ranking.first().locator("td")).toHaveText([/1/, /\d{3}/, /\d{3}/, /\d{3}/, /\d{4}/]);
  await expect(ranking.last().locator("td")).toHaveText(["2", "0", "0", "0", "0"]);
  await expect(page.getByText("Meilleur passage")).toBeVisible();
  await expect(page.getByText("Jambes les plus rapides")).toBeVisible();

  await page.getByRole("button", { name: "Partager", exact: true }).click();
  const shared = await page.waitForFunction(
    () => (window as unknown as { shared: unknown }).shared,
  );
  expect(await shared.jsonValue()).toEqual({
    text: expect.stringMatching(/^🔔 Léa sonne la cloche !\n1\. Léa \(\d+\)\n2\. Tom \(0\)/),
    type: "image/png",
    size: [1080, 1350],
  });

  // Everyone can take the game to their phone; a demo game is no real ride,
  // so there is nothing to publish on Strava there.
  await page.getByRole("button", { name: "📱 Sur vos téléphones" }).click();
  const here = page.getByRole("link", { name: "ou ouvre-la sur cet appareil" });
  const phone = await context.newPage();
  await phone.goto((await here.getAttribute("href")) ?? "");
  await expect(phone.getByRole("button", { name: "Partager l'image" })).toBeVisible();
  await expect(phone.getByRole("button", { name: "Publier sur Strava" })).toHaveCount(0);
  await phone.close();
  await page.getByRole("button", { name: "Fermer" }).click();

  await page.getByRole("button", { name: "Nouvelle partie" }).click();
  await expect(page.getByText("Au tour de Léa")).toBeVisible();
  await expect(page.getByText("Tour 1/3")).toBeVisible();
});

test("a retried ride replaces the previous one", async ({ page }) => {
  await openGame(page);
  await chooseSettings(page, { duration: "20 s", rounds: "3 tours" });
  await addPlayers(page, "Léa", "Tom");
  await startDemoGame(page);

  await ride(page, { durationSec: 20, pedal: true });
  expect(await resultPoints(page)).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Refaire le passage" }).click();
  await ride(page, { durationSec: 20, pedal: false });
  expect(await resultPoints(page)).toBe(0);
  const lea = page.locator("tbody tr").filter({ hasText: "Léa" });
  await expect(lea.locator("td").last()).toHaveText("0");
});

test("remembers players and settings after a reload", async ({ page }) => {
  await openGame(page);
  await addPlayers(page, "Léa", "Tom");
  await chooseSettings(page, { duration: "45 s", rounds: "5 tours" });
  await page.reload();
  await expect(page.getByRole("listitem")).toHaveText([/Léa/, /Tom/]);
  await expect(page.getByRole("button", { name: /Réglages/ })).toContainText(
    "Vitesse des jambes · 45 s · 5 tours",
  );
});

test("the back button does not leave a game in progress", async ({ page }) => {
  await page.goto("/fr/"); // an earlier page to go back to
  await openGame(page);
  await addPlayers(page, "Léa", "Tom");
  await startDemoGame(page);
  await expect(page.getByText("Au tour de Léa")).toBeVisible();
  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL("/fr/");
  await expect(page.getByText("Au tour de Léa")).toBeVisible();
});

test("asks before leaving a game in progress", async ({ page }) => {
  await openGame(page);
  await chooseSettings(page, { duration: "20 s", rounds: "3 tours" });
  await addPlayers(page, "Léa", "Tom");
  await startDemoGame(page);
  await ride(page, { durationSec: 20, pedal: true });

  await page.getByRole("button", { name: "Accueil" }).click();
  await expect(page.getByRole("alertdialog", { name: "Quitter la partie ?" })).toBeVisible();
  await page.getByRole("button", { name: "Continuer la partie" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Au suivant : Tom" })).toBeVisible();

  await page.getByRole("button", { name: "Accueil" }).click();
  await page.getByRole("button", { name: "Quitter", exact: true }).click();
  await expect(page.getByRole("button", { name: "C'est parti !" })).toBeVisible();
});

test("warns before closing the tab during a game", async ({ page }) => {
  await openGame(page);
  await addPlayers(page, "Léa", "Tom");
  await startDemoGame(page);
  const dialog = page.waitForEvent("dialog");
  await page.close({ runBeforeUnload: true });
  const shown = await dialog;
  expect(shown.type()).toBe("beforeunload");
  await shown.dismiss();
});
