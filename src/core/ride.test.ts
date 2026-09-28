import { describe, expect, it } from "vitest";
import {
  isRideOver,
  MAX_STEP_SEC,
  remainingSec,
  startRide,
  stepRide,
  trackPosition,
  trackTarget,
} from "./ride";

const steps = (value: number, dt: number, count: number, duration = 30) => {
  let progress = startRide();
  for (let i = 0; i < count; i++) progress = stepRide(progress, value, dt, duration);
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
    const progress = stepRide(startRide(), 90, 10, 30);
    expect(progress.elapsedSec).toBe(MAX_STEP_SEC);
  });

  it("ignores negative or invalid values and time steps", () => {
    expect(stepRide(startRide(), -50, 0.1, 30).points).toBe(0);
    expect(stepRide(startRide(), Number.NaN, 0.1, 30).points).toBe(0);
    expect(stepRide(startRide(), 90, -1, 30)).toEqual(startRide());
  });
});

describe("track", () => {
  it("puts the target a bit above the record, with a minimum", () => {
    expect(trackTarget(0)).toBe(100);
    expect(trackTarget(200)).toBe(210);
  });

  it("clamps the position between start and finish", () => {
    expect(trackPosition(50, 100)).toBe(0.5);
    expect(trackPosition(500, 100)).toBe(1);
    expect(trackPosition(-5, 100)).toBe(0);
  });
});
