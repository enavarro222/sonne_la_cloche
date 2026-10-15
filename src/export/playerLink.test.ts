import QRCode from "qrcode";
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

/** Cadence, power and, if given, speed of each second; by default the speed 90 rpm drives. */
type Sample = [cadence: number, power: number, speed?: number];

const activity = (rounds: number, seconds: number, sample: (i: number) => Sample) => ({
  locale: "fr" as const,
  name: "Léa-Zoé ✨",
  rank: 2,
  players: 6,
  total: 1881,
  rides: Array.from({ length: rounds }, (_, r) => ({
    startedAt: START + r * 240_000,
    points: 627,
    gradePct: r * 2.5,
    samples: Array.from({ length: seconds }, (_, s) => {
      const [cadence, power, speed = Math.round((cadence / 15) * 10) / 10] = sample(
        r * seconds + s,
      );
      // The finale lifts the track for the last 5 seconds.
      const gradePct = r * 2.5 + (s >= seconds - 5 ? 3 : 0);
      return { second: s + 1, cadence, power, speed, gradePct };
    }),
  })),
  summary: summary(6),
  strava: true,
});

describe("player link", () => {
  it("round-trips a player's game", async () => {
    const original = activity(3, 30, (i) => [80 + (i % 20), 40 + 4 * (i % 30)]);
    expect(await decodePlayerActivity(await encodePlayerActivity(original))).toEqual(original);
  });

  it("keeps a demo game away from Strava", async () => {
    const original = { ...activity(1, 5, () => [90, 100]), strava: false };
    expect(await decodePlayerActivity(await encodePlayerActivity(original))).toEqual(original);
  });

  it("reads links made before the slopes were added: flat", async () => {
    const original = activity(2, 5, () => [90, 100]);
    const flat = {
      ...original,
      rides: original.rides.map((ride) => ({
        ...ride,
        gradePct: 0,
        samples: ride.samples.map(({ second, cadence, power, speed }) => ({
          second,
          cadence,
          power,
          speed,
        })),
      })),
    };
    expect(await decodePlayerActivity(await encodePlayerActivity(flat))).toEqual(flat);
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
    let speed = 7;
    const fragment = await encodePlayerActivity({
      ...activity(5, 45, () => {
        // The bike's speed follows the effort smoothly, however erratic it is.
        speed = Math.min(15, Math.max(0, speed + Math.round((random() - 0.5) * 8) / 10));
        return [Math.floor(60 + random() * 60), Math.floor(random() * 300), speed];
      }),
      summary: summary(10),
    });
    // Speeds and slopes (version 2) took it past 1000: a QR code one size up
    // (version 25 at most, 117 modules a side, shown 560 px wide).
    expect(fragment.length).toBeLessThan(1200);
    const url = `https://sonnelacloche.enavarro.eu/strava/#${fragment}`;
    expect(QRCode.create(url, { errorCorrectionLevel: "L" }).version).toBeLessThanOrEqual(25);
    expect(fragment).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("keeps values within what one byte holds", async () => {
    const decoded = await decodePlayerActivity(
      await encodePlayerActivity(
        activity(1, 6, (i) => [
          [300, 91.6, 0, 80, 90, 90][i] ?? 0,
          [2000, 151, -5, 900, 100, 100][i] ?? 0,
          [12, 30, 30, 6.04, -1, 7][i] ?? 0,
        ]),
      ),
    );
    expect(decoded?.rides[0]?.samples.map((s) => [s.cadence, s.power, s.speed])).toEqual([
      // Cadence to 255 rpm, power to 1020 W.
      [255, 1020, 12],
      // Power in 4 W steps; the speed changes by 12.7 m/s in a second at most…
      [92, 152, 24.7],
      // …up to 25.5 m/s.
      [0, 0, 25.5],
      // An adult's sprint; the speed falls by 12.7 m/s at most, then to 0.
      [80, 900, 12.7],
      [90, 100, 0],
      [90, 100, 7],
    ]);
  });

  it("reads a link made by version 0.1.0", async () => {
    // Version 1 as 0.1.0 wrote it: power in 2 W steps, no speed, no slopes.
    const header = new TextEncoder().encode(
      JSON.stringify({ l: "fr", n: "Léa", r: 1, p: 2, t: 900 }),
    );
    const bytes = new Uint8Array(3 + header.length + 1 + 8 + 2 * 2);
    const view = new DataView(bytes.buffer);
    view.setUint8(0, 1);
    view.setUint16(1, header.length);
    bytes.set(header, 3);
    let o = 3 + header.length;
    view.setUint8(o++, 1);
    view.setUint32(o, START / 1000);
    view.setUint16(o + 4, 900);
    view.setUint16(o + 6, 2);
    o += 8;
    for (const [cadence, halfWatts] of [
      [90, 75],
      [92, 76],
    ]) {
      view.setUint8(o++, cadence ?? 0);
      view.setUint8(o++, halfWatts ?? 0);
    }
    const source = new ReadableStream<Uint8Array<ArrayBuffer>>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    const deflated = new Uint8Array(
      await new Response(source.pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer(),
    );
    const fragment = btoa(String.fromCharCode(...deflated))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const decoded = await decodePlayerActivity(fragment);
    expect(decoded).toMatchObject({ name: "Léa", rank: 1, players: 2, total: 900, summary: null });
    expect(decoded?.rides).toEqual([
      {
        startedAt: START,
        points: 900,
        gradePct: 0,
        samples: [
          { second: 1, cadence: 90, power: 150 },
          { second: 2, cadence: 92, power: 152 },
        ],
      },
    ]);
  });

  it("rejects anything that is not a link made by the game", async () => {
    for (const fragment of ["", "hello", "test", "AAAA", "not!base64"]) {
      expect(await decodePlayerActivity(fragment)).toBeNull();
    }
  });
});
