import { type Game, standings, summarize } from "../core/game";
import type { Locale } from "../i18n/locales";
import type { PlayerActivity } from "./playerLink";

/**
 * Each player's game, in playing order, ready to be sent to their phone.
 * `strava`: whether the phone may offer it (a demo game would be a fake ride).
 */
export function playerActivities(game: Game, locale: Locale, strava: boolean): PlayerActivity[] {
  const table = standings(game);
  const summary = summarize(game);
  return game.players.map((player) => {
    const standing = table.find((s) => s.player.id === player.id);
    return {
      locale,
      name: player.name,
      rank: standing?.rank ?? game.players.length,
      players: game.players.length,
      total: standing?.total ?? 0,
      rides: game.rides
        .filter((r) => r.playerId === player.id)
        .sort((a, b) => a.round - b.round)
        .map((r) => ({
          startedAt: Date.parse(r.trace.startedAt),
          points: r.points,
          samples: r.trace.samples,
        })),
      summary,
      strava,
    };
  });
}
