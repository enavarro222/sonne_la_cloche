import { describe, expect, it } from "vitest";
import {
  isRideOver,
  MAX_STEP_SEC,
  remainingSec,
  startRide,
  stepRide,
  bellMark,
  cadenceSpeed,
  FINALE_LIFT,
  finaleFor,
  finaleGrade,
  REFERENCE_CADENCE,
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
  it("scores metres: 4 m per pedal turn, once the bike is up to speed", () => {
    expect(cadenceSpeed(90)).toBe(6);
    const progress = steps(90, 0.1, 100);
    expect(progress.speed).toBeCloseTo(6);
    // 60 m in 10 s at 6 m/s, less the first second picking up speed.
    expect(progress.points).toBeGreaterThan(54);
    expect(progress.points).toBeLessThan(57);
    expect(progress.elapsedSec).toBeCloseTo(10);
  });

  it("rolls on when the legs stop, slowing down", () => {
    let progress = steps(90, 0.1, 100);
    const before = progress.points;
    for (let i = 0; i < 10; i++) {
      progress = stepRide(progress, effort(0), "cadence", 0.1, 30);
    }
    expect(progress.speed).toBeGreaterThan(3);
    expect(progress.speed).toBeLessThan(6);
    expect(progress.points).toBeGreaterThan(before + 3);
  });

  it("never counts beyond the ride duration", () => {
    const progress = steps(90, 0.2, 200, 30);
    expect(progress.elapsedSec).toBe(30);
    expect(progress.points).toBeCloseTo(175.8, 0);
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

  it("scores pedal turns, whatever the power", () => {
    const ride = stepRide(startRide(), effort(90, 150), "cadence", 0.2, 30);
    expect(ride.points).toBe(stepRide(startRide(), effort(90, 0), "cadence", 0.2, 30).points);
    expect(ride.points).toBeGreaterThan(0);
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

describe("ride samples", () => {
  it("records one sample per second, with the effort of that moment", () => {
    let progress = startRide();
    for (let i = 0; i < 60; i++) {
      progress = stepRide(progress, effort(i < 30 ? 60 : 90, 100), "cadence", 1 / 30, 20);
    }
    expect(progress.samples).toEqual([
      { second: 1, cadence: 60, power: 100 },
      { second: 2, cadence: 90, power: 100 },
    ]);
  });

  it("records the slope ridden each second, as it changes", () => {
    let progress = startRide();
    for (let i = 0; i < 60; i++) {
      progress = stepRide(
        progress,
        effort(80),
        "cadence",
        1 / 30,
        20,
        undefined,
        i < 30 ? 5 : 8.04,
      );
    }
    expect(progress.samples.map((s) => s.gradePct)).toEqual([5, 8]);
  });

  it("ends with one sample per second of the ride, despite rounding", () => {
    let progress = startRide();
    // 1/60 s frames do not add up exactly to whole seconds in floating point.
    for (let i = 0; i < 20 * 60 + 10; i++)
      progress = stepRide(progress, effort(80), "cadence", 1 / 60, 20);
    expect(progress.samples.map((s) => s.second)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
  });
});

describe("track", () => {
  const settings = { ...DEFAULT_SETTINGS, metric: "cadence" as const, durationSec: 30 as const };
  const goal = bellMark(null, settings);

  it("gives the first ride a goal worth a good ride", () => {
    // 80 rpm for 30 s, 4 m per turn → 160 m.
    expect(REFERENCE_CADENCE).toBe(80);
    expect(goal).toEqual({ kind: "goal", points: 160 });
    expect(bellMark(0, settings)).toEqual(goal);
    expect(bellMark(0, { ...settings, durationSec: 20 }).points).toBeCloseTo(106.7, 1);
    // By distance: 7 m/s (25 km/h) for 30 s.
    expect(bellMark(0, { ...settings, metric: "distance" }).points).toBe(210);
    expect(bellMark(450, settings)).toEqual({ kind: "record", points: 450 });
  });

  it("puts the bell a bit before the end when it is the harder mark", () => {
    expect(startTrack(goal, settings).target).toBe(168);
    expect(startTrack({ kind: "record", points: 1000 }, settings).target).toBe(1050);
    expect(startTrack({ kind: "record", points: 120 }, settings).target).toBe(160);
  });

  it("does not move while the bike is far from the end", () => {
    const track = startTrack(goal, settings);
    expect(stepTrack(track, 100, 0.016)).toEqual(track);
  });

  it("stretches smoothly once the bike nears the end, never trapping it", () => {
    let track: Track = startTrack(goal, settings);
    let points = 0;
    const positions: number[] = [];
    let previousTarget = track.target;
    // Far above the reference: 200 m/s for 30 s at 60 fps.
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

describe("finale", () => {
  const record = { kind: "record" as const, points: 300 };

  it("lifts for a rider ahead of the bell's pace, lets the track fall otherwise", () => {
    // 25 s into 30: the bell's pace is 250 points.
    expect(finaleFor(260, record, 25, 30)).toBe("lift");
    expect(finaleFor(240, record, 25, 30)).toBe("flee");
  });

  it("adds a few percent, or flattens the road", () => {
    expect(finaleGrade(4, "lift")).toBe(4 + FINALE_LIFT);
    expect(finaleGrade(4, "flee")).toBe(0);
  });
});
