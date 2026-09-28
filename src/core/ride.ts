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

/** The track target sits slightly above the record, never below this. */
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

/** Where the finish of the track is, in points, given the current record. */
export const trackTarget = (recordPoints: number): number =>
  Math.max(recordPoints * 1.05, MIN_TARGET);

/** Position on the track, from 0 (start) to 1 (finish line). */
export const trackPosition = (points: number, target: number): number =>
  Math.min(1, Math.max(0, points / target));
