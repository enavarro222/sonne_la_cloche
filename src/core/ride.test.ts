import { describe, expect, it } from "vitest";
import {
  isRideOver,
  MAX_STEP_SEC,
  remainingSec,
  startRide,
  stepRide,
  bellMark,
  REFERENCE_PACE,
  rideStats,
  ringsBell,
  startTrack,
  STRETCH_FROM,
  stepTrack,
  type Track,
  trackPosition,
} from "./ride";
import { DEFAULT_SETTINGS } from "./settings";

const effort = (cadence: number, power = 0) => ({ cadence, power });

const steps = (value: number, dt: number, count: number, duration = 30) => {
  let progress = startRide();
  for (let i = 0; i < count; i++) {
    progress = stepRide(progress, effort(value), "cadence", dt, duration);
  }
  return progress;
};

describe("stepRide", () => {
  it("scores value/3 points per second", () => {
    const progress = steps(90, 0.1, 100);
    expect(progress.points).toBeCloseTo(300);
    expect(progress.elapsedSec).toBeCloseTo(10);
  });

  it("never counts beyond the ride duration", () => {
    const progress = steps(90, 0.2, 200, 30);
    expect(progress.elapsedSec).toBe(30);
    expect(progress.points).toBeCloseTo(900);
    expect(isRideOver(progress, 30)).toBe(true);
    expect(remainingSec(progress, 30)).toBe(0);
  });

  it("caps long frames so a backgrounded tab pauses the ride", () => {
    const progress = stepRide(startRide(), effort(90), "cadence", 10, 30);
    expect(progress.elapsedSec).toBe(MAX_STEP_SEC);
  });

  it("ignores negative or invalid values and time steps", () => {
    expect(stepRide(startRide(), effort(-50), "cadence", 0.1, 30).points).toBe(0);
    expect(stepRide(startRide(), effort(Number.NaN), "cadence", 0.1, 30).points).toBe(0);
    expect(stepRide(startRide(), effort(90), "cadence", -1, 30)).toEqual(startRide());
  });

  it("scores the chosen metric", () => {
    const ride = stepRide(startRide(), effort(90, 150), "power", 0.2, 30);
    expect(ride.points).toBeCloseTo(10);
  });

  it("averages cadence and power over the time ridden, and keeps the peaks", () => {
    let progress = startRide();
    progress = stepRide(progress, effort(60, 100), "cadence", 0.2, 30);
    progress = stepRide(progress, effort(120, 200), "cadence", 0.2, 30);
    expect(rideStats(progress)).toEqual({
      avgCadence: 90,
      avgPower: 150,
      maxCadence: 120,
      maxPower: 200,
    });
    expect(rideStats(startRide()).avgCadence).toBe(0);
  });
});

describe("track", () => {
  const settings = { ...DEFAULT_SETTINGS, metric: "cadence" as const, durationSec: 30 as const };
  const goal = bellMark(null, settings);

  it("gives the first ride a goal worth a good ride", () => {
    // 80 rpm for 30 s → 800 points.
    expect(REFERENCE_PACE.cadence).toBe(80);
    expect(goal).toEqual({ kind: "goal", points: 800 });
    expect(bellMark(0, settings)).toEqual(goal);
    expect(bellMark(0, { ...settings, durationSec: 20 }).points).toBeCloseTo(533.3, 1);
    expect(bellMark(0, { ...settings, metric: "power" }).points).toBe(600);
    expect(bellMark(450, settings)).toEqual({ kind: "record", points: 450 });
  });

  it("puts the bell a bit before the end when it is the harder mark", () => {
    expect(startTrack(goal, settings).target).toBe(840);
    expect(startTrack({ kind: "record", points: 1000 }, settings).target).toBe(1050);
    expect(startTrack({ kind: "record", points: 200 }, settings).target).toBe(800);
  });

  it("does not move while the bike is far from the end", () => {
    const track = startTrack(goal, settings);
    expect(stepTrack(track, 600, 0.016)).toEqual(track);
  });

  it("stretches smoothly once the bike nears the end, never trapping it", () => {
    let track: Track = startTrack(goal, settings);
    let points = 0;
    const positions: number[] = [];
    let previousTarget = track.target;
    // Pedaling far above the reference: 200 pts/s for 30 s at 60 fps.
    for (let frame = 0; frame < 30 * 60; frame++) {
      points += 200 / 60;
      track = stepTrack(track, points, 1 / 60);
      expect(track.target).toBeGreaterThanOrEqual(previousTarget);
      // Smooth: the end never jumps by more than a few % in one frame.
      expect(track.target / previousTarget).toBeLessThan(1.05);
      previousTarget = track.target;
      positions.push(trackPosition(points, track.target));
    }
    expect(Math.max(...positions)).toBeLessThan(STRETCH_FROM + 0.05);
    expect(track.target).toBeGreaterThan(points);
  });

  it("clamps the position between start and finish", () => {
    expect(trackPosition(50, 100)).toBe(0.5);
    expect(trackPosition(500, 100)).toBe(1);
    expect(trackPosition(-5, 100)).toBe(0);
  });
});

describe("ringsBell", () => {
  it("rings once the ride goes past the mark", () => {
    const mark = { kind: "record" as const, points: 500 };
    expect(ringsBell(500, mark)).toBe(false);
    expect(ringsBell(501, mark)).toBe(true);
  });
});
