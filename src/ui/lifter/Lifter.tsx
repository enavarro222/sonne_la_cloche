import { type CSSProperties, useId } from "react";
import type { Point } from "../cyclist/geometry";
import { cx } from "../cx";
import styles from "./Lifter.module.css";

// The pole bearer, drawn by a young rider: red cap, big round eyes, hatched
// top, orange legs. He stands at the bottom of the screen and holds up the
// end of the track with a pole: it turns around his lower fist to reach the
// track and grows as long as needed; his raised fist slides along it. In the
// original drawing's units, with its crayon grain and wobbly lines.

/** His box (feet at the bottom, centred), in the drawing's units… */
const VIEW = { x: 415, y: 264, size: 1260 };
/** …shown this big (px). */
export const SIZE = 110;
const SCALE = SIZE / VIEW.size;

/** From this grade (%) he sweats… */
const SWEAT_FROM = 5;
/** …and from this one he shakes, red in the face. */
const SHAKE_FROM = 8;

/** The pole's foot, by his belt; his lower fist holds it just above. */
const POLE_FOOT: Point = { x: 886, y: 700 };
const LOWER_FIST_ALONG = 38;
/** His raised fist, this far up the pole from its foot. */
const UPPER_FIST_ALONG = 320;
const POLE_WIDTH = { foot: 34, tip: 6 };
/** Where the raised arm leaves his shoulder, and the short arm his side. */
const SHOULDER: Point = { x: 995, y: 572 };
const SIDE: Point = { x: 940, y: 675 };
const OTHER_SHOULDER: Point = { x: 1150, y: 600 };

/** The fists, as drawn, centred on (0, 0). */
const FIST =
  "M-46 25 C-54 5, -52 -17, -40 -29 q 4 -18 22 -14 q 8 -16 25 -8 q 14 -12 26 4 q 16 4 14 24 C50 5, 38 31, 14 39 C-10 45, -36 39, -46 25 Z";
const KNUCKLES = "M-18 -43 l 2 18 M7 -51 l 1 20 M32 -47 l -1 18";
const THUMB = "M-38 5 q 26 -12 54 -2 q 10 4 5 14";

const SKIN = "#c8744e";

/** A band from `a` (width `wa`) to `b` (width `wb`). */
function band(a: Point, b: Point, wa: number, wb: number): string {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  const p = (q: Point, w: number, s: number) =>
    `${(q.x + (nx * w * s) / 2).toFixed(1)} ${(q.y + (ny * w * s) / 2).toFixed(1)}`;
  return `M${p(a, wa, 1)} L${p(b, wb, 1)} L${p(b, wb, -1)} L${p(a, wa, -1)} Z`;
}

function Fist({ at, crayon }: { at: Point; crayon: string }) {
  return (
    <g transform={`translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})`}>
      <path d={FIST} fill={SKIN} filter={crayon} />
      <path d={KNUCKLES} fill="none" strokeWidth={3} />
      <path d={THUMB} fill="none" strokeWidth={3.5} />
    </g>
  );
}

interface Props {
  /** Where his pole holds the track, px from the top left of his box (y < 0: above him). */
  hold: { x: number; y: number };
  gradePct: number;
  /** He sees the finale coming: eyes up at the falling seconds, he panics. */
  alarmed?: boolean;
  /** The time is falling on his head: he lets go and runs, fists up. */
  fleeing?: boolean;
}

