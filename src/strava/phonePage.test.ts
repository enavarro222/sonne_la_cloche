import { describe, expect, it } from "vitest";
import type { PlayerActivity } from "../export/playerLink";
import { fitFileName, fromState, toBase64, toState } from "./phonePage";

const FRAGMENT = "AbC-123_xyz";

describe("OAuth state", () => {
  it("carries the game through Strava's consent page", () => {
    expect(fromState(toState(FRAGMENT, null))).toEqual({ fragment: FRAGMENT, center: null });
  });

  it("carries the map center too, south and west included", () => {
    for (const center of [
      { lat: 43.9, lon: -1.9 },
      { lat: -33.86882, lon: 151.20929 },
      { lat: 0, lon: 0 },
    ]) {
      expect(fromState(toState(FRAGMENT, center))).toEqual({ fragment: FRAGMENT, center });
    }
  });

  it("drops a center it cannot read, but keeps the game", () => {
    expect(fromState(`${FRAGMENT}.north,west`)).toEqual({ fragment: FRAGMENT, center: null });
    expect(fromState(`${FRAGMENT}.43.9`)).toEqual({ fragment: FRAGMENT, center: null });
    expect(fromState("")).toEqual({ fragment: "", center: null });
  });
});

describe("fitFileName", () => {
  const activity = (name: string, rides = [{ startedAt: Date.UTC(2026, 9, 3, 15), points: 0 }]) =>
    ({ name, rides }) as unknown as PlayerActivity;

  it("names the file after the day and the player, without accents", () => {
    expect(fitFileName(activity("Léa"))).toBe("sonne-la-cloche-2026-10-03-Lea.fit");
    expect(fitFileName(activity("Zoé & Chloë"))).toBe("sonne-la-cloche-2026-10-03-Zoe-Chloe.fit");
  });

  it("falls back to a neutral name when nothing usable is left", () => {
    expect(fitFileName(activity("🚴"))).toBe("sonne-la-cloche-2026-10-03-player.fit");
  });
});

describe("toBase64", () => {
  it("encodes any byte, as the upload expects", () => {
    expect(toBase64(new Uint8Array([0, 255, 14, 46, 70, 73, 84]))).toBe(btoa("\x00\xff\x0e.FIT"));
  });
});
