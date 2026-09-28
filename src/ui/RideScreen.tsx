import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Player } from "../core/players";
import {
  bellMark,
  isRideOver,
  remainingSec,
  type RideProgress,
  type RideStats,
  rideStats,
  ringsBell,
  startRide,
  startTrack,
  stepRide,
  stepTrack,
  type Track,
  trackPosition,
} from "../core/ride";
import type { Settings } from "../core/settings";
import { elisionContext } from "../i18n/elision";
import { DemoSensor } from "../sensors/demo/demoSensor";
import { type Sensor, type SensorReading, ZERO_READING } from "../sensors/types";
import { cx } from "./cx";
import { FixedDigits } from "./FixedDigits";
import styles from "./RideScreen.module.css";
import { sounds } from "./sound";
import { useLatest } from "./useLatest";

export const COUNTDOWN_STEP_MS = 800;
export const GO_DISPLAY_MS = 450;
const TICK_FROM_SEC = 5;

interface Props {
  player: Player;
  round: number;
  settings: Settings;
  record: { player: Player; points: number } | null;
  sensor: Sensor;
  onFinish: (points: number, stats: RideStats) => void;
}

type Stage = { name: "countdown"; count: number } | { name: "go" } | { name: "racing" };

function useCountdown(onStart: () => void): Stage {
  const [stage, setStage] = useState<Stage>({ name: "countdown", count: 3 });
  const start = useLatest(onStart);

  useEffect(() => {
    const timers = [
      setTimeout(sounds.countdown, 0),
      setTimeout(() => {
        setStage({ name: "countdown", count: 2 });
        sounds.countdown();
      }, COUNTDOWN_STEP_MS),
      setTimeout(() => {
        setStage({ name: "countdown", count: 1 });
        sounds.countdown();
      }, COUNTDOWN_STEP_MS * 2),
      setTimeout(() => {
        setStage({ name: "go" });
        sounds.go();
      }, COUNTDOWN_STEP_MS * 3),
      setTimeout(
        () => {
          setStage({ name: "racing" });
          start.current();
        },
        COUNTDOWN_STEP_MS * 3 + GO_DISPLAY_MS,
      ),
    ];
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [start]);

  return stage;
}

interface Frame {
  progress: RideProgress;
  reading: SensorReading;
  track: Track;
  /** The bell's mark (record or first-ride goal) was passed during this ride. */
  rung: boolean;
}

function useRideLoop(
  running: boolean,
  sensor: Sensor,
  settings: Settings,
  recordPoints: number | null,
  onFinish: (points: number, stats: RideStats) => void,
): Frame {
  const [frame, setFrame] = useState<Frame>(() => ({
    progress: startRide(),
    reading: ZERO_READING,
    track: startTrack(bellMark(recordPoints, settings), settings),
    rung: false,
  }));
  const finish = useLatest(onFinish);
  // Read through a ref: reconnecting the bike mid-ride must not restart the ride.
  const currentSensor = useLatest(sensor);

  useEffect(() => {
    if (!running) return;
    const { durationSec, metric } = settings;
    let progress = startRide();
    const mark = bellMark(recordPoints, settings);
    let track = startTrack(mark, settings);
    let rung = false;
    let last = performance.now();
    let lastTick = TICK_FROM_SEC + 1;
    let raf = 0;

    const step = (now: number) => {
      const reading = currentSensor.current.read(now);
      const dtSec = (now - last) / 1000;
      progress = stepRide(progress, reading, metric, dtSec, durationSec);
      track = stepTrack(track, progress.points, dtSec);
      last = now;
      if (!rung && ringsBell(progress.points, mark)) {
        rung = true;
        sounds.bell();
      }
      setFrame({ progress, reading, track, rung });

      const secondsLeft = Math.ceil(remainingSec(progress, durationSec));
      if (secondsLeft <= TICK_FROM_SEC && secondsLeft > 0 && secondsLeft < lastTick) {
        lastTick = secondsLeft;
        sounds.tick();
      }
      if (isRideOver(progress, durationSec)) finish.current(progress.points, rideStats(progress));
      else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [running, settings, recordPoints, currentSensor, finish]);

  return frame;
}

/** Hold-to-pedal control for the demo mode: pointer (touch/mouse) and Space. */
function HoldToPedal({ sensor }: { sensor: DemoSensor }) {
  const { t } = useTranslation();
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      event.preventDefault(); // also for auto-repeat, or the page scrolls
      if (event.repeat) return;
      const down = event.type === "keydown";
      if (down) sensor.press();
      else sensor.release();
      setHeld(down);
    };
    const onBlur = () => {
      sensor.release();
      setHeld(false);
    };
    addEventListener("keydown", onKey);
    addEventListener("keyup", onKey);
    addEventListener("blur", onBlur);
    return () => {
      removeEventListener("keydown", onKey);
      removeEventListener("keyup", onKey);
      removeEventListener("blur", onBlur);
      sensor.release();
    };
  }, [sensor]);

  const release = () => {
    sensor.release();
    setHeld(false);
  };

  return (
    <button
      type="button"
      className={cx(styles.hold, held && styles.held)}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        sensor.press();
        setHeld(true);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      // A long press would otherwise open the context menu on Android.
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      {t("ride.hold")}
    </button>
  );
}

