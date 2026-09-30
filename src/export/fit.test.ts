import FitParser from "fit-file-parser";
import { describe, expect, it } from "vitest";
import { buildFit } from "./fit";

const samples = (count: number, cadence: number, power: number) =>
  Array.from({ length: count }, (_, i) => ({ second: i + 1, cadence, power }));

const START = Date.parse("2026-09-29T15:00:00.000Z");
const rides = [
  { startedAt: START + 120_000, samples: samples(30, 60, 40) },
  { startedAt: START, samples: samples(30, 90, 70) },
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

  it("is an indoor ride without GPS", async () => {
    const fit = await parse(buildFit(rides));
    expect(fit.sessions?.[0]?.sub_sport).toBe("indoor_cycling");
    expect(fit.records?.some((r) => r.position_lat !== undefined)).toBe(false);
  });

  it("has a lap per ride in time order, and a record per second", async () => {
    const fit = await parse(buildFit(rides));
    expect(fit.laps?.map((l) => [l.start_time?.toISOString(), l.avg_cadence, l.avg_power])).toEqual(
      [
        ["2026-09-29T15:00:00.000Z", 90, 70],
        ["2026-09-29T15:02:00.000Z", 60, 40],
      ],
    );
    // 60 samples, plus a standstill point at each end of both rides.
    expect(fit.records).toHaveLength(64);
    expect(fit.records?.[1]).toMatchObject({ cadence: 90, power: 70 });
  });

  it("counts only ridden time, not the waits between rides", async () => {
    const session = (await parse(buildFit(rides))).sessions?.[0];
    expect(session?.total_timer_time).toBe(60);
    expect(session?.total_elapsed_time).toBe(150);
    expect(session?.num_laps).toBe(2);
    // 30 s at 90 rpm (6 m/s) + 30 s at 60 rpm (4 m/s).
    expect(session?.total_distance).toBeCloseTo(300);
  });

  it("stands still at the start and end of each ride", async () => {
    const records = (await parse(buildFit(rides))).records ?? [];
    const times = (i: number) => records[i]?.timestamp?.toISOString();
    expect(records[0]).toMatchObject({ speed: 0, cadence: 0, power: 0 });
    expect(times(0)).toBe("2026-09-29T15:00:00.000Z");
    expect(records[31]).toMatchObject({ speed: 0, cadence: 0, power: 0 });
    expect(times(31)).toBe("2026-09-29T15:00:31.000Z");
    expect(records[32]).toMatchObject({ speed: 0, cadence: 0 });
    expect(times(32)).toBe("2026-09-29T15:02:00.000Z");
  });
});