export function Lifter({ hold: holdPx, gradePct, alarmed = false, fleeing = false }: Props) {
  const id = useId();
  const ids = {
    crayon: `${id}-crayon`,
    wobble: `${id}-wobble`,
    hatch: `${id}-hatch`,
    pole: `${id}-pole`,
  };
  const crayon = `url(#${ids.crayon})`;
  const straining = !fleeing && gradePct >= SHAKE_FROM;
  const scared = alarmed || fleeing;
  const sweating = scared || gradePct >= SWEAT_FROM;

  // The pole, from its foot to the track.
  const hold = { x: VIEW.x + holdPx.x / SCALE, y: VIEW.y + holdPx.y / SCALE };
  const length = Math.max(
    UPPER_FIST_ALONG + 40,
    Math.hypot(hold.x - POLE_FOOT.x, hold.y - POLE_FOOT.y),
  );
  const angle = Math.atan2(hold.y - POLE_FOOT.y, hold.x - POLE_FOOT.x);
  const along = (d: number): Point => ({
    x: POLE_FOOT.x + Math.cos(angle) * d,
    y: POLE_FOOT.y + Math.sin(angle) * d,
  });
  // On the pole, or up over his head when he runs away.
  const fists = fleeing
    ? { upper: { x: 1030, y: 230 }, lower: { x: 1165, y: 240 } }
    : { upper: along(UPPER_FIST_ALONG), lower: along(LOWER_FIST_ALONG) };
  const lowerArmFrom = fleeing ? OTHER_SHOULDER : SIDE;
  // Scared, he looks up at the seconds coming down.
  const pupilY = scared ? -9 : 0;
  const mouth = scared
    ? "M1086 458 a 11 11 0 1 0 22 0 a 11 11 0 1 0 -22 0"
    : straining
      ? "M1078 454 l 9 -7 l 9 7 l 9 -7 l 9 7"
      : gradePct >= SWEAT_FROM
        ? "M1080 455 h 34"
        : "M1080 452 q 18 10 34 -2";

  return (
    <svg
      className={styles.lifter}
      // Holding a steep track, he breathes hard.
      style={{ "--breath": `${Math.max(0.5, 1.4 - gradePct * 0.1)}s` } as CSSProperties}
      width={SIZE}
      height={SIZE}
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.size} ${VIEW.size}`}
      aria-hidden="true"
    >
      <defs>
        {/* Crayon grain in the colours… */}
        <filter id={ids.crayon} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="2"
            seed="4"
            result="n"
          />
          <feColorMatrix
            in="n"
            type="matrix"
            values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -0.9 1.4"
            result="grain"
          />
          <feComposite in="SourceGraphic" in2="grain" operator="in" />
        </filter>
        {/* …and a hand's wobble in the lines. */}
        <filter id={ids.wobble}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.04"
            numOctaves="2"
            seed="7"
            result="w"
          />
          <feDisplacementMap in="SourceGraphic" in2="w" scale="5" />
        </filter>
        <pattern
          id={ids.hatch}
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-35)"
        >
          <rect width="14" height="14" fill="#f7c9a0" />
          <line x1="0" y1="0" x2="0" y2="14" stroke="#ef9a55" strokeWidth="7" />
        </pattern>
        {/* Light on one side of the pole, dark on the other. */}
        <linearGradient id={ids.pole} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2e86a" />
          <stop offset="0.4" stopColor="#d6cf5a" />
          <stop offset="0.75" stopColor="#9a9650" />
          <stop offset="1" stopColor="#6e6a40" />
        </linearGradient>
      </defs>

      <g
        filter={`url(#${ids.wobble})`}
        stroke="#45403a"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* The pole: thick at his fists, thin at the track. Dropped when he runs. */}
        {!fleeing && (
          <g
            transform={`translate(${POLE_FOOT.x} ${POLE_FOOT.y}) rotate(${(angle * 180) / Math.PI})`}
          >
            <path
              d={`M0 ${-POLE_WIDTH.foot / 2} L${length} ${-POLE_WIDTH.tip / 2} L${length} ${POLE_WIDTH.tip / 2} L0 ${POLE_WIDTH.foot / 2} Z`}
              fill={`url(#${ids.pole})`}
              stroke="none"
              filter={crayon}
            />
            <path
              d={`M0 ${-POLE_WIDTH.foot / 2} L${length} ${-POLE_WIDTH.tip / 2}`}
              fill="none"
              stroke="#c7bd3a"
              strokeWidth={5}
              opacity={0.7}
            />
          </g>
        )}

        {/* His body breathes, shakes or runs; his fists stay on the pole. */}
        <g
          className={cx(
            styles.body,
            straining && styles.shaking,
            alarmed && styles.panicking,
            fleeing && styles.running,
          )}
        >
          {/* Legs. */}
          <path d="M918 900 L 1002 900 L 998 1462 L 922 1468 Z" fill="#ff9a2a" filter={crayon} />
          <path
            d="M1088 900 L 1172 900 L 1176 1290 L 1150 1350 L 1166 1462 L 1092 1468 Z"
            fill="#ff9a2a"
            filter={crayon}
          />
          {/* Yellow-green shoes with rounds. */}
          <path
            d="M1000 1460 L 790 1458 Q 778 1490 792 1522 L 1004 1520 Z"
            fill="#e2e350"
            filter={crayon}
          />
          <circle cx={840} cy={1492} r={16} fill="none" stroke="#3a3a30" strokeWidth={5} />
          <path
            d="M1090 1462 L 1300 1460 Q 1314 1492 1300 1524 L 1092 1522 Z"
            fill="#e2e350"
            filter={crayon}
          />
          <circle cx={1240} cy={1494} r={16} fill="none" stroke="#3a3a30" strokeWidth={5} />
          {/* Hatched top with a flared hem, brown belt. */}
          <path
            d="M955 540 C 1010 520, 1080 520, 1150 545 L 1162 860 L 1175 905 L 915 905 L 930 860 Z"
            fill={`url(#${ids.hatch})`}
            filter={crayon}
          />
          <path d="M930 860 L 1162 860" fill="none" strokeWidth={3} />
          <path d="M928 655 L 1160 650 L 1162 695 L 926 700 Z" fill="#b5523a" filter={crayon} />
          {/* Neck and head. */}
          <path d="M1070 482 L 1108 482 L 1112 548 L 1068 548 Z" fill="#d07a52" filter={crayon} />
          <circle
            cx={1095}
            cy={398}
            r={86}
            fill={straining ? "#e0603f" : "#cf8058"}
            filter={crayon}
          />
          {/* Red cap with its peak. */}
          <path
            d="M1015 350 C 1025 300, 1080 280, 1130 290 C 1170 298, 1185 325, 1180 350 Z"
            fill="#f04a48"
            filter={crayon}
          />
          <path
            d="M1015 350 L 960 352 Q 955 336 975 332 L 1020 334"
            fill="#c42f30"
            filter={crayon}
          />
          <path d="M1015 350 L 1180 350" fill="none" strokeWidth={5} />
          <path
            d="M1060 292 l -6 -22 M1078 288 l -2 -24 M1096 288 l 2 -22"
            fill="none"
            strokeWidth={3}
          />
          {/* Big round eyes: looking up when something is coming. */}
          <circle cx={1065} cy={405} r={26} fill="#f2ebe1" />
          <circle cx={1065} cy={405 + pupilY} r={12} fill="none" strokeWidth={4} />
          <circle cx={1065} cy={405 + pupilY} r={3} fill="#45403a" />
          <circle cx={1125} cy={395} r={26} fill="#f2ebe1" />
          <circle cx={1125} cy={395 + pupilY} r={12} fill="none" strokeWidth={4} />
          <circle cx={1125} cy={395 + pupilY} r={3} fill="#45403a" />
          <path d={mouth} fill="none" strokeWidth={4} />
          {sweating && (
            <g className={cx(styles.sweat, scared && styles.dripping)} stroke="none">
              <path d="M1196 330 q 12 26 0 34 q -12 -8 0 -34" />
              <path d="M992 360 q 12 26 0 34 q -12 -8 0 -34" />
            </g>
          )}
        </g>

        {/* Arms: the raised one from his shoulder, the short one from his side.
            Running away, both wave over his head and bob with his strides. */}
        <g className={cx(fleeing && styles.running)}>
          <g
            className={cx(fleeing && styles.waving)}
            style={{ transformOrigin: `${SHOULDER.x}px ${SHOULDER.y}px` }}
          >
            <path d={band(SHOULDER, fists.upper, 34, 28)} fill={SKIN} filter={crayon} />
            <Fist at={fists.upper} crayon={crayon} />
          </g>
          <g
            className={cx(fleeing && styles.waving, fleeing && styles.otherArm)}
            style={{ transformOrigin: `${lowerArmFrom.x}px ${lowerArmFrom.y}px` }}
          >
            <path d={band(lowerArmFrom, fists.lower, 30, 28)} fill={SKIN} filter={crayon} />
            <Fist at={fists.lower} crayon={crayon} />
          </g>
        </g>
      </g>

      {/* A big "!" by his head: something is coming. */}
      {alarmed && (
        <g className={styles.alarm}>
          <line x1={1250} y1={200} x2={1238} y2={330} />
          <circle cx={1234} cy={385} r={18} />
        </g>
      )}
    </svg>
  );
}
