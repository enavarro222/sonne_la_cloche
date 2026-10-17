// A whole ride, frame by frame: what the ride screen's loop decides on each
// sensor reading. Pure: it returns what happened as events (a new slope for
// the trainer, the bell, a tick of the last seconds) and the UI acts on them.

import { type Course, raiseCourse } from "./handicap";
import {
  type BellMark,
  bellMark,
  type Effort,
  FINALE_SEC,
  type FinaleMove,
  finaleFor,
  finaleGrade,
  isRideOver,
  remainingSec,
  type RideProgress,
  type RideStats,
  rideStats,
  ringsBell,
  startRide,
  startTrack,
  stepRide,
  stepTrack,
  type Track,
} from "./ride";
import { SLOPE_PERCENT, type Settings } from "./settings";

/** The last seconds tick, from this many seconds left. */
export const TICK_FROM_SEC = 5;

export interface RideState {
  progress: RideProgress;
  /** By distance, the course ridden, raised mid-ride if it was; null by leg speed. */
  course: Course | null;
  /** What there is to beat: the record, or a first-ride goal. */
  mark: BellMark;
  track: Track;
  /** The bell's mark was passed during this ride. */
  rung: boolean;
  /** The pole bearer's move in the last seconds, once decided. */
  finale: FinaleMove | null;
  /** The last second ticked, counting down. */
  lastTick: number;
}

export type RideEvent =
  /** The trainer must now simulate this slope, in percent. */
  { type: "slope"; gradePct: number } | { type: "bell" } | { type: "tick" };

export function startRideState(
  settings: Settings,
  recordMetres: number | null,
  course: Course | null,
): RideState {
  const mark = bellMark(recordMetres, settings);
  return {
    // A flying start: the speed at "Go" is the one the player's level holds.
    progress: startRide(course?.startSpeed),
    course,
    mark,
    track: startTrack(mark, settings),
    rung: false,
    finale: null,
    lastTick: TICK_FROM_SEC + 1,
  };
}

/** The slope ridden now, in percent: the course's, unless the finale changed it. */
export function riddenGrade(state: RideState, settings: Settings): number {
  const grade = state.course?.gradePct ?? SLOPE_PERCENT[settings.slope];
  return state.finale ? finaleGrade(grade, state.finale) : grade;
}

export function stepRideState(
  state: RideState,
  effort: Effort,
  dtSec: number,
  settings: Settings,
): { state: RideState; events: RideEvent[] } {
  const { durationSec, metric } = settings;
  const events: RideEvent[] = [];
  const grade = riddenGrade(state, settings);
  const progress = stepRide(
    state.progress,
    effort,
    metric,
    dtSec,
    durationSec,
    state.course ? { ...state.course, gradePct: grade } : undefined,
    grade,
  );
  let next: RideState = { ...state, progress };

  if (next.course) {
    const raised = raiseCourse(next.course, rideStats(progress).avgPower, progress.elapsedSec);
    if (raised !== next.course) {
      next = { ...next, course: raised };
      events.push({ type: "slope", gradePct: riddenGrade(next, settings) });
    }
  }
  if (
    settings.finale === "on" &&
    !next.finale &&
    remainingSec(progress, durationSec) <= FINALE_SEC
  ) {
    next = {
      ...next,
      finale: finaleFor(progress.metres, next.mark, progress.elapsedSec, durationSec),
    };
    events.push({ type: "slope", gradePct: riddenGrade(next, settings) });
  }
  next = { ...next, track: stepTrack(next.track, progress.metres, dtSec) };
  if (!next.rung && ringsBell(progress.metres, next.mark)) {
    next = { ...next, rung: true };
    events.push({ type: "bell" });
  }
  const secondsLeft = Math.ceil(remainingSec(progress, durationSec));
  if (secondsLeft <= TICK_FROM_SEC && secondsLeft > 0 && secondsLeft < next.lastTick) {
    next = { ...next, lastTick: secondsLeft };
    events.push({ type: "tick" });
  }
  return { state: next, events };
}

export const isRideStateOver = (state: RideState, settings: Settings): boolean =>
  isRideOver(state.progress, settings.durationSec);

/** The ride as the game records it, once over. */
export function rideOutcome(state: RideState): {
  metres: number;
  stats: RideStats;
  gradePct?: number;
} {
  return {
    metres: state.progress.metres,
    stats: rideStats(state.progress),
    ...(state.course && { gradePct: state.course.gradePct }),
  };
}
