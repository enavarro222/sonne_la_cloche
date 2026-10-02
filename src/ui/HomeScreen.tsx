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
import { AUTHOR, REPOSITORY_URL } from "./credits";
import { cx } from "./cx";
import styles from "./HomeScreen.module.css";
import type { SensorState } from "./useSensor";

type BikeCardSensor = Pick<
  SensorState,
  "connection" | "connecting" | "error" | "ready" | "connect" | "reconnect" | "startDemo"
>;

/** The bike block always says which state we are in, and offers the way out of it. */
function BikeCard({
  sensor,
  bluetoothSupported,
}: {
  sensor: BikeCardSensor;
  bluetoothSupported: boolean;
}) {
  const { t } = useTranslation();
  const { connection } = sensor;

  const connectButton = (primary: boolean) => (
    <button
      type="button"
      className={primary ? "primary" : "secondary"}
      onClick={() => void sensor.connect()}
      disabled={!bluetoothSupported || sensor.connecting}
    >
      {connection.kind === "bluetooth" ? t("home.bike.change") : t("home.bike.connect")}
    </button>
  );

  let state: { text: string; ok: boolean } | null = null;
  let actions;
  switch (connection.kind) {
    case "none":
      actions = (
        <>
          {connectButton(true)}
          <button type="button" className="secondary" onClick={sensor.startDemo}>
            {t("home.bike.demo")}
          </button>
        </>
      );
      break;
    case "demo":
      state = { text: t("home.bike.demoOn"), ok: true };
      // Connecting the bike is the only way out of demo mode worth offering.
      actions = connectButton(false);
      break;
    case "bluetooth":
      if (connection.lost) {
        state = { text: t("status.lost"), ok: false };
        actions = (
          <>
            <button
              type="button"
              className="primary"
              onClick={() => void sensor.reconnect()}
              disabled={sensor.connecting}
            >
              {t("status.reconnect")}
            </button>
            {connectButton(false)}
          </>
        );
      } else {
        const connected = {
          name: connection.deviceName || t("status.unnamed"),
          protocol: connection.protocol,
        };
        state = {
          text: connection.controllable
            ? t("home.bike.connectedControlled", connected)
            : t("home.bike.connected", connected),
          ok: true,
        };
        actions = connectButton(false);
      }
      break;
  }

  return (
    <div className={styles.bike}>
      <h2>{t("home.bike.title")}</h2>
      {state && (
        <p className={cx(styles.state, state.ok ? styles.stateOk : styles.stateKo)} role="status">
          {state.text}
        </p>
      )}
      <div className={styles.row}>{actions}</div>
      {sensor.error && (
        <p className={styles.error} role="alert">
          {t(`home.errors.${sensor.error.code}`, { message: sensor.error.message })}
        </p>
      )}
      {!bluetoothSupported ? (
        <p className={styles.help}>{t("home.bike.unsupported")}</p>
      ) : (
        connection.kind === "none" && <p className={styles.help}>{t("home.bike.help")}</p>
      )}
    </div>
  );
}

interface Props {
  roster: readonly Player[];
  settings: Settings;
  sensor: BikeCardSensor;
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
  const { t, i18n } = useTranslation();
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
  // The game always opens with the first player of the roster.
  const firstUp = enoughPlayers ? roster[0] : undefined;
  const hint = !enoughPlayers ? t("home.needPlayers") : !sensor.ready ? t("home.needBike") : null;
  const bike =
    sensor.connection.kind === "bluetooth" ? sensor.connection.protocol : sensor.connection.kind;
  const trainer = sensor.connection.kind === "bluetooth" ? sensor.connection.deviceName : "";
  const feedbackUrl = `/feedback/?${new URLSearchParams({ lang: i18n.language, bike, trainer }).toString()}`;
  const settingsSummary = [
    t(`settings.metric.${settings.metric}`),
    t("settings.duration.value", { count: settings.durationSec }),
    t("settings.rounds.value", { count: settings.rounds }),
    t(`settings.resistance.short.${settings.resistance}`),
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
        <BikeCard sensor={sensor} bluetoothSupported={bluetoothSupported} />

        <div className={styles.start}>
          <button
            type="button"
            className={cx("primary", styles.startButton)}
            onClick={onStart}
            disabled={hint !== null}
            aria-describedby={hint ? "start-hint" : undefined}
            aria-label={firstUp ? t("home.firstUp", { name: firstUp.name }) : undefined}
          >
            {t("home.start")}
            {firstUp && <span className={styles.firstUp}>{firstUp.name}</span>}
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

        <p className={styles.credits}>
          <span>{t("home.madeBy", { author: AUTHOR })}</span>
          <span>
            <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
              {t("home.source")}
            </a>
          </span>
          {/* A new tab: leaving this page would drop the Bluetooth connection. */}
          <a href={feedbackUrl} target="_blank" rel="noopener">
            {t("home.feedback")}
          </a>
        </p>
      </section>
    </div>
  );
}
