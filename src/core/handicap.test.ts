import { DEFAULT_ROAD, gearedSimulation } from "home-trainer-kit/gears";
import { describe, expect, it } from "vitest";
import { type Action, type Game, initialState, reducer } from "./game";
import { courseFor, courseOf, referencePowers } from "./course";
import {
  type Course,
  gradeFor,
  MAX_EXTRA_GRADE,
  raiseCourse,
  RAISE_AFTER_SEC,
  steadySpeed,
  TRAINER_ROAD,
  stepSpeed,
} from "./handicap";
import { NO_STATS, startRide, stepRide } from "./ride";
import { DEFAULT_SETTINGS, type Slope } from "./settings";

const lea = { id: "lea", name: "Léa" };
const tom = { id: "tom", name: "Tom" };

const kmh = (metresPerSecond: number) => metresPerSecond * 3.6;

/** A game of Léa then Tom, after the given average powers ride in turn. */
function played(avgPowers: number[], slope: Slope = "own"): Game {
  const actions: Action[] = [{ type: "gameStarted" }];
  for (const avgPower of avgPowers) {
    actions.push(
      {
        type: "rideFinished",
        metres: 100,
        stats: { ...NO_STATS, avgPower },
        trace: { startedAt: "2026-10-05T15:00:00.000Z", samples: [] },
      },
      { type: "nextTurn" },
    );
  }
  const { game } = actions.reduce(
    reducer,
    initialState([lea, tom], { ...DEFAULT_SETTINGS, metric: "distance", slope }),
  );
  if (!game) throw new Error("game did not start");
  return game;
}

/** Distance covered at constant power on a course. */
function distance(course: Course, power: number, seconds = 30): number {
  let progress = startRide(course.startSpeed);
  for (let t = 0; t < seconds; t += 0.05) {
    progress = stepRide(progress, { cadence: 90, power }, "distance", 0.05, seconds, course);
  }
  return progress.metres;
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
  it("measures everyone in round 1, on the flat", () => {
    expect(courseFor(played([]))).toEqual({
      baseGradePct: 0,
      gradePct: 0,
      startSpeed: steadySpeed(100, 0),
      targetPower: null,
      measuring: true,
    });
  });

  it("on a common slope, puts everyone on the same road, every round", () => {
    const course = {
      baseGradePct: 5,
      gradePct: 5,
      startSpeed: steadySpeed(100, 5),
      targetPower: null,
      measuring: false,
    };
    expect(courseFor(played([], "hill"))).toEqual(course);
    expect(courseFor(played([150, 350, 150], "hill"))).toEqual(course);
  });

  it("from round 2, gives the stronger a steeper slope at the weakest's speed", () => {
    const leaRides = courseFor(played([150, 350]));
    expect(leaRides.gradePct).toBeCloseTo(0, 3);
    expect(kmh(leaRides.startSpeed)).toBeCloseTo(30.8, 1);
    expect(leaRides.targetPower).toBe(150);

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

  it("does not depend on the order of play within a round", () => {
    // Round 1: Léa 50 W, Tom 300 W. In round 2 Léa rides first and improves.
    const tomFirst = courseOf(played([50, 300]), "tom", 2);
    const tomAfterLea = courseFor(played([50, 300, 70]));
    expect(tomAfterLea).toEqual(tomFirst);
    // Léa's progress counts from round 3 on, for everyone.
    const roundThree = courseFor(played([50, 300, 70, 300]));
    expect(roundThree.startSpeed).toBeGreaterThan(tomFirst.startSpeed);
  });

  it("gives a retried ride the course of the first attempt", () => {
    const first = courseFor(played([50, 300]));
    const retry: Action[] = [
      {
        type: "rideFinished",
        metres: 100,
        stats: { ...NO_STATS, avgPower: 120 },
        trace: { startedAt: "2026-10-05T15:00:00.000Z", samples: [] },
      },
      { type: "rideRetried" },
    ];
    const start = played([50, 300]);
    const { game } = retry.reduce(reducer, {
      roster: [lea, tom],
      settings: start.settings,
      game: start,
    });
    expect(game?.phase).toBe("riding");
    expect(game && courseFor(game)).toEqual(first);
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
  it("can leave out a round and the ones after it", () => {
    expect(referencePowers(played([150, 300, 180, 250]), 2)).toEqual(
      new Map([
        ["lea", 150],
        ["tom", 300],
      ]),
    );
  });

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

describe("TRAINER_ROAD", () => {
  it("is what FTMS receives: Crr 40 × 0.0001, wind coefficient 20 × 0.01 kg/m", () => {
    // Rounded as the kit's encodeSetSimulation does, without a virtual gear.
    const sim = gearedSimulation(5, TRAINER_ROAD, 1);
    expect(Math.round(sim.rolling * 10_000)).toBe(40);
    expect(Math.round(sim.airDrag * 100)).toBe(20);
  });

  it("differs from the kit's default road, so useSensor must be given it", () => {
    expect(Math.round(DEFAULT_ROAD.airDrag * 100)).not.toBe(Math.round(TRAINER_ROAD.airDrag * 100));
  });
});
