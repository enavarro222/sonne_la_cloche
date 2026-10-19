import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Player } from "../core/players";
import { elisionContext } from "../i18n/elision";
import { ConfirmDialog } from "./ConfirmDialog";
import { type Remote, RemoteRow } from "./RemoteRow";
import styles from "./ReadyScreen.module.css";

interface Props {
  player: Player;
  round: number;
  rounds: number;
  /** False while the bike is lost: riding now would score zero. */
  bikeReady: boolean;
  /** With virtual gears: the Zwift remotes, to connect one forgotten. */
  remote?: Remote;
  onStart: () => void;
  onOpenSettings: () => void;
  onHome: () => void;
}

/** After a cancelled ride: nothing recorded, the same rider goes again when ready. */
export function ReadyScreen({
  player,
  round,
  rounds,
  bikeReady,
  remote,
  onStart,
  onOpenSettings,
  onHome,
}: Props) {
  const { t } = useTranslation();
  const [confirmingQuit, setConfirmingQuit] = useState(false);
  return (
    <section className={styles.ready} aria-labelledby="ready-title">
      <h1 id="ready-title" className={styles.who}>
        {t("ride.turn", { name: player.name, context: elisionContext(player.name) })}
        <span className={styles.round}>{t("ride.round", { round, rounds })}</span>
      </h1>
      <p className={styles.note}>{t("ready.note")}</p>
      {!bikeReady && (
        <p className={styles.note} role="status">
          {t("result.bikeLost")}
        </p>
      )}
      <button type="button" className="primary" onClick={onStart} disabled={!bikeReady}>
        {t("home.start")}
      </button>
      {remote && (
        <div className={styles.remote}>
          <RemoteRow remote={remote} />
        </div>
      )}
      <div className={styles.actions}>
        <button type="button" className="secondary" onClick={onOpenSettings}>
          {t("home.settings")}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setConfirmingQuit(true);
          }}
        >
          {t("result.home")}
        </button>
      </div>
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
    </section>
  );
}
