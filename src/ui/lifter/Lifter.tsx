import type { CSSProperties } from "react";
import { cx } from "../cx";
import styles from "./Lifter.module.css";

// A little strongman standing at the bottom of the screen, holding up the end
// of the track with stretchy arms: the steeper the slope, the redder his face.
// Drawn in pixels; his arms reach outside his own box, up to the track.

/** His box: head, body and legs, px. Smaller than the cyclist. */
export const SIZE = 64;

/** From this grade (%) he sweats… */
const SWEAT_FROM = 5;
/** …and from this one he shakes. */
const SHAKE_FROM = 8;
/** Gap between his two hands on the track, px. */
const HANDS_APART = 12;

interface Props {
  /** Where he holds the track, px from the top left of his box (y < 0: above him). */
  hold: { x: number; y: number };
  gradePct: number;
  /** The time is falling on his head: he lets go and runs, arms over his head. */
  fleeing?: boolean;
}

export function Lifter({ hold, gradePct, fleeing = false }: Props) {
  const lifting = gradePct > 0 && !fleeing;
  const head = { x: 32, y: 14 };
  const shoulders = { left: { x: 24, y: 26 }, right: { x: 40, y: 26 } };
  const hip = 44;
  // Hands on the track when lifting, over his head when fleeing, else on hips.
  const leftHand = lifting
    ? { x: hold.x - HANDS_APART / 2, y: hold.y }
    : fleeing
      ? { x: head.x - 7, y: head.y - 10 }
      : { x: 25, y: hip - 2 };
  const rightHand = lifting
    ? { x: hold.x + HANDS_APART / 2, y: hold.y }
    : fleeing
      ? { x: head.x + 7, y: head.y - 10 }
      : { x: 39, y: hip - 2 };
  const mouth = fleeing
    ? `M ${head.x - 2} ${head.y + 4} a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0`
    : gradePct < 3
      ? `M ${head.x - 4} ${head.y + 3} q 4 4 8 0`
      : gradePct < SHAKE_FROM
        ? `M ${head.x - 4} ${head.y + 4} h 8`
        : `M ${head.x - 4} ${head.y + 4} l 2 -1.5 l 2 1.5 l 2 -1.5 l 2 1.5`;
  const line = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    `${a.x},${a.y} ${b.x},${b.y}`;

  return (
    <svg
      className={styles.lifter}
      // Holding a steep track, he breathes hard.
      style={
        { "--breath": `${lifting ? Math.max(0.5, 1.4 - gradePct * 0.1) : 1.6}s` } as CSSProperties
      }
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden="true"
    >
      <g className={styles.arms}>
        <polyline points={line(shoulders.left, leftHand)} />
        <polyline points={line(shoulders.right, rightHand)} />
      </g>
      {lifting && (
        <g className={styles.hands}>
          <circle cx={leftHand.x} cy={leftHand.y + 1} r={3} />
          <circle cx={rightHand.x} cy={rightHand.y + 1} r={3} />
        </g>
      )}
      {/* Only his body breathes and shakes: his hands stay on the track. */}
      <g
        className={cx(
          styles.body,
          lifting && gradePct >= SHAKE_FROM && styles.shaking,
          fleeing && styles.still,
        )}
      >
        <g className={styles.legs}>
          <polyline points={`32,${hip} 21,52 19,62`} />
          <polyline points={`32,${hip} 43,52 45,62`} />
        </g>
        <line className={styles.shirt} x1={32} y1={24} x2={32} y2={hip} />
        <circle
          className={cx(styles.head, gradePct >= SHAKE_FROM && styles.red)}
          cx={head.x}
          cy={head.y}
          r={9}
        />
        <circle className={styles.eye} cx={head.x - 3.5} cy={head.y - 1} r={1.2} />
        <circle className={styles.eye} cx={head.x + 3.5} cy={head.y - 1} r={1.2} />
        <path className={styles.mouth} d={mouth} />
        {gradePct >= SWEAT_FROM && (
          <g className={styles.sweat}>
            <path d={`M ${head.x + 12} ${head.y - 8} q 2 4 0 5 q -2 -1 0 -5`} />
            <path d={`M ${head.x - 13} ${head.y - 4} q 2 4 0 5 q -2 -1 0 -5`} />
          </g>
        )}
      </g>
    </svg>
  );
}
