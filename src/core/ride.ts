import type { Metric, Settings } from "./settings";

// Scoring during a single ride. Pure functions: the UI loop feeds them time
// steps and sensor values.

/** Points per second = sensor value / 3 (≈ 30 pts/s at 90 rpm). */
export const POINTS_DIVISOR = 3;

/**
 * Longest time step counted in one go. A backgrounded tab pauses animation
 * frames; without this cap the next frame would count the whole gap with a
 * stale sensor value. The ride simply pauses instead.
 */
export const MAX_STEP_SEC = 0.25;

/** The end of the track is never closer than this. */
export const MIN_TARGET = 100;

export interface RideProgress {
  elapsedSec: number;
  points: number;
}

export const startRide = (): RideProgress => ({ elapsedSec: 0, points: 0 });

export function stepRide(
  progress: RideProgress,
  value: number,
  dtSec: number,
  durationSec: number,
): RideProgress {
  const remaining = durationSec - progress.elapsedSec;
  const dt = Math.min(Math.max(0, dtSec), MAX_STEP_SEC, Math.max(0, remaining));
  const rate = Number.isFinite(value) ? Math.max(0, value) / POINTS_DIVISOR : 0;
  return { elapsedSec: progress.elapsedSec + dt, points: progress.points + rate * dt };
}

export const remainingSec = (progress: RideProgress, durationSec: number): number =>
  Math.max(0, durationSec - progress.elapsedSec);

export const isRideOver = (progress: RideProgress, durationSec: number): boolean =>
  remainingSec(progress, durationSec) === 0;

// --- track ------------------------------------------------------------------
// The track shows points on a scale that ends at `target`. It starts sized
// for a good ride, and stretches when the bike gets close to the end so the
// bike never gets stuck there. The bell marks what there is to beat.

/** A "good ride": this pace held for the whole ride. */
export const REFERENCE_PACE: Record<Metric, number> = { cadence: 80, power: 60 };

export const referencePoints = (settings: Settings): number =>
  (REFERENCE_PACE[settings.metric] * settings.durationSec) / POINTS_DIVISOR;

/**
 * What the bell marks: the record, or — when nobody has scored yet — a goal
 * worth a good ride, so the first ride has something to aim at too.
 */
export interface BellMark {
  kind: "record" | "goal";
  points: number;
}

export const bellMark = (recordPoints: number | null, settings: Settings): BellMark =>
  recordPoints !== null && recordPoints > 0
    ? { kind: "record", points: recordPoints }
    : { kind: "goal", points: referencePoints(settings) };

/** The bell rings once the ride goes past its mark. */
export const ringsBell = (points: number, mark: BellMark): boolean => points > mark.points;

/** Past this position the end of the track starts moving away… */
export const STRETCH_FROM = 0.85;
/** …until the bike is back to this position. */
export const STRETCH_TO = 0.6;
/** Time constant of the stretch: the end recedes smoothly, not at once. */
export const STRETCH_TIME_SEC = 0.4;

export interface Track {
  /** Points at the right end of the track. */
  target: number;
  /** Where `target` is heading while the track stretches. */
  heading: number;
}

export function startTrack(mark: BellMark, settings: Settings): Track {
  // The bell sits a bit before the end when it is the harder mark.
  const target = Math.max(referencePoints(settings), mark.points * 1.05, MIN_TARGET);
  return { target, heading: target };
}

export function stepTrack(track: Track, points: number, dtSec: number): Track {
  let { target, heading } = track;
  // While stretching, the heading keeps up with a fast bike instead of letting
  // it catch up with the end of the track.
  if (heading > target || points > target * STRETCH_FROM) {
    heading = Math.max(heading, points / STRETCH_TO);
  }
  target = heading - (heading - target) * Math.exp(-Math.max(0, dtSec) / STRETCH_TIME_SEC);
  if (heading - target < 0.5) target = heading;
  return { target, heading };
}

/** Position on the track, from 0 (start) to 1 (right end). */
export const trackPosition = (points: number, target: number): number =>
  Math.min(1, Math.max(0, points / target));
