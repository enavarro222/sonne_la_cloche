import { describe, expect, it } from "vitest";
import { decodePlayerActivity, encodePlayerActivity } from "./playerLink";

const START = Date.parse("2026-09-29T15:00:00.000Z");

const summary = (players: number) => ({
  ranking: Array.from({ length: players }, (_, i) => ({
    rank: i + 1,
    name: `Maximilien-J${String(i)}`,
    total: 9000 - i * 300,
  })),
  awards: {
    bestRide: { name: "Maximilien-J0", value: 1210 },
    fastest: null,
    strongest: { name: "Maximilien-J3", value: 302 },
  },
});

const activity = (rounds: number, seconds: number, sample: (i: number) => [number, number]) => ({
  locale: "fr" as const,
  name: "Léa-Zoé ✨",
  rank: 2,
  players: 6,
  total: 1881,
  rides: Array.from({ length: rounds }, (_, r) => ({
    startedAt: START + r * 240_000,
    points: 627,
    samples: Array.from({ length: seconds }, (_, s) => {
      const [cadence, power] = sample(r * seconds + s);
      return { second: s + 1, cadence, power };
    }),
  })),
  summary: summary(6),
  strava: true,
});

describe("player link", () => {
  it("round-trips a player's game", async () => {
    const original = activity(3, 30, (i) => [80 + (i % 20), 40 + 2 * (i % 30)]);
    expect(await decodePlayerActivity(await encodePlayerActivity(original))).toEqual(original);
  });

  it("keeps a demo game away from Strava", async () => {
    const original = { ...activity(1, 5, () => [90, 100]), strava: false };
    expect(await decodePlayerActivity(await encodePlayerActivity(original))).toEqual(original);
  });

  it("reads links made before the summary was added", async () => {
    const original = { ...activity(1, 5, () => [90, 100]), summary: null };
    expect(await decodePlayerActivity(await encodePlayerActivity(original))).toEqual(original);
  });

  it("stays short enough for an easy QR code, even in the worst case", async () => {
    // 10 players, 5 rounds of 45 s with random values: nothing for the
    // compression to exploit.
    let seed = 42;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const fragment = await encodePlayerActivity({
      ...activity(5, 45, () => [Math.floor(60 + random() * 60), Math.floor(random() * 300)]),
      summary: summary(10),
    });
    expect(fragment.length).toBeLessThan(1000);
    expect(fragment).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("keeps values within what one byte holds: cadence to 255, power to 510 W in 2 W steps", async () => {
    const decoded = await decodePlayerActivity(
      await encodePlayerActivity(
        activity(1, 3, (i) => [[300, 91.6, 0][i] ?? 0, [900, 151, -5][i] ?? 0]),
      ),
    );
    expect(decoded?.rides[0]?.samples.map((s) => [s.cadence, s.power])).toEqual([
      [255, 510],
      [92, 152],
      [0, 0],
    ]);
  });

  it("rejects anything that is not a link made by the game", async () => {
    for (const fragment of ["", "hello", "test", "AAAA", "not!base64"]) {
      expect(await decodePlayerActivity(fragment)).toBeNull();
    }
  });
});
