import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Player } from "../core/players";
import {
  bellMark,
  remainingSec,
  type RideProgress,
  type RideStats,
  trackPosition,
  FINALE_SEC,
  type FinaleMove,
  type Track,
} from "../core/ride";
import type { RideTrace } from "../core/game";
import type { Course } from "../core/handicap";
import {
  isRideStateOver,
  riddenGrade,
  rideOutcome,
  type RideState,
  startRideState,
  stepRideState,
  TICK_FROM_SEC,
} from "../core/rideLoop";
import { liveryOf } from "../core/livery";
import type { Settings } from "../core/settings";
import { elisionContext } from "../i18n/elision";
import {
  DemoSensor,
  type Drivetrain,
  emitControl,
  type Foot,
  type Sensor,
  type SensorReading,
  VIRTUAL_RATIOS,
  ZERO_READING,
} from "home-trainer-kit";
import { Bell } from "./Bell";
import { cx } from "./cx";
import { Cyclist } from "./cyclist/Cyclist";
import { advanceCrank, advanceWheel } from "./cyclist/geometry";
import { FixedDigits } from "./FixedDigits";
import { Lifter, SIZE as LIFTER_SIZE } from "./lifter/Lifter";
import styles from "./RideScreen.module.css";
import { sounds } from "./sound";
import { useLatest } from "./useLatest";
import { useVirtualGear } from "./useVirtualGear";

export interface FinishedRide {
  metres: number;
  stats: RideStats;
  trace: RideTrace;
  /** By distance, the slope of the ride's course (own or common), raised mid-ride if it was. */
  gradePct?: number;
}

export const COUNTDOWN_STEP_MS = 800;
export const GO_DISPLAY_MS = 450;

interface Props {
  player: Player;
  round: number;
  settings: Settings;
  record: { player: Player; metres: number } | null;
  sensor: Sensor;
  /** The real drivetrain when the game shifts virtual gears; null with the bike's own. */
  drivetrain?: Drivetrain | null;
  /**
   * By distance, the course ridden (each their own slope, or the common one):
   * distance is scored on it. Null by leg speed.
   */
  course?: Course | null;
  onFinish: (ride: FinishedRide) => void;
  /** Drops the ride (started too soon, wrong gear…): nothing is recorded. */
  onCancel?: () => void;
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
  /** Radians, rolling at the bike's speed (by distance), even when not pedaling. */
  wheelAngle: number;
  course: Course | null;
  /** The slope ridden right now, in percent. */
  gradePct: number;
  /** The pole bearer's move in the last seconds, once decided. */
  finale: FinaleMove | null;
}

function useRideLoop(
  running: boolean,
  sensor: Sensor,
  settings: Settings,
  recordMetres: number | null,
  initialCourse: Course | null,
  onFinish: (ride: FinishedRide) => void,
): Frame {
  const [frame, setFrame] = useState<Frame>(() =>
    toFrame(startRideState(settings, recordMetres, initialCourse), settings, ZERO_READING, 0, 0),
  );
  const finish = useLatest(onFinish);
  // Read through a ref: reconnecting the bike mid-ride must not restart the ride.
  const currentSensor = useLatest(sensor);

  useEffect(() => {
    if (!running) return;
    let state = startRideState(settings, recordMetres, initialCourse);
    let crankAngle = 0;
    let wheelAngle = 0;
    const startedAt = new Date().toISOString();
    let last = performance.now();
    let raf = 0;

    const step = (now: number) => {
      const reading = currentSensor.current.read(now);
      const dtSec = (now - last) / 1000;
      const result = stepRideState(state, reading, dtSec, settings);
      state = result.state;
      for (const event of result.events) {
        if (event.type === "slope") void currentSensor.current.setSlope?.(event.gradePct);
        else if (event.type === "bell") sounds.bell();
        else sounds.tick();
      }
      crankAngle = advanceCrank(crankAngle, reading.cadence, dtSec);
      // The wheels roll at the bike's speed, and on when the legs stop.
      wheelAngle = advanceWheel(wheelAngle, state.progress.speed, dtSec);
      last = now;
      setFrame(toFrame(state, settings, reading, crankAngle, wheelAngle));
      if (isRideStateOver(state, settings)) {
        finish.current({
          ...rideOutcome(state),
          trace: { startedAt, samples: state.progress.samples },
        });
      } else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [running, settings, recordMetres, initialCourse, currentSensor, finish]);

  return frame;
}

const toFrame = (
  state: RideState,
  settings: Settings,
  reading: SensorReading,
  crankAngle: number,
  wheelAngle: number,
): Frame => ({
  progress: state.progress,
  reading,
  track: state.track,
  rung: state.rung,
  crankAngle,
  wheelAngle,
  course: state.course,
  gradePct: riddenGrade(state, settings),
  finale: state.finale,
});

/** On the on-screen shift buttons; their names are in `ride.gearUp`, `ride.gearDown`. */
const SHIFT_SIGNS = { up: "+", down: "−" } as const;

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
function useWidth<T extends HTMLElement>({ widest = false } = {}): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // `widest`: the largest width seen so far, never shrinking.
    const update = (next: number) => {
      setWidth((current) => (widest ? Math.max(current, next) : next));
    };
    update(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) update(entry.contentRect.width);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [widest]);
  return [ref, width];
}

