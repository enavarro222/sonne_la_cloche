import { type SubmitEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  canStart,
  MAX_NAME_LENGTH,
  normalizeName,
  type Player,
  validateName,
} from "../core/players";
import type { Settings } from "../core/settings";
import styles from "./HomeScreen.module.css";
import type { SensorState } from "./useSensor";

interface Props {
  roster: readonly Player[];
  settings: Settings;
  sensor: Pick<
    SensorState,
    "connection" | "connecting" | "error" | "ready" | "connect" | "startDemo"
  >;
  bluetoothSupported: boolean;
  onAddPlayer: (name: string) => void;
  onRemovePlayer: (id: string) => void;
  onStart: () => void;
  onOpenSettings: () => void;
}

export function HomeScreen({
  roster,
  settings,
  sensor,
  bluetoothSupported,
  onAddPlayer,
  onRemovePlayer,
  onStart,
  onOpenSettings,
}: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [duplicate, setDuplicate] = useState<string | null>(null);

  const addPlayer = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = normalizeName(name);
    const error = validateName(clean, roster);
    if (error === "duplicate") setDuplicate(clean);
    if (error !== null) return;
    onAddPlayer(clean);
    setName("");
  };

  const enoughPlayers = canStart(roster);
  const hint = !enoughPlayers ? t("home.needPlayers") : !sensor.ready ? t("home.needBike") : null;
  const settingsSummary = [
    t(`settings.metric.${settings.metric}`),
    t("settings.duration.value", { count: settings.durationSec }),
    t("settings.rounds.value", { count: settings.rounds }),
  ].join(" · ");

  return (
    <div className={styles.home}>
      <section className={styles.players} aria-labelledby="players-title">
        <h1 className={styles.tagline}>{t("home.tagline")}</h1>
        <h2 id="players-title">{t("home.players.title")}</h2>
        <form className={styles.addForm} onSubmit={addPlayer}>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDuplicate(null);
            }}
            placeholder={t("home.players.placeholder")}
            aria-label={t("home.players.placeholder")}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="off"
            enterKeyHint="done"
          />
          <button type="submit" className="secondary">
            {t("home.players.add")}
          </button>
        </form>
        {duplicate !== null && (
          <p className={styles.error} role="alert">
            {t("home.players.duplicate", { name: duplicate })}
          </p>
        )}
        <ul className={styles.roster}>
          {roster.map((player) => (
            <li key={player.id}>
              {player.name}
              <button
                type="button"
                onClick={() => {
                  onRemovePlayer(player.id);
                }}
                aria-label={t("home.players.remove", { name: player.name })}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.side}>
        <div className={styles.bike}>
          <h2>{t("home.bike.title")}</h2>
          <div className={styles.row}>
            <button
              type="button"
              className={sensor.ready ? "secondary" : "primary"}
              onClick={() => void sensor.connect()}
              disabled={!bluetoothSupported || sensor.connecting}
            >
              {t("home.bike.connect")}
            </button>
            <button type="button" className="secondary" onClick={sensor.startDemo}>
              {t("home.bike.demo")}
            </button>
          </div>
          {sensor.error && (
            <p className={styles.error} role="alert">
              {t(`home.errors.${sensor.error.code}`, { message: sensor.error.message })}
            </p>
          )}
          <p className={styles.help}>
            {bluetoothSupported ? t("home.bike.help") : t("home.bike.unsupported")}
          </p>
        </div>

        <div className={styles.start}>
          <button
            type="button"
            className="primary"
            onClick={onStart}
            disabled={hint !== null}
            aria-describedby={hint ? "start-hint" : undefined}
          >
            {t("home.start")}
          </button>
          {hint && (
            <p id="start-hint" className={styles.help}>
              {hint}
            </p>
          )}
        </div>

        <button type="button" className={styles.settings} onClick={onOpenSettings}>
          <span aria-hidden="true">⚙</span>
          <span className="visually-hidden">{t("home.settings")}</span>
          <span>{settingsSummary}</span>
        </button>
      </section>
    </div>
  );
}
