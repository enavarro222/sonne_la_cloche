import { useTranslation } from "react-i18next";
import { currentPlayer, type Game, isGameOver, lastRide, standings, upNext } from "../core/game";
import { cx } from "./cx";
import styles from "./ResultScreen.module.css";

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

  return (
    <div className={styles.result}>
      <section className={styles.main}>
        <p className={styles.title}>
          {ride?.personalBest ? t("result.personalBest", { name: player.name }) : player.name}
        </p>
        <p className={styles.score}>
          <span data-testid="result-points">{ride?.points ?? 0}</span>
          <span className={styles.unit}>{t("result.points")}</span>
        </p>

        {over ? (
          <div className={styles.announce}>
            <p className={styles.winner}>
              {t("result.winner", {
                count: winners.length,
                names: new Intl.ListFormat(i18n.language).format(winners),
              })}
            </p>
            <p>{t("result.gameOver")}</p>
          </div>
        ) : (
          next && (
            <p className={styles.announce}>
              <span className={styles.next}>{t("result.upNext", { name: next.player.name })}</span>
              {t("ride.round", { round: next.round, rounds: game.settings.rounds })}
            </p>
          )
        )}

        {!bikeReady && (
          <p className={styles.warning} role="alert">
            {t("result.bikeLost")}
          </p>
        )}
        <div className={styles.actions}>
          {over ? (
            <button type="button" className="primary" onClick={onPlayAgain} disabled={!bikeReady}>
              {t("result.playAgain")}
            </button>
          ) : (
            <button type="button" className="primary" onClick={onNext} disabled={!bikeReady}>
              {t("result.next")}
            </button>
          )}
          <button type="button" className="secondary" onClick={onRetry} disabled={!bikeReady}>
            {t("result.retry")}
          </button>
          <button type="button" className="secondary" onClick={onHome}>
            {t("result.home")}
          </button>
        </div>
      </section>

      <section className={styles.rankingBox} aria-labelledby="ranking-title">
        <h2 id="ranking-title">{t("result.ranking")}</h2>
        <ol className={styles.ranking}>
          {ranking.map((s) => (
            <li
              key={s.player.id}
              className={cx(s.player.id === player.id && styles.me)}
              aria-current={s.player.id === player.id ? "true" : undefined}
            >
              <span className={styles.rank}>{s.rank}</span>
              <span className={styles.name}>{s.player.name}</span>
              <span className={styles.total}>{s.total}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