/**
 * The ride screen's geometry: the scene's width, the gap between the bottom
 * of the track's scene and the bottom of the screen, where the pole bearer
 * stands, and the room on the right of the scene before the screen's edge.
 */
function useRideLayout(): [
  RefObject<HTMLDivElement | null>,
  RefObject<HTMLDivElement | null>,
  { sceneWidth: number; gap: number; roomRight: number },
] {
  const rideRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ sceneWidth: 0, gap: 0, roomRight: 0 });
  useEffect(() => {
    const ride = rideRef.current;
    const scene = sceneRef.current;
    if (!ride || !scene) return;
    const measure = () => {
      const r = ride.getBoundingClientRect();
      const s = scene.getBoundingClientRect();
      // `main` clips what goes past it: the screen's edge, as it is full width.
      const edge = (scene.closest("main") ?? document.documentElement).getBoundingClientRect();
      setLayout({ sceneWidth: s.width, gap: r.bottom - s.bottom, roomRight: edge.right - s.right });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(ride);
    observer.observe(scene);
    return () => {
      observer.disconnect();
    };
  }, []);
  return [rideRef, sceneRef, layout];
}

/** The track leans twice the real angle, up to 8°: a 2 % slope must show. */
const tiltDeg = (gradePct: number) =>
  Math.min(8, (2 * Math.atan(Math.max(0, gradePct) / 100) * 180) / Math.PI);
/** How long the track takes to tilt to a new slope, e.g. at the finale (ms). */
const TILT_MS = 1100;
/** Ease out with a little overshoot: the track bounces as it settles. */
const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;

/**
 * `target`, reached over `durationMs` instead of at once: the track lifts or
 * falls where everyone can see it (at once if the device asks for less motion).
 */
function useEased(target: number, durationMs: number): number {
  const [shown, setShown] = useState(target);
  const shownRef = useLatest(shown);
  const still =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    const from = shownRef.current;
    if (still || from === target) return;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setShown(from + (target - from) * easeOutBack(t));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [target, durationMs, still, shownRef]);
  return still ? target : shown;
}
/** Height left above a full hourglass for the seconds on its surface. */
const HOURGLASS_LABEL_ROOM = "4.5rem";
/** The horizontal padding of `.main` (App.module.css). */
const MAIN_PADDING = "var(--main-padding-inline)";
/**
 * The seconds of the hourglass come down a column on the right, as wide as
 * they are plus this margin (px); the pole bearer stands at its foot and the
 * track stops short of it, whatever the screen size.
 */
