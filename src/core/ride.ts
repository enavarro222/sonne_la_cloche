import { type Course, stepSpeed } from "./handicap";
import type { Metric, Settings } from "./settings";

// Scoring during a single ride. Pure functions: the UI loop feeds them time
// steps and sensor values.

/**
 * Leg speed scores metres too, on a virtual bike in a low gear (a kid's
 * bike): this many metres per crank turn, so 90 rpm is 6 m/s (21.6 km/h).
 * Without watts the slope cannot count: the ranking is that of pedal turns.
 */
export const METRES_PER_CRANK_TURN = 4;
/** The virtual bike picks up speed over this time (s)… */
const SPEED_UP_SEC = 0.8;
/** …and rolls on, slowing down over this one, when the legs stop. */
const COAST_SEC = 2;

/** The speed the legs drive the virtual bike at, m/s. */
export const cadenceSpeed = (cadence: number): number =>
  (Math.max(0, cadence) / 60) * METRES_PER_CRANK_TURN;

/** The virtual bike's speed after `dt`, heading for what the legs drive. */
export function stepCadenceSpeed(speed: number, cadence: number, dt: number): number {
  const target = cadenceSpeed(cadence);
  const time = target > speed ? SPEED_UP_SEC : COAST_SEC;
  return speed + (target - speed) * (1 - Math.exp(-dt / time));
}

/**
 * Longest time step counted in one go. A backgrounded tab pauses animation
 * frames; without this cap the next frame would count the whole gap with a
 * stale sensor value. The ride simply pauses instead.
 */
export const MAX_STEP_SEC = 0.25;

/** The end of the track is never closer than this. */
export const MIN_TARGET = 100;

/** What the sensor measures at a given instant. */
export interface Effort {
  /** Pedal turns per minute. */
  cadence: number;
  /** Watts. */
  power: number;
}

/** One measurement per second of ride, for the activity export. */
export interface RideSample {
  /** Seconds since the start of the ride: 1, 2, 3… */
  second: number;
  cadence: number;
  power: number;
  /** The slope ridden that second, in percent, when known. */
  gradePct?: number;
  /** The virtual bike's speed, m/s, to a tenth (missing in older links). */
  speed?: number;
}

export interface RideProgress {
  elapsedSec: number;
  metres: number;
  /** Virtual speed, m/s: from power by distance, from the legs by leg speed. */
  speed: number;
  /** Time integrals, for the averages. */
  cadenceSum: number;
  powerSum: number;
  maxCadence: number;
  maxPower: number;
  samples: readonly RideSample[];
}

export interface RideStats {
  avgCadence: number;
  avgPower: number;
  maxCadence: number;
  maxPower: number;
}

export const startRide = (speed = 0): RideProgress => ({
  elapsedSec: 0,
  metres: 0,
  speed,
  cadenceSum: 0,
  powerSum: 0,
  maxCadence: 0,
  maxPower: 0,
  samples: [],
});

/** Floating-point slack when checking whether a whole second was reached. */
const SAMPLE_EPSILON = 1e-6;

const clean = (value: number): number => (Number.isFinite(value) ? Math.max(0, value) : 0);

export function stepRide(
  progress: RideProgress,
  effort: Effort,
  metric: Metric,
  dtSec: number,
  durationSec: number,
  /** Required by distance. */
  course?: Course,
  /** The slope ridden now, recorded with the samples. */
  gradePct = course?.gradePct,
): RideProgress {
  const remaining = durationSec - progress.elapsedSec;
  const dt = Math.min(Math.max(0, dtSec), MAX_STEP_SEC, Math.max(0, remaining));
  if (dt === 0) return progress;
  const cadence = clean(effort.cadence);
  const power = clean(effort.power);
  const speed =
    metric === "distance"
      ? course
        ? stepSpeed(progress.speed, power, course.gradePct, dt)
        : 0
      : stepCadenceSpeed(progress.speed, cadence, dt);
  const gained = speed * dt;
  const elapsedSec = progress.elapsedSec + dt;
  // A sample each time a whole second is reached (a long frame may reach several).
  let samples = progress.samples;
  while (samples.length + 1 <= elapsedSec + SAMPLE_EPSILON) {
    samples = [
      ...samples,
      {
        second: samples.length + 1,
        cadence,
        power,
        speed: Math.round(speed * 10) / 10,
        ...(gradePct !== undefined && { gradePct: Math.round(gradePct * 10) / 10 }),
      },
    ];
  }
  return {
    elapsedSec,
    metres: progress.metres + gained,
    speed,
    cadenceSum: progress.cadenceSum + cadence * dt,
    powerSum: progress.powerSum + power * dt,
    maxCadence: Math.max(progress.maxCadence, cadence),
    maxPower: Math.max(progress.maxPower, power),
    samples,
  };
}

