import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, forSensor, parseSettings, slopeAllowed } from "./settings";

describe("parseSettings", () => {
  it("falls back to defaults on garbage", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("x")).toEqual(DEFAULT_SETTINGS);
  });

  it("defaults to the distance, each on their own slope", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ metric: "distance", slope: "own" });
  });

  it("keeps valid fields and replaces invalid ones", () => {
    expect(parseSettings({ metric: "power", durationSec: 31, rounds: 5, slope: "cliff" })).toEqual({
      metric: DEFAULT_SETTINGS.metric,
      durationSec: DEFAULT_SETTINGS.durationSec,
      rounds: 5,
      slope: DEFAULT_SETTINGS.slope,
      finale: DEFAULT_SETTINGS.finale,
    });
    expect(parseSettings({ slope: "hill" }).slope).toBe("hill");
  });

  it("never pairs own slopes with pedal turns", () => {
    expect(parseSettings({ metric: "cadence", slope: "own" }).slope).toBe("gentle");
    expect(slopeAllowed("own", "cadence")).toBe(false);
    expect(slopeAllowed("own", "distance")).toBe(true);
    expect(slopeAllowed("wall", "cadence")).toBe(true);
  });
});

describe("forSensor", () => {
  it("counts pedal turns when the bike measures no power", () => {
    expect(forSensor(DEFAULT_SETTINGS, true)).toBe(DEFAULT_SETTINGS);
    expect(forSensor(DEFAULT_SETTINGS, false)).toEqual({
      ...DEFAULT_SETTINGS,
      metric: "cadence",
      slope: "gentle",
    });
    const hill = { ...DEFAULT_SETTINGS, slope: "hill" as const };
    expect(forSensor(hill, false).slope).toBe("hill");
  });
});
