import { cx } from "../cx";
import styles from "./Lifter.module.css";

// A little strongman under the end of the track, holding it up with
// stretchy arms: the steeper the slope, the longer the arms and the redder
// the face. Drawn in pixels: the top of the drawing touches the track.

/** Head, body and legs, below the arms, in drawing units. */
const BODY_HEIGHT = 64;
const DRAWING_WIDTH = 64;
/** Pixels per drawing unit: big enough to read from 3 m. */
const SCALE = 1.4;
/** Width on screen, px. */
export const WIDTH = DRAWING_WIDTH * SCALE;

/** From this grade (%) he sweats… */
const SWEAT_FROM = 5;
/** …and from this one he shakes. */
const SHAKE_FROM = 8;

interface Props {
  /** How far the track is lifted above his resting height, px. */
  rise: number;
  gradePct: number;
}

export function Lifter({ rise, gradePct }: Props) {
  const y = Math.max(0, rise) / SCALE;
  const lifting = gradePct > 0;
  const head = { x: 32, y: y + 14 };
  const shoulders = y + 26;
  const hip = y + 44;
  // Hands on the track when lifting, else hands on hips.
  const leftHand = lifting ? { x: 20, y: 2 } : { x: 25, y: hip - 2 };
  const rightHand = lifting ? { x: 44, y: 2 } : { x: 39, y: hip - 2 };
  const mouth =
    gradePct < 3
      ? `M ${head.x - 4} ${head.y + 3} q 4 4 8 0`
      : gradePct < SHAKE_FROM
        ? `M ${head.x - 4} ${head.y + 4} h 8`
        : `M ${head.x - 4} ${head.y + 4} l 2 -1.5 l 2 1.5 l 2 -1.5 l 2 1.5`;

  return (
    <svg
      className={cx(styles.lifter, gradePct >= SHAKE_FROM && styles.shaking)}
      width={WIDTH}
      height={(BODY_HEIGHT + y) * SCALE}
      viewBox={`0 0 ${DRAWING_WIDTH} ${BODY_HEIGHT + y}`}
      aria-hidden="true"
    >
      <g className={styles.arms}>
        <polyline points={`24,${shoulders} ${leftHand.x},${leftHand.y}`} />
        <polyline points={`40,${shoulders} ${rightHand.x},${rightHand.y}`} />
      </g>
      {lifting && (
        <g className={styles.hands}>
          <circle cx={leftHand.x} cy={leftHand.y + 1} r={3} />
          <circle cx={rightHand.x} cy={rightHand.y + 1} r={3} />
        </g>
      )}
      <g className={styles.legs}>
        <polyline points={`32,${hip} 21,${y + 52} 19,${y + 62}`} />
        <polyline points={`32,${hip} 43,${y + 52} 45,${y + 62}`} />
      </g>
      <line className={styles.shirt} x1={32} y1={y + 24} x2={32} y2={hip} />
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
    </svg>
  );
}
