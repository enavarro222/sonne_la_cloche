import { describe, expect, it } from "vitest";
import { metresPerSecond, positionOnTrack, TRACK_RADIUS_M } from "./virtualTrack";

describe("virtual track", () => {
  it("turns cadence into distance: 90 rpm at 4 m per turn is 6 m/s", () => {
    expect(metresPerSecond(90)).toBe(6);
    expect(metresPerSecond(-5)).toBe(0);
  });

  it("stays on a circle of the track radius around the center", () => {
    const center = { lat: 43.9, lon: 1.9 };
    for (const distance of [0, 40, 100, 1000]) {
      const p = positionOnTrack(center, distance);
      const north = ((p.lat - center.lat) * Math.PI * 6_371_000) / 180;
      const east =
        ((p.lon - center.lon) * Math.PI * 6_371_000 * Math.cos((center.lat * Math.PI) / 180)) / 180;
      expect(Math.hypot(north, east)).toBeCloseTo(TRACK_RADIUS_M, 3);
    }
  });
});
