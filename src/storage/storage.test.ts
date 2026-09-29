import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../core/settings";
import { loadRoster, loadSettings, saveRoster, saveSettings } from "./storage";

describe("storage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("round-trips roster and settings", () => {
    saveRoster([{ id: "1", name: "Léa" }]);
    saveSettings({ metric: "power", durationSec: 45, rounds: 3, resistance: "hard" });
    expect(loadRoster()).toEqual([{ id: "1", name: "Léa" }]);
    expect(loadSettings()).toEqual({
      metric: "power",
      durationSec: 45,
      rounds: 3,
      resistance: "hard",
    });
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
