// Which course each player rides in a game. On a common slope everyone rides
// the same road. On "own" slopes, round 1 measures everyone on the flat; from
// round 2 each player's slope, steeper for the stronger, makes their power
// hold the same speed as the weakest's. The physics is in handicap.ts.

import { currentPlayer, type Game } from "./game";
import { commonCourse, type Course, handicapCourse, steadySpeed } from "./handicap";
import { SLOPE_PERCENT } from "./settings";

/** A reference below this (nobody pedaled) would make the common speed meaningless. */
export const MIN_REFERENCE_POWER = 20;

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
