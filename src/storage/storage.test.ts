import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../core/settings";
import { loadRoster, loadSettings, migrateSettings, saveRoster, saveSettings } from "./storage";

describe("storage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("round-trips roster and settings", () => {
    saveRoster([{ id: "1", name: "Léa", livery: 3 }]);
    saveSettings({ metric: "cadence", durationSec: 45, rounds: 3, slope: "hill", finale: "on" });
    expect(loadRoster()).toEqual([{ id: "1", name: "Léa", livery: 3 }]);
    expect(loadSettings()).toEqual({
      metric: "cadence",
      durationSec: 45,
      rounds: 3,
      slope: "hill",
      finale: "on",
    });
  });

  it("moves settings saved by 0.1 to the new default, keeping length and rounds", () => {
    localStorage.setItem(
      "sonne-la-cloche.settings",
      JSON.stringify({ metric: "cadence", durationSec: 45, rounds: 3, resistance: "hard" }),
    );
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, durationSec: 45, rounds: 3 });
    expect(migrateSettings(null)).toBeNull();
  });

  it("falls back to defaults when nothing or garbage is stored", () => {
    expect(loadRoster()).toEqual([]);
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem("sonne-la-cloche.roster", "{not json");
    expect(loadRoster()).toEqual([]);
  });

  it("survives an unavailable storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => {
      saveRoster([]);
    }).not.toThrow();
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