/** Averages over the time actually ridden. */
export function rideStats(progress: RideProgress): RideStats {
  const t = progress.elapsedSec;
  return {
    avgCadence: t > 0 ? progress.cadenceSum / t : 0,
    avgPower: t > 0 ? progress.powerSum / t : 0,
    maxCadence: progress.maxCadence,
    maxPower: progress.maxPower,
  };
}

export const NO_STATS: RideStats = { avgCadence: 0, avgPower: 0, maxCadence: 0, maxPower: 0 };

/** Stats from outside the core (UI), made safe to store and display. */
export const cleanStats = (stats: RideStats): RideStats => ({
  avgCadence: clean(stats.avgCadence),
  avgPower: clean(stats.avgPower),
  maxCadence: clean(stats.maxCadence),
  maxPower: clean(stats.maxPower),
});

export const remainingSec = (progress: RideProgress, durationSec: number): number =>
  Math.max(0, durationSec - progress.elapsedSec);

export const isRideOver = (progress: RideProgress, durationSec: number): boolean =>
  remainingSec(progress, durationSec) === 0;

// --- track ------------------------------------------------------------------
// The track shows metres on a scale that ends at `target`. It starts sized
// for a good ride, and stretches when the bike gets close to the end so the
// bike never gets stuck there. The bell marks what there is to beat.

/** A "good ride": this cadence (rpm) held for the whole ride… */
export const REFERENCE_CADENCE = 80;
/** …or, by distance, this speed (m/s, 25 km/h). */
export const REFERENCE_SPEED = 7;

export const referenceMetres = (settings: Settings): number =>
  settings.metric === "distance"
    ? REFERENCE_SPEED * settings.durationSec
    : cadenceSpeed(REFERENCE_CADENCE) * settings.durationSec;

/**
 * What the bell marks: the record, or — when nobody has scored yet — a goal
 * worth a good ride, so the first ride has something to aim at too.
 */
export interface BellMark {
  kind: "record" | "goal";
  metres: number;
}

export const bellMark = (recordMetres: number | null, settings: Settings): BellMark =>
  recordMetres !== null && recordMetres > 0
    ? { kind: "record", metres: recordMetres }
    : { kind: "goal", metres: referenceMetres(settings) };

/** The bell rings once the ride goes past its mark. */
export const ringsBell = (metres: number, mark: BellMark): boolean => metres > mark.metres;

/** Past this position the end of the track starts moving away… */
export const STRETCH_FROM = 0.85;
/** …until the bike is back to this position. */
export const STRETCH_TO = 0.6;
/** Time constant of the stretch: the end recedes smoothly, not at once. */
export const STRETCH_TIME_SEC = 0.4;

export interface Track {
  /** Metres at the right end of the track. */
  target: number;
  /** Where `target` is heading while the track stretches. */
  heading: number;
}

export function startTrack(mark: BellMark, settings: Settings): Track {
  // The bell sits a bit before the end when it is the harder mark.
  const target = Math.max(referenceMetres(settings), mark.metres * 1.05, MIN_TARGET);
  return { target, heading: target };
}

export function stepTrack(track: Track, metres: number, dtSec: number): Track {
  let { target, heading } = track;
  // While stretching, the heading keeps up with a fast bike instead of letting
  // it catch up with the end of the track.
  if (heading > target || metres > target * STRETCH_FROM) {
    heading = Math.max(heading, metres / STRETCH_TO);
  }
  target = heading - (heading - target) * Math.exp(-Math.max(0, dtSec) / STRETCH_TIME_SEC);
  if (heading - target < 0.5) target = heading;
  return { target, heading };
}

/** Position on the track, from 0 (start) to 1 (right end). */
export const trackPosition = (metres: number, target: number): number =>
  Math.min(1, Math.max(0, metres / target));

// --- finale ------------------------------------------------------------------
// An option: in the last seconds the pole bearer holding the track reacts. A
// rider ahead of the bell's pace gets a steeper road; one behind, a gentler
// one, by the same few percent: on own slopes, flattening the road would only
// help those who have a slope (the stronger), not those already on the flat.

/** The finale starts this many seconds before the end, with the ticking. */
export const FINALE_SEC = 5;
/** Extra grade (%) for a rider ahead of the bell. */
export const FINALE_LIFT = 3;

/** "lift": the pole bearer lifts the track higher; "flee": he runs away, it falls. */
export type FinaleMove = "lift" | "flee";

/** Decided once, as the finale starts: ahead of the bell's pace or not. */
export const finaleFor = (
  metres: number,
  mark: BellMark,
  elapsedSec: number,
  durationSec: number,
): FinaleMove => (metres >= (mark.metres * elapsedSec) / durationSec ? "lift" : "flee");

export const finaleGrade = (gradePct: number, move: FinaleMove): number =>
  move === "lift" ? gradePct + FINALE_LIFT : gradePct - FINALE_LIFT;
