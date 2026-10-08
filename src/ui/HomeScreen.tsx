import { type SubmitEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { type Livery, liveryOf } from "../core/livery";
import {
  canStart,
  MAX_NAME_LENGTH,
  MIN_PLAYERS,
  normalizeName,
  type Player,
  validateName,
} from "../core/players";
import { SLOPE_PERCENT, type Settings } from "../core/settings";
import { AUTHOR, RELEASE_URL, REPOSITORY_URL, VERSION } from "./credits";
import { cx } from "./cx";
import { Cyclist } from "./cyclist/Cyclist";
import { advanceCrank, GEAR_RATIO } from "./cyclist/geometry";
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

/** How the riders pedal while the screen waits: each at their own pace. */
const PACE = {
  /** Cadence (rpm) of a pedaling spell, drawn at random… */
  cadence: [40, 70],
  /** …a little brisker for the first to ride, who is getting ready. */
  eagerCadence: [60, 85],
  /** Length of a pedaling spell, then of a pause (s). */
  spell: [2.5, 7],
  pause: [1, 3.5],
  eagerPause: [0.6, 1.5],
  /** How quickly the legs reach a new cadence (s). */
  ramp: 0.6,
  /** How long the wheels keep rolling once the legs stop (s). */
  coast: 3,
} as const;

const between = ([low, high]: readonly [number, number]) => low + Math.random() * (high - low);

/** Where the cranks of a rider who waits stand: each one a little differently. */
const restingCrank = (index: number) => 0.7 + index * 2.1;

/**
 * A rider waiting their turn: spells of pedaling at a pace of their own, with
 * pauses where the legs stop and the wheels roll on and slow down. Still if
 * the device asks for less motion.
 */
function useIdlePedaling(index: number, eager: boolean) {
  const [motion, setMotion] = useState(() => ({
    crankAngle: restingCrank(index),
    wheelAngle: restingCrank(index) * GEAR_RATIO,
    rolling: false,
  }));
  useEffect(() => {
    const still =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) return;
    let pedaling = false;
    // Not all at once: each starts after a pause of their own.
    let phaseLeft = eager ? 0 : between([0, 2.5]);
    let target = 0;
    let cadence = 0;
    let wheelRate = 0;
    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      phaseLeft -= dt;
      if (phaseLeft <= 0) {
        pedaling = !pedaling;
        target = pedaling ? between(eager ? PACE.eagerCadence : PACE.cadence) : 0;
        phaseLeft = between(pedaling ? PACE.spell : eager ? PACE.eagerPause : PACE.pause);
      }
      cadence += (target - cadence) * Math.min(1, dt / PACE.ramp);
      // Driven by the legs, or rolling on and slowing down.
      const driven = (cadence / 60) * 2 * Math.PI * GEAR_RATIO;
      wheelRate = Math.max(driven, wheelRate * Math.exp(-dt / PACE.coast));
      setMotion((m) => ({
        crankAngle: advanceCrank(m.crankAngle, cadence, dt),
        wheelAngle: (m.wheelAngle + wheelRate * dt) % (2 * Math.PI),
        rolling: cadence > 20,
      }));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [eager]);
  return motion;
}

/** A player's cyclist, in their colours, pedaling now and then while the screen waits. */
function RiderDrawing({ livery, eager, index }: { livery: Livery; eager: boolean; index: number }) {
  const { crankAngle, wheelAngle, rolling } = useIdlePedaling(index, eager);
  return (
    <Cyclist crankAngle={crankAngle} wheelAngle={wheelAngle} moving={rolling} livery={livery} />
  );
}

interface Props {
  roster: readonly Player[];
  settings: Settings;
  sensor: BikeCardSensor;
  bluetoothSupported: boolean;
  /** Whether the connected bike measures power, as far as can be told. */
  measuresPower?: boolean;
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
  measuresPower = true,
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
    settings.slope === "own"
      ? t("settings.slope.own")
      : t("settings.slope.short", { percent: SLOPE_PERCENT[settings.slope] }),
    ...(settings.finale === "on" ? [t("settings.finale.short")] : []),
  ].join(" · ");
  const noPower = settings.metric === "distance" && !measuresPower;

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
        {/* Each player on their own sheet, with their bike; empty sheets until there are enough. */}
        <ul className={styles.roster}>
          {roster.map((player, index) => (
            <li key={player.id} className={cx(styles.rider, player === firstUp && styles.next)}>
              <span className={styles.riderDrawing} aria-hidden="true">
                <RiderDrawing livery={liveryOf(player)} eager={player === firstUp} index={index} />
              </span>
              <span className={styles.riderName}>{player.name}</span>
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
          {Array.from({ length: Math.max(0, MIN_PLAYERS - roster.length) }, (_, i) => (
            <li key={`empty-${String(i)}`} className={styles.emptySeat} aria-hidden="true">
              <span className={styles.riderDrawing}>
                <Cyclist crankAngle={restingCrank(roster.length + i)} />
              </span>
              <span className={styles.riderName} />
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
        {noPower && <p className={styles.help}>{t("home.noPower")}</p>}

        <p className={styles.credits}>
          <span>{t("home.madeBy", { author: AUTHOR })}</span>
          <span>
            <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
              {t("home.source")}
            </a>
          </span>
          <span>
            {/* A new tab: leaving this page would drop the Bluetooth connection. */}
            <a href={feedbackUrl} target="_blank" rel="noopener">
              {t("home.feedback")}
            </a>
          </span>
          <a
            href={RELEASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.version}
            aria-label={t("home.version", { version: VERSION })}
          >
            {`v${VERSION}`}
          </a>
        </p>
      </section>
    </div>
  );
}