export function RideScreen({ player, round, settings, record, sensor, onFinish }: Props) {
  const { t, i18n } = useTranslation();
  const stage = useCountdown(() => {
    sensor.reset();
  });
  const { progress, reading, track, rung } = useRideLoop(
    stage.name === "racing",
    sensor,
    settings,
    record?.points ?? null,
    onFinish,
  );

  const mark = bellMark(record?.points ?? null, settings);
  const bellPosition = trackPosition(mark.points, track.target);
  // A "record" mark always comes from `record`.
  const recordName = record?.player.name ?? "";
  const recordLabel = rung
    ? t("ride.recordBeaten")
    : t("ride.record", { name: recordName, context: elisionContext(recordName) });
  const goalLabel = rung ? t("ride.goalReached") : t("ride.goal");
  const bellLabel = mark.kind === "goal" ? goalLabel : recordLabel;
  const seconds = new Intl.NumberFormat(i18n.language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(remainingSec(progress, settings.durationSec));
  const lane = (position: number) => `calc(2.5rem + ${position} * (100% - 5rem))`;
  const secondsLeft = remainingSec(progress, settings.durationSec);

  return (
    <div className={styles.ride}>
      <p className={styles.who}>
        {t("ride.turn", { name: player.name, context: elisionContext(player.name) })}
        <span className={styles.round}>{t("ride.round", { round, rounds: settings.rounds })}</span>
      </p>

      {stage.name !== "racing" ? (
        <p className={styles.countdown} aria-live="assertive">
          {stage.name === "go" ? t("ride.go") : stage.count}
        </p>
      ) : (
        <>
          <p className={styles.score} data-testid="ride-score">
            <FixedDigits>{Math.round(progress.points)}</FixedDigits>
          </p>
          <p className={cx(styles.timer, secondsLeft <= TICK_FROM_SEC && styles.urgent)}>
            <FixedDigits>{seconds}</FixedDigits>
          </p>
        </>
      )}

      <div className={styles.track}>
        <div className={cx(styles.bell, rung && styles.rung)} style={{ left: lane(bellPosition) }}>
          <span aria-hidden="true">🔔</span>
          <span
            className={cx(
              styles.bellLabel,
              bellPosition < 0.5 && styles.bellLabelAfter,
              rung && styles.beaten,
            )}
          >
            {bellLabel}
          </span>
        </div>
        <div
          className={styles.bike}
          style={{ left: lane(trackPosition(progress.points, track.target)) }}
          aria-hidden="true"
        >
          🚴
        </div>
      </div>

      <div className={styles.bottom}>
        <p className={styles.sensors}>
          <span>
            <b>
              <FixedDigits>{Math.round(reading.cadence)}</FixedDigits>
            </b>{" "}
            {t("ride.cadenceUnit")}
          </span>
          <span>
            <b>
              <FixedDigits>{Math.round(reading.power)}</FixedDigits>
            </b>{" "}
            {t("ride.powerUnit")}
          </span>
        </p>
        {sensor instanceof DemoSensor && <HoldToPedal sensor={sensor} />}
      </div>
    </div>
  );
}
