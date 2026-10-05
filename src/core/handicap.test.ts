import { describe, expect, it } from "vitest";
import { type Action, type Game, initialState, reducer } from "./game";
import {
  CALIBRATION_WEIGHT,
  type Course,
  courseFor,
  gradeFor,
  MAX_EXTRA_GRADE,
  raiseCourse,
  RAISE_AFTER_SEC,
  referencePowers,
  steadySpeed,
  stepSpeed,
} from "./handicap";
import { NO_STATS, startRide, stepRide } from "./ride";
import { DEFAULT_SETTINGS, type Slope } from "./settings";

const lea = { id: "lea", name: "Léa" };
const tom = { id: "tom", name: "Tom" };

const kmh = (metresPerSecond: number) => metresPerSecond * 3.6;

/** A game of Léa then Tom, after the given average powers ride in turn. */
function played(avgPowers: number[], slope: Slope = "flat"): Game {
  const actions: Action[] = [{ type: "gameStarted" }];
  for (const avgPower of avgPowers) {
    actions.push(
      {
        type: "rideFinished",
        points: 100,
        stats: { ...NO_STATS, avgPower },
        trace: { startedAt: "2026-10-05T15:00:00.000Z", samples: [] },
      },
      { type: "nextTurn" },
    );
  }
  const { game } = actions.reduce(
    reducer,
    initialState([lea, tom], { ...DEFAULT_SETTINGS, metric: "slope", slope }),
  );
  if (!game) throw new Error("game did not start");
  return game;
}

/** Distance (points at weight 1) covered at constant power on a course. */
function distance(course: Course, power: number, seconds = 30): number {
  let progress = startRide(course.startSpeed);
  for (let t = 0; t < seconds; t += 0.05) {
    progress = stepRide(progress, { cadence: 90, power }, "slope", 0.05, seconds, course);
  }
  return progress.points / course.weight;
}

describe("physics", () => {
  it("holds about 31 km/h on the flat at 150 W", () => {
    expect(kmh(steadySpeed(150, 0))).toBeCloseTo(30.8, 1);
  });

  it("finds the grade where a power holds a speed", () => {
    const speed = steadySpeed(150, 0);
    expect(gradeFor(150, speed)).toBeCloseTo(0, 3);
    expect(gradeFor(350, speed)).toBeCloseTo(2.98, 2);
    expect(steadySpeed(350, gradeFor(350, speed))).toBeCloseTo(speed, 3);
  });

  it("keeps a steady speed steady, speeds up or slows down otherwise", () => {
    const speed = steadySpeed(200, 3);
    expect(stepSpeed(speed, 200, 3, 0.25)).toBeCloseTo(speed, 6);
    expect(stepSpeed(speed, 300, 3, 0.25)).toBeGreaterThan(speed);
    expect(stepSpeed(speed, 0, 3, 0.25)).toBeLessThan(speed);
    expect(stepSpeed(0.1, 0, 3, 1)).toBe(0);
  });
});

describe("courseFor", () => {
  it("measures everyone in round 1, on the common slope, for half the points", () => {
    const course = courseFor(played([], "hill"));
    expect(course).toEqual({
      baseGradePct: 5,
      gradePct: 5,
      startSpeed: steadySpeed(100, 5),
      weight: CALIBRATION_WEIGHT,
      targetPower: null,
    });
  });

  it("from round 2, gives the stronger a steeper slope at the weakest's speed", () => {
    const leaRides = courseFor(played([150, 350]));
    expect(leaRides.gradePct).toBeCloseTo(0, 3);
    expect(kmh(leaRides.startSpeed)).toBeCloseTo(30.8, 1);
    expect(leaRides.targetPower).toBe(150);
    expect(leaRides.weight).toBe(1);

    const tomRides = courseFor(played([150, 350, 150]));
    expect(tomRides.gradePct).toBeCloseTo(2.98, 2);
    expect(tomRides.startSpeed).toBe(leaRides.startSpeed);
  });

  it("is fair: each player at their reference covers the same distance", () => {
    for (const [weak, strong] of [
      [150, 350],
      [50, 300],
    ] as const) {
      const leaRides = courseFor(played([weak, strong]));
      const tomRides = courseFor(played([weak, strong, weak]));
      expect(distance(tomRides, strong)).toBeCloseTo(distance(leaRides, weak), 0);
    }
  });

  it("adds the handicap on top of the common slope", () => {
    const tomRides = courseFor(played([150, 350, 150], "gentle"));
    expect(tomRides.baseGradePct).toBe(2);
    expect(tomRides.gradePct).toBeGreaterThan(4);
  });

  it("caps the handicap", () => {
    expect(courseFor(played([20, 2000, 20])).gradePct).toBe(MAX_EXTRA_GRADE);
  });

  it("copes with a player who did not pedal in round 1", () => {
    const course = courseFor(played([0, 200]));
    expect(course.startSpeed).toBeGreaterThan(0);
    expect(Number.isFinite(course.gradePct)).toBe(true);
  });
});

describe("referencePowers", () => {
  it("keeps each player's best average: it only goes up", () => {
    const refs = referencePowers(played([150, 300, 180, 250]));
    expect(refs).toEqual(
      new Map([
        ["lea", 180],
        ["tom", 300],
      ]),
    );
  });
});

describe("raiseCourse", () => {
  const course = courseFor(played([150, 350, 150]));

  it("steepens the slope of a player well above their level", () => {
    const raised = raiseCourse(course, 420, RAISE_AFTER_SEC);
    expect(raised.gradePct).toBeGreaterThan(course.gradePct);
    expect(raised.targetPower).toBe(420);
    expect(raised.startSpeed).toBe(course.startSpeed);
  });

  it("ignores a short burst, a small excess, and calibration", () => {
    expect(raiseCourse(course, 420, RAISE_AFTER_SEC - 1)).toBe(course);
    expect(raiseCourse(course, 370, RAISE_AFTER_SEC)).toBe(course);
    const calibration = courseFor(played([]));
    expect(raiseCourse(calibration, 400, 20)).toBe(calibration);
  });
});
