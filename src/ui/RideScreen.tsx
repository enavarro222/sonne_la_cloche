import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
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
import type { RideTrace } from "../core/game";
import { type Course, raiseCourse } from "../core/handicap";
import { SLOPE_PERCENT, type Settings } from "../core/settings";
import { elisionContext } from "../i18n/elision";
import { DemoSensor, type Foot } from "../sensors/demo/demoSensor";
import { type Sensor, type SensorReading, ZERO_READING } from "../sensors/types";
import { cx } from "./cx";
import { Cyclist } from "./cyclist/Cyclist";
import { advanceCrank } from "./cyclist/geometry";
import { FixedDigits } from "./FixedDigits";
import { Lifter, WIDTH as LIFTER_WIDTH } from "./lifter/Lifter";
import styles from "./RideScreen.module.css";
import { sounds } from "./sound";
import { useLatest } from "./useLatest";

export interface FinishedRide {
  points: number;
  stats: RideStats;
  trace: RideTrace;
  /** The slope ridden, when each player has their own. */
  gradePct?: number;
}

export const COUNTDOWN_STEP_MS = 800;
export const GO_DISPLAY_MS = 450;
const TICK_FROM_SEC = 5;

interface Props {
  player: Player;
  round: number;
  settings: Settings;
  record: { player: Player; points: number } | null;
  sensor: Sensor;
  /** This player's own slope; only when each player has their own. */
  course?: Course | null;
  onFinish: (ride: FinishedRide) => void;
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
  /** Radians, turning with the measured cadence. */
  crankAngle: number;
  course: Course | null;
}

function useRideLoop(
  running: boolean,
  sensor: Sensor,
  settings: Settings,
  recordPoints: number | null,
  initialCourse: Course | null,
  onFinish: (ride: FinishedRide) => void,
): Frame {
  const [frame, setFrame] = useState<Frame>(() => ({
    progress: startRide(initialCourse?.startSpeed),
    reading: ZERO_READING,
    track: startTrack(bellMark(recordPoints, settings), settings),
    rung: false,
    crankAngle: 0,
    course: initialCourse,
  }));
  const finish = useLatest(onFinish);
  // Read through a ref: reconnecting the bike mid-ride must not restart the ride.
  const currentSensor = useLatest(sensor);

  useEffect(() => {
    if (!running) return;
    const { durationSec, metric } = settings;
    // A flying start: the speed at "Go" is the one the player's level holds.
    let progress = startRide(initialCourse?.startSpeed);
    let course = initialCourse;
    const mark = bellMark(recordPoints, settings);
    let track = startTrack(mark, settings);
    let rung = false;
    let crankAngle = 0;
    const startedAt = new Date().toISOString();
    let last = performance.now();
    let lastTick = TICK_FROM_SEC + 1;
    let raf = 0;

    const step = (now: number) => {
      const reading = currentSensor.current.read(now);
      const dtSec = (now - last) / 1000;
      progress = stepRide(progress, reading, metric, dtSec, durationSec, course ?? undefined);
      if (course) {
        const raised = raiseCourse(course, rideStats(progress).avgPower, progress.elapsedSec);
        if (raised !== course) {
          course = raised;
          void currentSensor.current.setSlope?.(course.gradePct);
        }
      }
      track = stepTrack(track, progress.points, dtSec);
      crankAngle = advanceCrank(crankAngle, reading.cadence, dtSec);
      last = now;
      if (!rung && ringsBell(progress.points, mark)) {
        rung = true;
        sounds.bell();
      }
      setFrame({ progress, reading, track, rung, crankAngle, course });

      const secondsLeft = Math.ceil(remainingSec(progress, durationSec));
      if (secondsLeft <= TICK_FROM_SEC && secondsLeft > 0 && secondsLeft < lastTick) {
        lastTick = secondsLeft;
        sounds.tick();
      }
      if (isRideOver(progress, durationSec)) {
        finish.current({
          points: progress.points,
          stats: rideStats(progress),
          trace: { startedAt, samples: progress.samples },
          ...(course && { gradePct: course.gradePct }),
        });
      } else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [running, settings, recordPoints, initialCourse, currentSensor, finish]);

  return frame;
}

const KEYS: Record<string, Foot> = { ArrowLeft: "left", ArrowRight: "right" };

/**
 * Demo pedaling: left and right in turn, with the arrow keys or two big
 * buttons on a touch screen. The flash shows which foot went down.
 */
function PedalButtons({ sensor }: { sensor: DemoSensor }) {
  const { t } = useTranslation();
  const [down, setDown] = useState<Foot | null>(null);
  const step = useCallback(
    (foot: Foot) => {
      sensor.step(foot, performance.now());
      setDown(foot);
    },
    [sensor],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const foot = KEYS[event.code];
      if (!foot) return;
      event.preventDefault(); // no page scrolling
      if (!event.repeat) step(foot);
    };
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("keydown", onKey);
    };
  }, [step]);

  useEffect(() => {
    if (!down) return;
    const timer = setTimeout(() => {
      setDown(null);
    }, 120);
    return () => {
      clearTimeout(timer);
    };
  }, [down]);

  const button = (foot: Foot, label: string) => (
    <button
      type="button"
      className={cx(styles.foot, down === foot && styles.down)}
      onPointerDown={() => {
        step(foot);
      }}
      // A long press would otherwise open the context menu on Android.
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      {label}
    </button>
  );

  return (
    <div className={styles.pedals}>
      {button("left", t("ride.leftFoot"))}
      {button("right", t("ride.rightFoot"))}
    </div>
  );
}

/** The sensor's live values while `active` (the ride loop is not running yet). */
function useLiveReading(active: boolean, sensor: Sensor): SensorReading {
  const [reading, setReading] = useState(ZERO_READING);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const poll = (now: number) => {
      setReading(sensor.read(now));
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [active, sensor]);
  return reading;
}

