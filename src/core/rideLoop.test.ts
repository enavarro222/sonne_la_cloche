import { describe, expect, it } from "vitest";
import {
  commonCourse,
  type Course,
  handicapCourse,
  RAISE_AFTER_SEC,
  steadySpeed,
} from "./handicap";
import { FINALE_LIFT, FINALE_SEC } from "./ride";
import {
  isRideStateOver,
  type RideEvent,
  type RideState,
  riddenGrade,
  rideOutcome,
  startRideState,
  stepRideState,
  TICK_FROM_SEC,
} from "./rideLoop";
import { DEFAULT_SETTINGS, type Settings } from "./settings";

const FRAME_SEC = 0.05;

/** Rides the whole ride at constant effort, collecting the events with their time. */
function ride(
  settings: Settings,
  course: Course | null,
  power: number,
  recordMetres: number | null = null,
) {
  let state: RideState = startRideState(settings, recordMetres, course);
  const events: { at: number; event: RideEvent }[] = [];
  while (!isRideStateOver(state, settings)) {
    const step = stepRideState(state, { cadence: 90, power }, FRAME_SEC, settings);
    state = step.state;
    events.push(...step.events.map((event) => ({ at: state.progress.elapsedSec, event })));
  }
  return {
    state,
    events,
    of: (type: RideEvent["type"]) => events.filter((e) => e.event.type === type),
  };
}

const flat: Settings = { ...DEFAULT_SETTINGS, slope: "flat", durationSec: 20, finale: "off" };

describe("ride loop", () => {
  it("starts at the course's speed, on its slope", () => {
    const course = commonCourse(5, false);
    const state = startRideState({ ...flat, slope: "hill" }, null, course);
    expect(state.progress.speed).toBe(course.startSpeed);
    expect(riddenGrade(state, { ...flat, slope: "hill" })).toBe(5);
  });

  it("ticks once for each of the last seconds", () => {
    const ticks = ride(flat, commonCourse(0, false), 150).of("tick");
    expect(ticks).toHaveLength(TICK_FROM_SEC);
    expect(ticks.map((e) => Math.ceil(flat.durationSec - e.at))).toEqual([5, 4, 3, 2, 1]);
  });

  it("rings the bell once, when passing the record", () => {
    const { of, state } = ride(flat, commonCourse(0, false), 150, 50);
    expect(of("bell")).toHaveLength(1);
    expect(state.rung).toBe(true);
    expect(ride(flat, commonCourse(0, false), 150, 10_000).of("bell")).toHaveLength(0);
  });

  it("sends no slope on a plain ride", () => {
    expect(ride(flat, commonCourse(0, false), 150).of("slope")).toEqual([]);
  });

  it("raises the slope of a player well above their level, once", () => {
    const course = handicapCourse(0, steadySpeed(100, 0), 150);
    const { of, state } = ride(flat, course, 250);
    const slopes = of("slope");
    expect(slopes).toHaveLength(1);
    expect(slopes[0]?.at).toBeGreaterThanOrEqual(RAISE_AFTER_SEC);
    expect(state.course?.gradePct).toBeGreaterThan(course.gradePct);
    expect(rideOutcome(state).gradePct).toBe(state.course?.gradePct);
  });

  it("decides the finale once, with the last seconds, and sends its slope", () => {
    const settings = { ...flat, slope: "hill", finale: "on" } as const;
    const ahead = ride(settings, commonCourse(5, false), 300, 20);
    expect(ahead.state.finale).toBe("lift");
    const slopes = ahead.of("slope");
    expect(slopes.map((e) => e.event)).toEqual([{ type: "slope", gradePct: 5 + FINALE_LIFT }]);
    expect(slopes[0]?.at).toBeCloseTo(settings.durationSec - FINALE_SEC, 1);
    const behind = ride(settings, commonCourse(5, false), 0, 20);
    expect(behind.state.finale).toBe("flee");
    expect(riddenGrade(behind.state, settings)).toBe(5 - FINALE_LIFT);
  });

  it("scores pedal turns without a course, and records no slope", () => {
    const settings = { ...flat, metric: "cadence" } as const;
    const { state } = ride(settings, null, 0);
    expect(state.progress.metres).toBeGreaterThan(0);
    expect(rideOutcome(state)).not.toHaveProperty("gradePct");
  });
});
