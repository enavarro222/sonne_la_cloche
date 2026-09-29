import type { TFunction } from "i18next";
import { type Game, highlights, standings } from "../../core/game";

export interface ShareContent {
  title: string;
  winner: string;
  ranking: { rank: number; name: string; total: number }[];
  awards: { label: string; value: string }[];
  date: string;
  url: string;
  /** Plain-text version, for messages and as the share caption. */
  text: string;
}

/** What the end-of-game share says, as text and for the image. */
export function shareContent(
  game: Game,
  t: TFunction,
  locale: string,
  url: string,
  now: Date = new Date(),
): ShareContent {
  const ranking = standings(game).map((s) => ({
    rank: s.rank,
    name: s.player.name,
    total: s.total,
  }));
  const winners = ranking.filter((r) => r.rank === 1).map((r) => r.name);
  const winner = t("result.winner", {
    count: winners.length,
    names: new Intl.ListFormat(locale).format(winners),
  });

  const { bestRide, fastest, strongest } = highlights(game);
  const awards = [
    { label: t("result.awards.bestRide"), feat: bestRide, unit: t("result.points") },
    { label: t("result.awards.fastest"), feat: fastest, unit: t("ride.cadenceUnit") },
    { label: t("result.awards.strongest"), feat: strongest, unit: t("ride.powerUnit") },
  ].flatMap(({ label, feat, unit }) =>
    feat
      ? [
          {
            label,
            value: t("result.awards.value", {
              name: feat.player.name,
              value: Math.round(feat.value),
              unit,
            }),
          },
        ]
      : [],
  );

  const date = t("share.playedOn", {
    date: new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(now),
  });
  const title = t("app.title");
  const text = [
    `🔔 ${winner}`,
    ...ranking.map((r) => `${r.rank}. ${r.name} (${r.total})`),
    "",
    `${title} ${url}`,
  ].join("\n");

  return { title, winner, ranking, awards, date, url, text };
}
