import { expect, type Page } from "@playwright/test";

// Mirrors the countdown in src/ui/RideScreen.tsx (3 × 800 ms + 450 ms).
const COUNTDOWN_MS = 3 * 800 + 450;

/** Opens the game with the fake clock installed, so rides take no real time. */
export async function openGame(page: Page, path = "/fr/"): Promise<void> {
  await page.clock.install();
  await page.goto(path);
}

export async function addPlayers(page: Page, ...names: string[]): Promise<void> {
  const input = page.getByRole("textbox");
  for (const name of names) {
    await input.fill(name);
    await input.press("Enter");
    await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible();
  }
}

export async function chooseSettings(
  page: Page,
  { duration, rounds }: { duration: string; rounds: string },
): Promise<void> {
  await page.getByRole("button", { name: /Réglages|Settings/ }).click();
  await page.getByRole("button", { name: duration, exact: true }).click();
  await page.getByRole("button", { name: rounds, exact: true }).click();
  await page.getByRole("button", { name: /Terminé|Done/ }).click();
}

export async function startDemoGame(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Essayer sans vélo" }).click();
  await page.getByRole("button", { name: "C'est parti !" }).click();
}

/** Plays one ride in demo mode, pedaling (holding the button) or not. */
export async function ride(
  page: Page,
  { durationSec, pedal }: { durationSec: number; pedal: boolean },
): Promise<void> {
  const hold = page.getByRole("button", { name: /Maintiens pour pédaler|Hold to pedal/ });
  if (pedal) {
    const box = await hold.boundingBox();
    if (!box) throw new Error("hold button not visible");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
  }
  await page.clock.runFor(COUNTDOWN_MS);
  await expect(page.getByTestId("ride-score")).toBeVisible();
  await page.clock.runFor(durationSec * 1000 + 500);
  if (pedal) await page.mouse.up();
  await expect(page.getByRole("heading", { name: /Classement|Ranking/ })).toBeVisible();
}

/** Final score shown on the result screen. */
export async function resultPoints(page: Page): Promise<number> {
  const text = await page.getByTestId("result-points").textContent();
  return Number(text);
}
