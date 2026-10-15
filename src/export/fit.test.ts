import FitParser from "fit-file-parser";
import { describe, expect, it } from "vitest";
import { buildFit } from "./fit";

const samples = (count: number, cadence: number, power: number) =>
  Array.from({ length: count }, (_, i) => ({ second: i + 1, cadence, power }));

const START = Date.parse("2026-09-29T15:00:00.000Z");
const rides = [
  { startedAt: START + 120_000, samples: samples(30, 60, 40) },
  { startedAt: START, gradePct: 5, samples: samples(30, 90, 70) },
];

async function parse(bytes: Uint8Array<ArrayBuffer>) {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new FitParser({ mode: "list", force: false }).parseAsync(buffer);
}

describe("buildFit", () => {
  it("is a valid activity: a virtual ride with a GPS track", async () => {
    const fit = await parse(buildFit(rides, { lat: 43.9, lon: 1.9 }));
    const session = fit.sessions?.[0];
    expect(session?.sport).toBe("cycling");
    expect(session?.sub_sport).toBe("virtual_activity");
    expect(fit.sports?.[0]).toMatchObject({ sport: "cycling", sub_sport: "virtual_activity" });
    expect(fit.records?.every((r) => r.position_lat !== undefined)).toBe(true);
    expect(fit.records?.[0]?.position_lat).toBeCloseTo(43.9, 2);
  });

  it("is still a virtual ride without GPS", async () => {
    const fit = await parse(buildFit(rides));
    expect(fit.sessions?.[0]?.sub_sport).toBe("virtual_activity");
    expect(fit.records?.some((r) => r.position_lat !== undefined)).toBe(false);
  });

  it("has a lap per ride in time order, back to back, and a record per second", async () => {
    const fit = await parse(buildFit(rides));
    expect(fit.laps?.map((l) => [l.start_time?.toISOString(), l.avg_cadence, l.avg_power])).toEqual(
      [
        ["2026-09-29T15:00:00.000Z", 90, 70],
        // Right after the first one, not two minutes later.
        ["2026-09-29T15:00:31.000Z", 60, 40],
      ],
    );
    // 60 samples, a standstill point at the start of both rides and at the end.
    expect(fit.records).toHaveLength(63);
    expect(fit.records?.[1]).toMatchObject({ cadence: 90, power: 70 });
  });

  it("leaves out the waits between rides: they would count as moving time", async () => {
    const session = (await parse(buildFit(rides))).sessions?.[0];
    expect(session?.total_timer_time).toBe(60);
    expect(session?.total_elapsed_time).toBe(61);
    expect(session?.num_laps).toBe(2);
    // 30 s at 90 rpm (6 m/s) + 30 s at 60 rpm (4 m/s).
    expect(session?.total_distance).toBeCloseTo(300);
    // 300 m in 60 s.
    expect(session?.avg_speed).toBeCloseTo(5, 1);
    expect(session?.max_speed).toBeCloseTo(6, 1);
  });

  it("with a track, keeps the real times: Strava tells the rests by the position", async () => {
    const fit = await parse(buildFit(rides, { lat: 43.9, lon: 1.9 }));
    expect(fit.laps?.map((l) => l.start_time?.toISOString())).toEqual([
      "2026-09-29T15:00:00.000Z",
      "2026-09-29T15:02:00.000Z",
    ]);
    expect(fit.sessions?.[0]?.total_elapsed_time).toBe(150);
    expect(fit.sessions?.[0]?.total_timer_time).toBe(60);
    // Still for the whole rest: the same position at its two ends.
    const records = fit.records ?? [];
    expect(records[31]?.timestamp?.toISOString()).toBe("2026-09-29T15:00:31.000Z");
    expect(records[32]?.timestamp?.toISOString()).toBe("2026-09-29T15:02:00.000Z");
    expect(records[32]?.position_lat).toBe(records[31]?.position_lat);
    expect(records[32]?.position_long).toBe(records[31]?.position_long);
  });

  it("covers the ride's score, at the speed recorded each second", async () => {
    // By distance: the speed comes from power, not from the pedal turns.
    const recorded = samples(10, 90, 300).map((s) => ({ ...s, speed: s.second < 5 ? 8 : 10 }));
    const fit = await parse(buildFit([{ startedAt: START, points: 91, samples: recorded }]));
    expect(fit.sessions?.[0]?.total_distance).toBeCloseTo(91, 0);
    // The shape kept: 4 s at 8 m/s, then 10 m/s, brought to 91 m in all.
    const speeds = fit.records?.slice(1, 11).map((r) => r.speed ?? 0) ?? [];
    expect((speeds[0] ?? 0) / (speeds[9] ?? 1)).toBeCloseTo(0.8, 1);
  });

  it("covers the score of an older link's ride, from its pedal turns", async () => {
    const fit = await parse(
      buildFit([{ startedAt: START, points: 150, samples: samples(30, 90, 70) }]),
    );
    expect(fit.sessions?.[0]?.total_distance).toBeCloseTo(150, 0);
  });

  it("records nothing after the session ends", async () => {
    for (const center of [undefined, { lat: 43.9, lon: 1.9 }]) {
      const fit = await parse(buildFit(rides, center));
      const end = fit.sessions?.[0]?.timestamp?.getTime() ?? 0;
      const last = fit.records?.at(-1)?.timestamp?.getTime() ?? Infinity;
      expect(last).toBeLessThanOrEqual(end);
      expect(fit.activity.timestamp?.getTime()).toBe(end);
    }
  });

  it("climbs the slope of each ride", async () => {
    const fit = await parse(buildFit(rides));
    const altitudes = fit.records?.map((r) => r.altitude ?? 0) ?? [];
    // 180 m at 5 %: 9 m up, then the flat ride.
    expect((altitudes.at(-1) ?? 0) - (altitudes[0] ?? 0)).toBeCloseTo(9, 0);
    expect(fit.laps?.map((l) => l.total_ascent)).toEqual([9, 0]);
    expect(fit.sessions?.[0]?.total_ascent).toBe(9);
  });

  it("climbs the slope of each second: a finale lifts the last ones", async () => {
    const lifted = samples(10, 90, 70).map((s) => ({ ...s, gradePct: s.second > 5 ? 8 : 5 }));
    const fit = await parse(buildFit([{ startedAt: START, gradePct: 5, samples: lifted }]));
    // 6 m/s: 5 s at 5 %, then 5 s at 8 %.
    expect(fit.sessions?.[0]?.total_ascent).toBe(4);
    expect(fit.records?.map((r) => r.altitude ?? 0).at(-1)).toBeCloseTo(100 + 1.5 + 2.4, 0);
  });

  it("stands still at the start of each ride and at the end", async () => {
    const records = (await parse(buildFit(rides))).records ?? [];
    const times = (i: number) => records[i]?.timestamp?.toISOString();
    expect(records[0]).toMatchObject({ speed: 0, cadence: 0, power: 0 });
    expect(times(0)).toBe("2026-09-29T15:00:00.000Z");
    expect(records[31]).toMatchObject({ speed: 0, cadence: 0, power: 0 });
    expect(times(31)).toBe("2026-09-29T15:00:31.000Z");
    expect(records.at(-1)).toMatchObject({ speed: 0, cadence: 0, power: 0 });
    expect(records.at(-1)?.timestamp?.toISOString()).toBe("2026-09-29T15:01:02.000Z");
  });
});
