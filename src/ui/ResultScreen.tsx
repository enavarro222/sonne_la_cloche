import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  currentPlayer,
  type Feat,
  type Game,
  highlights,
  isGameOver,
  lastRide,
  standings,
  upNext,
} from "../core/game";
import type { RideStats } from "../core/ride";
import { ConfirmDialog } from "./ConfirmDialog";
import { StravaDialog } from "./StravaDialog";
import { cx } from "./cx";
import { FixedDigits } from "./FixedDigits";
import { renderResultCard } from "./share/resultCard";
import { shareContent } from "./share/shareContent";
import { shareResults } from "./share/shareResults";
import styles from "./ResultScreen.module.css";

/** Average and peak of the ride; hidden when the sensor does not measure it. */
function RideDetails({ stats }: { stats: RideStats }) {
  const { t } = useTranslation();
  const tiles = [
    { avg: stats.avgCadence, max: stats.maxCadence, unit: t("ride.cadenceUnit") },
    { avg: stats.avgPower, max: stats.maxPower, unit: t("ride.powerUnit") },
  ].filter((tile) => tile.max > 0);
  if (tiles.length === 0) return null;
  return (
    <ul className={styles.details}>
      {tiles.map((tile) => (
        <li key={tile.unit}>
          <span className={styles.detailValue}>
            <FixedDigits>{Math.round(tile.avg)}</FixedDigits> <small>{tile.unit}</small>
          </span>
          <span className={styles.detailLabel}>
            {t("result.average", { peak: Math.round(tile.max) })}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Awards({ game }: { game: Game }) {
  const { t } = useTranslation();
  const { bestRide, fastest, strongest } = highlights(game);
  const awards: { label: string; feat: Feat | null; unit: string }[] = [
    { label: t("result.awards.bestRide"), feat: bestRide, unit: t("result.points") },
    { label: t("result.awards.fastest"), feat: fastest, unit: t("ride.cadenceUnit") },
    { label: t("result.awards.strongest"), feat: strongest, unit: t("ride.powerUnit") },
  ];
  return (
    <dl className={styles.awards}>
      {awards.map(
        ({ label, feat, unit }) =>
          feat && (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                {t("result.awards.value", {
                  name: feat.player.name,
                  value: Math.round(feat.value),
                  unit,
                })}
              </dd>
            </div>
          ),
      )}
    </dl>
  );
}

interface Props {
  game: Game;
  /** False while the bike is lost: riding now would score zero. */
  bikeReady: boolean;
  onNext: () => void;
  onRetry: () => void;
  onPlayAgain: () => void;
  onHome: () => void;
}

export function ResultScreen({ game, bikeReady, onNext, onRetry, onPlayAgain, onHome }: Props) {
  const { t, i18n } = useTranslation();
  const player = currentPlayer(game);
  const ride = lastRide(game);
  const ranking = standings(game);
  const next = upNext(game);
  const over = isGameOver(game);
  const winners = ranking.filter((s) => s.rank === 1).map((s) => s.player.name);
  const [confirmingQuit, setConfirmingQuit] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [stravaOpen, setStravaOpen] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);

  const share = async () => {
    setSharing(true);
    setShareNote(null);
    const content = shareContent(game, t, i18n.language, location.origin + location.pathname);
    const outcome = await shareResults(content, await renderResultCard(content));
    if (outcome === "downloaded") setShareNote(t("share.fallback"));
    if (outcome === "failed") setShareNote(t("share.failed"));
    setSharing(false);
  };

  return (
    <div className={styles.result}>
      <section className={styles.main}>
        <p className={styles.title}>
          {ride?.personalBest ? t("result.personalBest", { name: player.name }) : player.name}
        </p>
        <p className={styles.score}>
          <span data-testid="result-points">
            <FixedDigits>{ride?.points ?? 0}</FixedDigits>
          </span>
          <span className={styles.unit}>{t("result.points")}</span>
        </p>

        {!over && ride && <RideDetails stats={ride.stats} />}

        {over ? (
          <div className={styles.announce}>
            <p className={styles.winner}>
              {t("result.winner", {
                count: winners.length,
                names: new Intl.ListFormat(i18n.language).format(winners),
              })}
            </p>
            <p>{t("result.gameOver")}</p>
            <Awards game={game} />
          </div>
        ) : (
          next && (
            <p className={styles.announce}>
              <span className={styles.next}>{t("result.upNext", { name: next.player.name })}</span>
              {t("ride.round", { round: next.round, rounds: game.settings.rounds })}
            </p>
          )
        )}

        {shareNote && (
          <p className={styles.shareNote} role="status">
            {shareNote}
          </p>
        )}
        {!bikeReady && (
          <p className={styles.warning} role="alert">
            {t("result.bikeLost")}
          </p>
        )}
        <div className={styles.actions}>
          {over ? (
            <>
              <button type="button" className="primary" onClick={onPlayAgain} disabled={!bikeReady}>
                {t("result.playAgain")}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => void share()}
                disabled={sharing}
              >
                {t("share.button")}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setStravaOpen(true);
                }}
              >
                {t("result.strava.button")}
              </button>
            </>
          ) : (
            <button
              type="button"
              className={cx("primary", styles.nextButton)}
              onClick={onNext}
              disabled={!bikeReady}
              aria-label={next ? t("result.upNext", { name: next.player.name }) : undefined}
            >
              {t("result.next")}
              {next && <span className={styles.nextName}>{next.player.name}</span>}
            </button>
          )}
          <button type="button" className="secondary" onClick={onRetry} disabled={!bikeReady}>
            {t("result.retry")}
          </button>
          <button
            type="button"
            className="secondary"
            // Once the game is over there is nothing left to lose.
            onClick={
              over
                ? onHome
                : () => {
                    setConfirmingQuit(true);
                  }
            }
          >
            {t("result.home")}
          </button>
        </div>
      </section>

      <section className={styles.rankingBox} aria-labelledby="ranking-title">
        <h2 id="ranking-title">{t("result.ranking")}</h2>
        <div className={styles.tableScroll}>
          <table className={styles.ranking}>
            <thead>
              <tr>
                <th scope="col">
                  <span className="visually-hidden">{t("result.rank")}</span>
                </th>
                <th scope="col">
                  <span className="visually-hidden">{t("result.player")}</span>
                </th>
                {Array.from({ length: game.settings.rounds }, (_, i) => (
                  <th
                    key={i}
                    scope="col"
                    className={cx(styles.roundCol, i + 1 === game.round && styles.nowCol)}
                  >
                    <abbr title={t("result.roundLong", { round: i + 1 })}>
                      {t("result.roundShort", { round: i + 1 })}
                    </abbr>
                  </th>
                ))}
                <th scope="col" className={styles.totalCol}>
                  {t("result.total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((s) => (
                <tr
                  key={s.player.id}
                  className={cx(s.player.id === player.id && styles.me)}
                  aria-current={s.player.id === player.id ? "true" : undefined}
                >
                  <td className={styles.rank}>{s.rank}</td>
                  <th scope="row" className={styles.name}>
                    {s.player.name}
                  </th>
                  {s.rounds.map((points, i) => (
                    <td
                      key={i}
                      className={cx(styles.roundCol, i + 1 === game.round && styles.nowCol)}
                    >
                      {points ?? "–"}
                    </td>
                  ))}
                  <td className={styles.totalCol}>{s.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {stravaOpen && (
        <StravaDialog
          game={game}
          onClose={() => {
            setStravaOpen(false);
          }}
        />
      )}
      {confirmingQuit && (
        <ConfirmDialog
          title={t("result.quit.title")}
          message={t("result.quit.message")}
          confirmLabel={t("result.quit.confirm")}
          cancelLabel={t("result.quit.cancel")}
          onConfirm={onHome}
          onCancel={() => {
            setConfirmingQuit(false);
          }}
        />
      )}
    </div>
  );
}
