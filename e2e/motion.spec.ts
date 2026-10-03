import { expect, test } from "./fixtures";
import { addPlayers, startDemoGame } from "./helpers";

// Real time on purpose (no fake clock): this checks what is actually painted,
// frame by frame, which state-based assertions cannot see.
test("the bike moves smoothly, on every frame", async ({ page }) => {
  await page.goto("/fr/");
  await addPlayers(page, "Léa", "Tom");
  await startDemoGame(page);
  await expect(page.getByTestId("ride-score")).toBeVisible();
  // Pedal in real time: ← and → in turn every 250 ms (120 rpm).
  await page.evaluate(() => {
    let step = 0;
    setInterval(() => {
      dispatchEvent(
        new KeyboardEvent("keydown", { code: step++ % 2 ? "ArrowRight" : "ArrowLeft" }),
      );
    }, 250);
  });
  await page.waitForTimeout(1000);

  const xs = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const bike = document.querySelector("[class*=bike]");
        if (!bike) throw new Error("no bike");
        const samples: number[] = [];
        const sample = () => {
          samples.push(bike.getBoundingClientRect().x);
          if (samples.length < 60) requestAnimationFrame(sample);
          else resolve(samples);
        };
        requestAnimationFrame(sample);
      }),
  );

  const steps = xs.slice(1).map((x, i) => x - (xs[i] ?? x));
  // The track is sized for a whole ride: one second moves the bike a few %.
  expect(xs.at(-1)).toBeGreaterThan((xs[0] ?? 0) + 20);
  expect(steps.every((dx) => dx >= 0)).toBe(true);
  // A busy machine may skip a few frames; a stuck bike stays still for long.
  let still = 0;
  let longestStill = 0;
  for (const dx of steps) {
    still = dx === 0 ? still + 1 : 0;
    longestStill = Math.max(longestStill, still);
  }
  expect(longestStill).toBeLessThanOrEqual(8);
});
