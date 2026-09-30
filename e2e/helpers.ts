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

/** Time between two demo steps: one every 170 ms is ~95 rpm. */
export const STEP_MS = 170;

/** Plays one ride in demo mode, pedaling (← → in turn) or not. */
export async function ride(
  page: Page,
  { durationSec, pedal }: { durationSec: number; pedal: boolean },
): Promise<void> {
  await page.clock.runFor(COUNTDOWN_MS);
  await expect(page.getByTestId("ride-score")).toBeVisible();
  const totalMs = durationSec * 1000 + 500;
  if (pedal) {
    for (let t = 0, i = 0; t < totalMs; t += STEP_MS, i++) {
      await page.keyboard.press(i % 2 ? "ArrowRight" : "ArrowLeft");
      await page.clock.runFor(STEP_MS);
    }
  } else {
    await page.clock.runFor(totalMs);
  }
  await expect(page.getByRole("heading", { name: /Classement|Ranking/ })).toBeVisible();
}

/** Final score shown on the result screen. */
export async function resultPoints(page: Page): Promise<number> {
  const text = await page.getByTestId("result-points").textContent();
  return Number(text);
}
