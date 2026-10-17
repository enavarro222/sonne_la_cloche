// Scoring by distance: measured power drives a virtual bike, and the score is
// the metres it covers. On a common slope everyone rides the same road. On
// "own" slopes, round 1 measures everyone on the flat; from round 2 each
// player's slope, steeper for the stronger, makes their power hold the same
// speed as the weakest's. See docs/handicap.md.

import { currentPlayer, type Game } from "./game";
import { SLOPE_PERCENT } from "./settings";

/** The virtual rider and bike: the same for every player, not their real weight. */
export const MASS_KG = 80;
const GRAVITY = 9.81;
export const ROLLING_RESISTANCE = 0.004;
/** ½·ρ·CdA of an adult on a road bike, in kg/m. */
export const AIR_DRAG = 0.5 * 1.225 * 0.32;

/** The road a trainer simulates: this model, so the legs feel what the game counts. */
export const TRAINER_ROAD = { rolling: ROLLING_RESISTANCE, airDrag: AIR_DRAG } as const;

/** Round 1 starts at the speed this power holds on the common slope. */
export const CALIBRATION_POWER = 100;
/** A player's handicap never goes above this, on top of the common slope. */
export const MAX_EXTRA_GRADE = 12;
/** A reference below this (nobody pedaled) would make the common speed meaningless. */
export const MIN_REFERENCE_POWER = 20;
/** Mid-ride, beating one's reference by this much raises it… */
export const RAISE_RATIO = 1.1;
/** …once the ride has lasted this long, so a burst at the start does not count. */
export const RAISE_AFTER_SEC = 10;

const angleOf = (gradePct: number) => Math.atan(gradePct / 100);

/** Gravity, rolling and air drag against the bike, in newtons. */
function resistance(speed: number, gradePct: number): number {
  const angle = angleOf(gradePct);
  return (
    MASS_KG * GRAVITY * (Math.sin(angle) + ROLLING_RESISTANCE * Math.cos(angle)) +
    AIR_DRAG * speed * speed
  );
}

/** Speed (m/s) after `dtSec` pedaling `power` watts on `gradePct`. */
export function stepSpeed(speed: number, power: number, gradePct: number, dtSec: number): number {
  // Below 1 m/s the force is capped, as on a real bike starting off.
  const drive = power / Math.max(speed, 1);
  return Math.max(0, speed + ((drive - resistance(speed, gradePct)) / MASS_KG) * dtSec);
}

/** The speed (m/s) `power` watts hold on `gradePct`. */
export function steadySpeed(power: number, gradePct: number): number {
  let lo = 0;
  let hi = 30;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (resistance(mid, gradePct) * mid < power) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** The grade (%) on which `power` watts hold `speed` m/s. */
export function gradeFor(power: number, speed: number): number {
  // sin θ + Crr·cos θ = a, solved for θ.
  const a = (power / speed - AIR_DRAG * speed * speed) / (MASS_KG * GRAVITY);
  const norm = Math.hypot(1, ROLLING_RESISTANCE);
  const angle = Math.asin(Math.min(1, Math.max(-1, a / norm))) - Math.atan(ROLLING_RESISTANCE);
  return Math.tan(angle) * 100;
}

/** What one ride is run on. */
export interface Course {
  /** The common slope, from the settings. */
  baseGradePct: number;
  /** The slope this player rides: the common one plus their handicap. */
  gradePct: number;
  /** Virtual speed at "Go", m/s: a flying start. */
  startSpeed: number;
  /** The power that holds `startSpeed` on this slope; null without a handicap. */
  targetPower: number | null;
  /** Round 1 of own slopes: it measures everyone's level. */
  measuring: boolean;
}

/**
 * Each player's reference power: their best average over the rides of this
 * game before `beforeRound` (all of them by default). It only goes up, so
 * riding easy in round 1 does not pay for long.
 */
export function referencePowers(game: Game, beforeRound = Infinity): Map<string, number> {
  const refs = new Map<string, number>();
  for (const ride of game.rides) {
    if (ride.round >= beforeRound) continue;
    refs.set(ride.playerId, Math.max(refs.get(ride.playerId) ?? 0, ride.stats.avgPower));
  }
  return refs;
}

/** The same road for everyone: on a common slope, or while measuring. */
function commonCourse(baseGradePct: number, measuring: boolean): Course {
  return {
    baseGradePct,
    gradePct: baseGradePct,
    startSpeed: steadySpeed(CALIBRATION_POWER, baseGradePct),
    targetPower: null,
    measuring,
  };
}

/** A handicapped course: `power` holds the common speed on the returned slope. */
function handicapCourse(baseGradePct: number, commonSpeed: number, power: number): Course {
  const grade = gradeFor(power, commonSpeed);
  return {
    baseGradePct,
    gradePct: Math.min(baseGradePct + MAX_EXTRA_GRADE, Math.max(baseGradePct, grade)),
    startSpeed: commonSpeed,
    targetPower: power,
    measuring: false,
  };
}

/** The course of whoever rides now. */
export const courseFor = (game: Game): Course => courseOf(game, currentPlayer(game).id, game.round);

/** A player's course in a round, from the rides so far (e.g. for whoever rides next). */
export function courseOf(game: Game, playerId: string, round: number): Course {
  const base = SLOPE_PERCENT[game.settings.slope];
  if (game.settings.slope !== "own") return commonCourse(base, false);
  // The levels as the round started: whoever rides first, and a ride being
  // retried, change nothing for the others in the same round.
  const refs = referencePowers(game, round);
  const own = refs.get(playerId);
  // Round 1, or a player without a ride yet: measuring.
  if (round === 1 || own === undefined) return commonCourse(base, true);
  const weakest = Math.max(MIN_REFERENCE_POWER, Math.min(...refs.values()));
  return handicapCourse(base, steadySpeed(weakest, base), Math.max(MIN_REFERENCE_POWER, own));
}

/**
 * Mid-ride: a player well above their reference gets a steeper slope right
 * away, from their average so far. Never lowers it: fatigue is not rewarded.
 */
export function raiseCourse(course: Course, averagePower: number, elapsedSec: number): Course {
  const target = course.targetPower;
  if (target === null || elapsedSec < RAISE_AFTER_SEC) return course;
  if (averagePower <= target * RAISE_RATIO) return course;
  return handicapCourse(course.baseGradePct, course.startSpeed, averagePower);
}
