import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseSettings } from "./settings";

describe("parseSettings", () => {
  it("falls back to defaults on garbage", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("x")).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid fields and replaces invalid ones", () => {
    expect(parseSettings({ metric: "power", durationSec: 31, rounds: 5, slope: "cliff" })).toEqual({
      metric: "power",
      durationSec: DEFAULT_SETTINGS.durationSec,
      rounds: 5,
      slope: DEFAULT_SETTINGS.slope,
    });
    expect(parseSettings({ slope: "hill" }).slope).toBe("hill");
  });

  it("defaults to a gentle slope (settings saved before it existed)", () => {
    expect(parseSettings({ metric: "cadence", durationSec: 30, rounds: 4 }).slope).toBe("gentle");
  });

  it("turns the resistance saved by earlier versions into a slope", () => {
    expect(parseSettings({ resistance: "light" }).slope).toBe("flat");
    expect(parseSettings({ resistance: "megaHard" }).slope).toBe("wall");
    expect(parseSettings({ resistance: "toString" }).slope).toBe("gentle");
    expect(parseSettings({ resistance: "hard", slope: "flat" }).slope).toBe("flat");
  });
});
