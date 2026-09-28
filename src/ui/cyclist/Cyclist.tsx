import { kneePosition, pedalPosition, type Point } from "./geometry";
import styles from "./Cyclist.module.css";

// Drawing in a 120×90 box, bike facing right (the way the race goes).
const REAR_AXLE: Point = { x: 26, y: 66 };
const FRONT_AXLE: Point = { x: 94, y: 66 };
const WHEEL_RADIUS = 18;
const CRANK_CENTER: Point = { x: 56, y: 64 };
const CRANK_LENGTH = 9;
const HIP: Point = { x: 47, y: 30 };
const SHOULDER: Point = { x: 71, y: 15 };
const HAND: Point = { x: 90, y: 31 };
const THIGH = 22;
const SHIN = 23;
/** How far down the thigh the cycling shorts go. */
const SHORTS_LENGTH = 0.65;
/** The wheels turn faster than the cranks: a kid's bike in a low gear. */
const GEAR_RATIO = 2;

const line = (a: Point, b: Point) => ({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
const polyline = (...points: Point[]) => points.map((p) => `${p.x},${p.y}`).join(" ");

function Leg({ crankAngle, far }: { crankAngle: number; far?: boolean }) {
  const pedal = pedalPosition(CRANK_CENTER, CRANK_LENGTH, crankAngle);
  const knee = kneePosition(HIP, pedal, THIGH, SHIN);
  return (
    <g className={far ? styles.far : undefined}>
      <line className={styles.crank} {...line(CRANK_CENTER, pedal)} />
      <polyline className={styles.leg} points={polyline(HIP, knee, pedal)} />
      <line
        className={styles.shorts}
        {...line(HIP, {
          x: HIP.x + (knee.x - HIP.x) * SHORTS_LENGTH,
          y: HIP.y + (knee.y - HIP.y) * SHORTS_LENGTH,
        })}
      />
      <line className={styles.shoe} x1={pedal.x - 3} y1={pedal.y} x2={pedal.x + 5} y2={pedal.y} />
    </g>
  );
}

function Wheel({ axle, turn }: { axle: Point; turn: number }) {
  return (
    <>
      <circle cx={axle.x} cy={axle.y} r={WHEEL_RADIUS} />
      <g transform={`rotate(${turn} ${axle.x} ${axle.y})`}>
        {[0, 60, 120].map((a) => (
          <line
            key={a}
            className={styles.spoke}
            x1={axle.x - WHEEL_RADIUS}
            y1={axle.y}
            x2={axle.x + WHEEL_RADIUS}
            y2={axle.y}
            transform={`rotate(${a} ${axle.x} ${axle.y})`}
          />
        ))}
      </g>
    </>
  );
}

/** A kid on a bike, legs turning with the crank angle (radians). */
export function Cyclist({ crankAngle }: { crankAngle: number }) {
  const wheelTurn = (crankAngle * GEAR_RATIO * 180) / Math.PI;
  return (
    <svg className={styles.cyclist} viewBox="0 0 120 90" aria-hidden="true">
      <Leg crankAngle={crankAngle + Math.PI} far />

      <g className={styles.wheel}>
        <Wheel axle={REAR_AXLE} turn={wheelTurn} />
        <Wheel axle={FRONT_AXLE} turn={wheelTurn} />
      </g>

      <g className={styles.frame}>
        <polyline points={polyline(REAR_AXLE, CRANK_CENTER, { x: 48, y: 36 }, REAR_AXLE)} />
        <polyline points={polyline({ x: 48, y: 36 }, { x: 83, y: 40 }, CRANK_CENTER)} />
        <polyline points={polyline({ x: 85, y: 32 }, { x: 83, y: 40 }, FRONT_AXLE)} />
        <line {...line({ x: 85, y: 32 }, { x: 92, y: 31 })} />
        <line className={styles.saddle} x1={41} y1={34} x2={53} y2={34} />
        <circle className={styles.chainring} cx={CRANK_CENTER.x} cy={CRANK_CENTER.y} r={5} />
      </g>

      <g className={styles.rider}>
        <line className={styles.torso} {...line(HIP, SHOULDER)} />
        <polyline className={styles.arm} points={polyline(SHOULDER, { x: 82, y: 24 }, HAND)} />
        <circle className={styles.head} cx={78} cy={8} r={7} />
        <path className={styles.helmet} d="M 70.5 8 A 7.5 7.5 0 0 1 85.5 8 Z" />
      </g>

      <Leg crankAngle={crankAngle} />
    </svg>
  );
}