const COLUMN_MARGIN = 8;
/** Where his hands hold the track, short of its end, px. */
const HOLD_INSET = 14;
/** He sees the finale coming this many seconds ahead: he panics. */
const FINALE_WARNING_SEC = 3;
/** When he runs away, he stops this far from the screen's edge (px)… */
const EDGE_MARGIN = 12;
/** …if he can get that far from the falling seconds; if not, he runs off the screen. */
const FLEE_MIN = LIFTER_SIZE;
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
  drivetrain = null,
  onFinish,
  onCancel = () => undefined,
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
  const ride = useRideLoop(
    stage.name === "racing",
    sensor,
    settings,
    record?.metres ?? null,
    course,
    onFinish,
  );
  const { progress, track, rung, crankAngle, wheelAngle } = ride;
  const target = ride.course?.targetPower ?? null;
  const live = useLiveReading(stage.name !== "racing" && target !== null, sensor);
  const reading = stage.name === "racing" ? ride.reading : live;
  const { gradePct, finale } = ride;
  // The trainer's slope, again before each ride (another app may have changed
  // it since), and on a bike reconnected mid-ride: the slope ridden now, which
  // a raised level or the twist may have changed since the start.
  const ridden = useLatest(gradePct);
  useEffect(() => {
    void sensor.setSlope?.(ridden.current);
  }, [sensor, ridden]);
  const gear = useVirtualGear(sensor, drivetrain);
  const cancel = useLatest(onCancel);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel.current();
    };
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("keydown", onKey);
    };
  }, [cancel]);
  const [rideRef, sceneRef, layout] = useRideLayout();
  // The widest the seconds have been ("20,0 s" before "9,9 s"): the column,
  // and so the track, must not change size as digits drop.
  const [timerRef, timerWidth] = useWidth<HTMLParagraphElement>({ widest: true });
  const tilt = useEased(tiltDeg(gradePct), TILT_MS);
  const column = Math.max(timerWidth, LIFTER_SIZE) + COLUMN_MARGIN;
  // The last seconds come down his column: he gets out of the way. He steps
  // left under the track and holds on, unless the finale sends him running.
  // With the finale on, he sees it coming: he panics a few seconds before.
  const timeLeft = remainingSec(progress, settings.durationSec);
  const racing = stage.name === "racing";
  const dodging = racing && timeLeft <= FINALE_SEC;
  const alarmed =
    racing && settings.finale === "on" && !finale && timeLeft <= FINALE_SEC + FINALE_WARNING_SEC;
  const fleeing = finale === "flee";
  // He stands at the foot of the column, at the bottom of the screen.
  const x = layout.sceneWidth - column / 2 - LIFTER_SIZE / 2;
  // Running away, he stops at the screen's edge if that is far enough from
  // the falling seconds (a wide screen); if not, he runs off the screen.
  const toEdge = layout.sceneWidth - (x + LIFTER_SIZE) + layout.roomRight - EDGE_MARGIN;
  const fleeShift = toEdge >= FLEE_MIN ? toEdge : toEdge + LIFTER_SIZE + 2 * EDGE_MARGIN;
  const shift = fleeing ? fleeShift : dodging ? -(column / 2 + LIFTER_SIZE / 2 + 8) : 0;
  const trackEnd = layout.sceneWidth - column;
  // His hands hold the track near its end, or straight above him once under it.
  const holdX = Math.min(trackEnd - HOLD_INSET, x + shift + LIFTER_SIZE / 2);
  // The track leans around its middle: at his hands it rises by their
  // distance from the middle.
  const rise = (holdX - layout.sceneWidth / 2) * Math.sin((tilt * Math.PI) / 180);
  const hold = { x: holdX - (x + shift), y: LIFTER_SIZE - layout.gap - rise };
  const percent = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(
    gradePct,
  );

  const mark = bellMark(record?.metres ?? null, settings);
  const bellPosition = trackPosition(mark.metres, track.target);
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
  // Before "Go", the speed the flying start will give.
  const speed = stage.name === "racing" ? progress.speed : (course?.startSpeed ?? 0);

  return (
    <div className={styles.ride} ref={rideRef}>
      <div className={styles.top}>
        <div className={styles.heading}>
          <p className={styles.who}>
            {t("ride.turn", { name: player.name, context: elisionContext(player.name) })}
            <span className={styles.round}>
              {t("ride.round", { round, rounds: settings.rounds })}
            </span>
          </p>
          {/* Its room is kept in every round, so nothing moves when it goes. */}
          {course && (
            <p
              className={cx(styles.calibration, !course.measuring && styles.unseen)}
              aria-hidden={!course.measuring}
            >
              {t("ride.calibration")}
            </p>
          )}
        </div>
      </div>

      {/* One box for the countdown and the score: nothing moves at "Go". */}
      <div className={styles.big}>
        {stage.name !== "racing" ? (
          <p className={styles.countdown} aria-live="assertive">
            {stage.name === "go" ? t("ride.go") : stage.count}
          </p>
        ) : (
          <p className={styles.score} data-testid="ride-score">
            <FixedDigits>{Math.round(progress.metres)}</FixedDigits>
            <small>{t("ride.distanceUnit")}</small>
          </p>
        )}
      </div>

      <p className={styles.stats}>
        <span data-testid="ride-speed">
          <FixedDigits>{Math.round(speed * 3.6)}</FixedDigits> {t("ride.speedUnit")}
        </span>
        <span>
          <FixedDigits>{Math.round(reading.cadence)}</FixedDigits> {t("ride.cadenceUnit")}
        </span>
        <span>
          <FixedDigits>{Math.round(reading.power)}</FixedDigits> {t("ride.powerUnit")}
        </span>
      </p>
      {target !== null && <PowerGauge power={reading.power} target={target} />}

      <div className={styles.scene} ref={sceneRef}>
        <div
          className={styles.road}
          // Centred: the same margin on the left as the pole bearer's on the right.
          style={{
            width: `calc(100% - ${2 * column}px)`,
            marginLeft: `${column}px`,
            transform: `rotate(${-tilt}deg)`,
          }}
        >
          {/* The slope is the game's doing, not the rider's: it goes with the track. */}
          <p className={styles.grade} data-testid="ride-grade">
            {t("settings.slope.short", { percent })}
          </p>
          <div className={styles.track}>
            <div
              className={cx(styles.bell, rung && styles.rung)}
              style={{ left: lane(bellPosition) }}
            >
              <span aria-hidden="true">
                <Bell />
              </span>
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
              style={{ left: lane(trackPosition(progress.metres, track.target)) }}
            >
              <Cyclist
                crankAngle={crankAngle}
                wheelAngle={wheelAngle}
                // Rolling, even without pedaling: the air rushes past.
                moving={progress.speed > 0.5 && racing}
                livery={liveryOf(player)}
              />
            </div>
          </div>
        </div>
        <div
          className={cx(styles.lifter, fleeing && styles.fleeing)}
          style={{
            left: `${x}px`,
            top: `calc(100% + ${layout.gap - LIFTER_SIZE}px)`,
            translate: `${shift}px 0`,
          }}
        >
          <Lifter
            hold={hold}
            gradePct={gradePct}
            alarmed={alarmed}
            fleeing={fleeing}
            timeLeft={timeLeft}
            // When the seconds come for him: he panics (finale) or steps aside.
            eventAt={settings.finale === "on" ? FINALE_SEC + FINALE_WARNING_SEC : FINALE_SEC}
            timer={timerRef}
          />
        </div>
      </div>

      <div className={styles.bottom}>
        {/* Bottom left, away from the rider's eyes: for the adult at the screen. */}
        <button type="button" className={cx("secondary", styles.cancel)} onClick={onCancel}>
          {t("ride.cancel")}
        </button>
        <div className={styles.controls}>
          {gear !== null && (
            // On screen too, should the handlebar remote fail.
            <span className={styles.gears}>
              <button
                type="button"
                className={styles.shift}
                aria-label={t("ride.gearDown")}
                onClick={() => {
                  emitControl("gearDown");
                }}
              >
                {SHIFT_SIGNS.down}
              </button>
              <span data-testid="ride-gear">
                {t("ride.gear", { gear: gear + 1, gears: VIRTUAL_RATIOS.length })}
              </span>
              <button
                type="button"
                className={styles.shift}
                aria-label={t("ride.gearUp")}
                onClick={() => {
                  emitControl("gearUp");
                }}
              >
                {SHIFT_SIGNS.up}
              </button>
            </span>
          )}
          {sensor instanceof DemoSensor && <PedalButtons sensor={sensor} />}
        </div>
      </div>
      {/*
        An hourglass: the background drains as time runs out, the seconds
        riding on its surface. Full during the countdown.
      */}
      <div
        className={cx(styles.hourglass, secondsLeft <= TICK_FROM_SEC && styles.urgent)}
        // Room is kept above a full hourglass for the seconds, which ride on
        // top of its surface: readable down to the very bottom.
        style={{
          height: `calc((100% - ${HOURGLASS_LABEL_ROOM}) * ${secondsLeft / settings.durationSec})`,
        }}
      >
        <p className={styles.timer} ref={timerRef} style={{ right: MAIN_PADDING }}>
          <FixedDigits>{seconds}</FixedDigits>
          <small>{t("ride.secondsUnit")}</small>
        </p>
      </div>
    </div>
  );
}
