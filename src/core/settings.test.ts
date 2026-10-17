import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, drivetrainOf, forSensor, parseSettings, slopeAllowed } from "./settings";

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
      gears: DEFAULT_SETTINGS.gears,
      chainring: DEFAULT_SETTINGS.chainring,
      cog: DEFAULT_SETTINGS.cog,
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

describe("virtual gears", () => {
  it("are off by default: most bikes have a cassette", () => {
    expect(DEFAULT_SETTINGS.gears).toBe("bike");
    expect(drivetrainOf(DEFAULT_SETTINGS)).toBeNull();
  });

  it("keep the real drivetrain, whole teeth within reach only", () => {
    const settings = parseSettings({ gears: "virtual", chainring: 36, cog: 15 });
    expect(drivetrainOf(settings)).toEqual({ chainring: 36, cog: 15 });
    expect(parseSettings({ gears: "eps", chainring: 300, cog: 14.5 })).toMatchObject({
      gears: "bike",
      chainring: DEFAULT_SETTINGS.chainring,
      cog: DEFAULT_SETTINGS.cog,
    });
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