/** An element's width in pixels, kept up to date. */
function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);
  return [ref, width];
}

/** The track leans twice the real angle, up to 8°: a 2 % slope must show. */
const tiltDeg = (gradePct: number) =>
  Math.min(8, (2 * Math.atan(Math.max(0, gradePct) / 100) * 180) / Math.PI);
/** Where the strongman stands, as a share of the track width from its left. */
const LIFTER_AT = 0.92;
/** The gauge goes up to this share of the player's level… */
const GAUGE_MAX = 1.5;
/** …and its needle turns green from this share on. */
const GAUGE_GOOD = 0.95;

/**
 * The player's power against their level (the mark). No upper limit shown:
 * going above one's level is what the game rewards.
 */
function PowerGauge({ power, target }: { power: number; target: number }) {
  const { t } = useTranslation();
  const ratio = Math.min(GAUGE_MAX, power / target);
  const at = (value: number) => `${(value / GAUGE_MAX) * 100}%`;
  return (
    <div
      className={styles.gauge}
      role="meter"
      aria-label={t("ride.gauge")}
      aria-valuemin={0}
      aria-valuemax={Math.round(target * GAUGE_MAX)}
      aria-valuenow={Math.round(power)}
    >
      <div className={styles.gaugeLevel} style={{ left: at(1) }} />
      <div
        className={cx(styles.gaugeNeedle, ratio >= GAUGE_GOOD && styles.good)}
        style={{ left: at(ratio) }}
      />
    </div>
  );
}

export function RideScreen({
  player,
  round,
  settings,
  record,
  sensor,
  course = null,
  onFinish,
}: Props) {
  const { t, i18n } = useTranslation();
  const stage = useCountdown(() => {
    // On a slope the countdown is the run-up: keep what was pedaled.
    if (!course) sensor.reset();
  });
  useEffect(() => {
    if (course) sensor.reset();
    // Only when the screen opens: before the run-up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Again before each ride: another app may have changed it since.
  const slopeSensor = useLatest(sensor);
  const startGrade = course?.gradePct ?? SLOPE_PERCENT[settings.slope];
  useEffect(() => {
    void slopeSensor.current.setSlope?.(startGrade);
  }, [slopeSensor, startGrade]);
  const ride = useRideLoop(
    stage.name === "racing",
    sensor,
    settings,
    record?.points ?? null,
    course,
    onFinish,
  );
  const { progress, track, rung, crankAngle } = ride;
  const target = ride.course?.targetPower ?? null;
  const live = useLiveReading(stage.name !== "racing" && target !== null, sensor);
  const reading = stage.name === "racing" ? ride.reading : live;
  const gradePct = ride.course?.gradePct ?? SLOPE_PERCENT[settings.slope];
  const [sceneRef, sceneWidth] = useWidth<HTMLDivElement>();
  const tilt = tiltDeg(gradePct);
  const rise = (LIFTER_AT - 0.5) * sceneWidth * Math.sin((tilt * Math.PI) / 180);
  const percent = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(
    gradePct,
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
  const byDistance = settings.metric === "distance";
  // Before "Go", the speed the flying start will give.
  const speed = stage.name === "racing" ? progress.speed : (course?.startSpeed ?? 0);

  return (
    <div className={styles.ride}>
      <div className={styles.top}>
        <div className={styles.heading}>
          <p className={styles.who}>
            {t("ride.turn", { name: player.name, context: elisionContext(player.name) })}
            <span className={styles.round}>
              {t("ride.round", { round, rounds: settings.rounds })}
            </span>
          </p>
          {course?.measuring && <p className={styles.calibration}>{t("ride.calibration")}</p>}
        </div>
        {/* The time left has its own corner: shown from the countdown on. */}
        <p className={cx(styles.timer, secondsLeft <= TICK_FROM_SEC && styles.urgent)}>
          <FixedDigits>{seconds}</FixedDigits>
          <small>{t("ride.secondsUnit")}</small>
        </p>
      </div>

      {/* One box for the countdown and the score: nothing moves at "Go". */}
      <div className={styles.big}>
        {stage.name !== "racing" ? (
          <p className={styles.countdown} aria-live="assertive">
            {stage.name === "go" ? t("ride.go") : stage.count}
          </p>
        ) : (
          <p className={styles.score} data-testid="ride-score">
            <FixedDigits>{Math.round(progress.points)}</FixedDigits>
            {byDistance && <small>{t("ride.distanceUnit")}</small>}
          </p>
        )}
      </div>

      <p className={styles.stats}>
        {byDistance && (
          <span>
            <FixedDigits>{Math.round(speed * 3.6)}</FixedDigits> {t("ride.speedUnit")}
          </span>
        )}
        <span data-testid="ride-grade">{t("settings.slope.short", { percent })}</span>
      </p>
      {target !== null && <PowerGauge power={reading.power} target={target} />}

      <div className={styles.scene} ref={sceneRef}>
        <div className={styles.track} style={{ transform: `rotate(${-tilt}deg)` }}>
          <div
            className={cx(styles.bell, rung && styles.rung)}
            style={{ left: lane(bellPosition) }}
          >
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
          >
            <Cyclist crankAngle={crankAngle} />
          </div>
        </div>
        <div
          className={styles.lifter}
          style={{
            left: `calc(${LIFTER_AT * 100}% - ${LIFTER_WIDTH / 2}px)`,
            top: `calc(100% - ${rise}px)`,
          }}
        >
          <Lifter rise={rise} gradePct={gradePct} />
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
        {sensor instanceof DemoSensor && <PedalButtons sensor={sensor} />}
      </div>
    </div>
  );
}
