import type { CSSProperties } from "react";
import type { Point } from "../cyclist/geometry";
import { cx } from "../cx";
import styles from "./Lifter.module.css";

// A fairground strongman standing at the bottom of the screen, holding up the
// end of the track with a pole: striped singlet, curly moustache, knees bent.
// He grips the pole above his head, elbows bent; the pole reaches the track,
// however far. The steeper the slope, the redder his face.

/** His drawing is 64 units square… */
const DRAWING = 64;
/** …shown this big (px): a bit smaller than the cyclist. */
export const SIZE = 80;
const SCALE = SIZE / DRAWING;

/** From this grade (%) he sweats… */
const SWEAT_FROM = 5;
/** …and from this one he shakes. */
const SHAKE_FROM = 8;
/** Gap between his two hands on the pole, in drawing units. */
const HANDS_APART = 4;
// Long enough to bend at the elbows when gripping above his head.
const UPPER_ARM = 14;
const FOREARM = 13;
/** Where he grips the pole: just above his head. */
const GRIP: Point = { x: 32, y: 1 };

const HEAD: Point = { x: 32, y: 12 };
const SHOULDERS = { left: { x: 25, y: 24 }, right: { x: 39, y: 24 } };
const HIPS = { left: { x: 28, y: 42 }, right: { x: 36, y: 42 } };

/**
 * The elbow between a shoulder and a hand, bent outwards (`side` -1 for the
 * left arm, +1 for the right). Out of reach, the arm stretches straight.
 */
function elbow(shoulder: Point, hand: Point, side: number): Point {
  const dx = hand.x - shoulder.x;
  const dy = hand.y - shoulder.y;
  const distance = Math.hypot(dx, dy) || 1;
  const reach = Math.min(distance, UPPER_ARM + FOREARM - 1e-6);
  const along = (UPPER_ARM ** 2 - FOREARM ** 2 + reach ** 2) / (2 * reach);
  const across = Math.sqrt(Math.max(0, UPPER_ARM ** 2 - along ** 2));
  const ux = dx / distance;
  const uy = dy / distance;
  // Of the two perpendiculars, the one pointing away from his body (or up).
  let px = -uy;
  let py = ux;
  if (px * side < 0 || (px === 0 && py > 0)) {
    px = -px;
    py = -py;
  }
  return {
    x: shoulder.x + ux * along + px * across,
    y: shoulder.y + uy * along + py * across,
  };
}

const points = (...list: Point[]) => list.map((p) => `${p.x},${p.y}`).join(" ");

interface Props {
  /** Where his pole holds the track, px from the top left of his box (y < 0: above him). */
  hold: { x: number; y: number };
  gradePct: number;
  /** The time is falling on his head: he lets go and runs, arms over his head. */
  fleeing?: boolean;
}

