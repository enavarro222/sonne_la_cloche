// Takes the README's screenshots (docs/screenshots/) from a real game in demo
// mode, in English, the clock faked as in the e2e tests. Run after a visible
// change: pnpm screenshots
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "@playwright/test";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = (name: string) =>
  fileURLToPath(new URL(`../docs/screenshots/${name}.png`, import.meta.url));

const server = await createServer({ root, logLevel: "error", server: { port: 0 } });
await server.listen();
const base = server.resolvedUrls?.local[0];
if (!base) throw new Error("Vite did not start");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, locale: "en-US" });
await page.clock.install();
await page.addInitScript(() => {
  // Headless Chromium has no Web Bluetooth: the home screen would say so.
  Object.defineProperty(navigator, "bluetooth", { value: {} });
  const settings = { version: 2, durationSec: 20, rounds: 3 };
  localStorage.setItem("sonne-la-cloche.settings", JSON.stringify(settings));
});

const shoot = async (name: string) => {
  // Fonts and the drawings' filters, then one frame for the layout to settle.
  await page.evaluate(() => document.fonts.ready);
  await page.clock.runFor(100);
  await page.screenshot({ path: out(name) });
  console.log(out(name));
};

// Mirrors the countdown in src/ui/RideScreen.tsx (3 × 800 ms + 450 ms).
const COUNTDOWN_MS = 3 * 800 + 450;
const RIDE_MS = 20_000 + 500;

/** Pedals with ← → every `stepMs` (170 ms is about 95 rpm), `until` the ride ends or it says stop. */
async function pedal(p: Page, stepMs: number, until?: () => Promise<boolean>) {
  for (let t = 0, i = 0; t < RIDE_MS; t += stepMs, i++) {
    await p.keyboard.press(i % 2 ? "ArrowRight" : "ArrowLeft");
    await p.clock.runFor(stepMs);
    if (until && (await until())) return;
  }
}

/** A whole ride, from the countdown to the results. */
async function ride(stepMs: number) {
  await page.clock.runFor(COUNTDOWN_MS);
  await pedal(page, stepMs);
  await page.getByRole("heading", { name: "Ranking" }).waitFor();
}

const next = () => page.getByRole("button", { name: /^Next: / }).click();

await page.goto(`${base}en/`);
for (const name of ["Léa", "Tom", "Zoé", "Sam"]) {
  await page.getByRole("textbox").fill(name);
  await page.keyboard.press("Enter");
}
await page.getByRole("button", { name: "Try without a bike" }).click();
await shoot("home");

// Léa sets the record, then Tom rides faster and rings the bell.
await page.getByRole("button", { name: /^Let's go/ }).click();
await ride(1500);
await next();
await page.clock.runFor(COUNTDOWN_MS);
const beaten = page.getByText("Record beaten!");
await pedal(page, 150, () => beaten.isVisible());
// A little further: the bike past the bell, still swinging.
for (let i = 0; i < 10; i++) {
  await page.keyboard.press(i % 2 ? "ArrowRight" : "ArrowLeft");
  await page.clock.runFor(150);
}
await shoot("ride");
await pedal(page, 150);
await page.getByRole("heading", { name: "Ranking" }).waitFor();
await shoot("result");

// The rest of the game, everyone at their own pace.
const paces: Record<string, number> = { Léa: 190, Tom: 160, Zoé: 210, Sam: 175 };
for (;;) {
  const button = page.getByRole("button", { name: /^Next: / });
  if ((await button.count()) === 0) break;
  const rider = /^Next: (.+)/.exec((await button.getAttribute("aria-label")) ?? "")?.[1] ?? "";
  await button.click();
  await ride(paces[rider.trim()] ?? 180);
}
await shoot("game-over");

await browser.close();
await server.close();
