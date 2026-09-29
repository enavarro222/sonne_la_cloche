import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseSettings } from "./settings";

describe("parseSettings", () => {
  it("falls back to defaults on garbage", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("x")).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid fields and replaces invalid ones", () => {
    expect(
      parseSettings({ metric: "power", durationSec: 31, rounds: 5, resistance: "brutal" }),
    ).toEqual({
      metric: "power",
      durationSec: DEFAULT_SETTINGS.durationSec,
      rounds: 5,
      resistance: DEFAULT_SETTINGS.resistance,
    });
    expect(parseSettings({ resistance: "hard" }).resistance).toBe("hard");
  });

  it("defaults to a normal resistance (settings saved before it existed)", () => {
    expect(parseSettings({ metric: "cadence", durationSec: 30, rounds: 4 }).resistance).toBe(
      "normal",
    );
  });
});