export function Lifter({ hold: holdPx, gradePct, fleeing = false }: Props) {
  const lifting = gradePct > 0 && !fleeing;
  const straining = lifting && gradePct >= SHAKE_FROM;
  const hold = { x: holdPx.x / SCALE, y: holdPx.y / SCALE };
  // The pole goes from just below his grip up to the track.
  const toTrack = { x: hold.x - GRIP.x, y: hold.y - GRIP.y };
  const length = Math.hypot(toTrack.x, toTrack.y) || 1;
  const dir = { x: toTrack.x / length, y: toTrack.y / length };
  const poleFoot = { x: GRIP.x - dir.x * 7, y: GRIP.y - dir.y * 7 };
  // Hands on the pole when lifting, over his head when fleeing, else on hips.
  const hands = lifting
    ? {
        left: GRIP,
        right: { x: GRIP.x + dir.x * HANDS_APART, y: GRIP.y + dir.y * HANDS_APART },
      }
    : fleeing
      ? { left: { x: HEAD.x - 4, y: HEAD.y - 9 }, right: { x: HEAD.x + 4, y: HEAD.y - 9 } }
      : { left: { x: 26, y: 40 }, right: { x: 38, y: 40 } };
  const elbows = {
    left: elbow(SHOULDERS.left, hands.left, -1),
    right: elbow(SHOULDERS.right, hands.right, 1),
  };
  const mouth = fleeing
    ? `M ${HEAD.x - 1.6} ${HEAD.y + 4.5} a 1.6 1.6 0 1 0 3.2 0 a 1.6 1.6 0 1 0 -3.2 0`
    : gradePct < 3
      ? `M ${HEAD.x - 3} ${HEAD.y + 4.5} q 3 2.5 6 0`
      : straining
        ? `M ${HEAD.x - 3} ${HEAD.y + 5} l 1.5 -1 l 1.5 1 l 1.5 -1 l 1.5 1`
        : `M ${HEAD.x - 2.5} ${HEAD.y + 5} h 5`;

  return (
    <svg
      className={styles.lifter}
      // Holding a steep track, he breathes hard.
      style={
        { "--breath": `${lifting ? Math.max(0.5, 1.4 - gradePct * 0.1) : 1.6}s` } as CSSProperties
      }
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${DRAWING} ${DRAWING}`}
      aria-hidden="true"
    >
      {lifting && (
        <line className={styles.pole} x1={poleFoot.x} y1={poleFoot.y} x2={hold.x} y2={hold.y} />
      )}
      <g className={styles.arms}>
        <polyline points={points(SHOULDERS.left, elbows.left, hands.left)} />
        <polyline points={points(SHOULDERS.right, elbows.right, hands.right)} />
      </g>
      {/* Only his body breathes and shakes: his hands stay on the pole. */}
      <g className={cx(styles.body, straining && styles.shaking, fleeing && styles.still)}>
        <g className={styles.legs}>
          <polyline points={points(HIPS.left, { x: 22, y: 51 }, { x: 22, y: 60 })} />
          <polyline points={points(HIPS.right, { x: 42, y: 51 }, { x: 42, y: 60 })} />
        </g>
        <g className={styles.shoes}>
          <line x1={17} y1={61} x2={24} y2={61} />
          <line x1={40} y1={61} x2={47} y2={61} />
        </g>
        <line className={styles.shorts} x1={26} y1={42} x2={38} y2={42} />
        {/* Striped singlet, one strap over the shoulder. */}
        <rect className={styles.singlet} x={25} y={21} width={14} height={20} rx={4} />
        <line className={styles.stripe} x1={25.5} y1={31} x2={38.5} y2={31} />
        <line className={styles.strap} x1={28} y1={21} x2={36} y2={21} />
        <circle
          className={cx(styles.head, straining && styles.red)}
          cx={HEAD.x}
          cy={HEAD.y}
          r={7}
        />
        <path className={styles.hair} d={`M ${HEAD.x - 6} ${HEAD.y - 3} q 6 -7 12 0`} />
        <circle className={styles.eye} cx={HEAD.x - 2.6} cy={HEAD.y - 0.5} r={1} />
        <circle className={styles.eye} cx={HEAD.x + 2.6} cy={HEAD.y - 0.5} r={1} />
        {lifting && gradePct >= SWEAT_FROM && (
          <g className={styles.cheeks}>
            <circle cx={HEAD.x - 4.2} cy={HEAD.y + 2.5} r={1.4} />
            <circle cx={HEAD.x + 4.2} cy={HEAD.y + 2.5} r={1.4} />
          </g>
        )}
        {/* The curly moustache of a fairground strongman. */}
        <path
          className={styles.moustache}
          d={`M ${HEAD.x} ${HEAD.y + 2.6} q -2.5 -1.5 -4.5 0.5 q 1 -0.2 1.5 0.8 M ${HEAD.x} ${HEAD.y + 2.6} q 2.5 -1.5 4.5 0.5 q -1 -0.2 -1.5 0.8`}
        />
        <path className={styles.mouth} d={mouth} />
        {lifting && gradePct >= SWEAT_FROM && (
          <g className={styles.sweat}>
            <path d={`M ${HEAD.x + 9} ${HEAD.y - 6} q 1.6 3.2 0 4 q -1.6 -0.8 0 -4`} />
            <path d={`M ${HEAD.x - 9.5} ${HEAD.y - 3} q 1.6 3.2 0 4 q -1.6 -0.8 0 -4`} />
          </g>
        )}
      </g>
      <g className={styles.hands}>
        <circle cx={hands.left.x} cy={hands.left.y} r={2.6} />
        <circle cx={hands.right.x} cy={hands.right.y} r={2.6} />
      </g>
    </svg>
  );
}
