import type { TFunction } from "i18next";
import type { PlayerActivity } from "./playerLink";

/** How the player's game reads on the page and on Strava. */
export function activityText(activity: PlayerActivity, t: TFunction, url: string) {
  const rank = t("strava.rank", { count: activity.rank, ordinal: true });
  return {
    summary: t("strava.summary", { rank, players: activity.players, total: activity.total }),
    name: t("strava.activityName"),
    description: t("strava.activityDescription", {
      rank,
      players: activity.players,
      total: activity.total,
      count: activity.rides.length,
      url,
    }),
  };
}
