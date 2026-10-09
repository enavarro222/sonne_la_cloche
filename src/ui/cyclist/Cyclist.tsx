import { useId } from "react";
import { type Livery, ORIGINAL_LIVERY } from "../../core/livery";
import { cx } from "../cx";
import { GEAR_RATIO, kneePosition, pedalPosition, type Point } from "./geometry";
import styles from "./Cyclist.module.css";

// The cyclist, drawn by a young rider: a green bike, red jersey, yellow
// helmet, recoloured to each player's livery (core/livery.ts). In the original drawing's units (bike facing right, y down); the
// legs, wheels and chain follow the crank angle instead of a fixed loop. It
// rides on a paper-coloured track, so it shows as drawn.

const HIP: Point = { x: 1050, y: 705 };
/** The feet turn around this point… */
const FOOT_CENTRE: Point = { x: 1212, y: 1127 };
const FOOT_RADIUS = 95;
/** …and the cranks around this one. */
const CRANK_CENTRE: Point = { x: 1212, y: 1141 };
const THIGH = 340;
const SHIN = 325;
/** How far the chain runs per turn of the cranks. */
const CHAIN_PER_TURN = 340;

const TURN = 2 * Math.PI;

/** A band from `a` (width `wa`) to `b` (width `wb`), as a closed path. */
function band(a: Point, b: Point, wa: number, wb: number): string {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  const p = (q: Point, w: number, s: number) =>
    `${(q.x + (nx * w * s) / 2).toFixed(1)} ${(q.y + (ny * w * s) / 2).toFixed(1)}`;
  return `M${p(a, wa, 1)} L${p(b, wb, 1)} L${p(b, wb, -1)} L${p(a, wa, -1)} Z`;
}

const disc = (c: Point, r: number) =>
  `M${(c.x - r).toFixed(1)} ${c.y.toFixed(1)} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;

const along = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

interface LegColours {
  skin: string;
  sole: string;
  shoe: string;
}

/** One leg at a crank angle: crank, leg, the shorts on the thigh, the shoe. */
function Leg({ angle, colours }: { angle: number; colours: LegColours }) {
  const foot = pedalPosition(FOOT_CENTRE, FOOT_RADIUS, angle);
  const knee = kneePosition(HIP, foot, THIGH, SHIN);
  const leg = [
    band(HIP, knee, 88, 62),
    disc(knee, 31),
    band(knee, foot, 58, 42),
    disc(foot, 21),
    disc(HIP, 44),
  ].join(" ");
  const shorts = [band(HIP, along(HIP, knee, 0.33), 108, 94), disc(HIP, 54)].join(" ");
  // The light on the thigh, just below its middle.
  const len = Math.hypot(knee.x - HIP.x, knee.y - HIP.y) || 1;
  const shift = { x: (-(knee.y - HIP.y) / len) * 17, y: ((knee.x - HIP.x) / len) * 17 };
  const shineFrom = along(HIP, knee, 0.48);
  const shineTo = along(HIP, knee, 0.74);
  const crank = pedalPosition(CRANK_CENTRE, FOOT_RADIUS, angle);
  return (
    <g>
      <line
        x1={CRANK_CENTRE.x}
        y1={CRANK_CENTRE.y}
        x2={crank.x}
        y2={crank.y}
        stroke="#151515"
        strokeWidth={12}
      />
      <path d={leg} fill="#151515" stroke="#151515" strokeWidth={20} />
      <path d={leg} fill={colours.skin} />
      <path
        d={`M${shineFrom.x + shift.x} ${shineFrom.y + shift.y} L${shineTo.x + shift.x} ${shineTo.y + shift.y}`}
        stroke="#e9c3a2"
        strokeWidth={6}
        opacity={0.55}
      />
      <path d={shorts} fill="#141414" stroke="#151515" strokeWidth={16} />
      <g transform={`translate(${foot.x} ${foot.y})`}>
        <rect
          x={-28}
          y={14}
          width={74}
          height={24}
          rx={6}
          fill={colours.sole}
          stroke="#151515"
          strokeWidth={9}
        />
        <path
          d="M-20 -26 C5 -30 40 -22 64 -6 C78 4 72 16 54 16 L-22 16 C-38 14 -40 -20 -20 -26 Z"
          fill={colours.shoe}
          stroke="#151515"
          strokeWidth={10}
        />
        <path d="M8 -14 L14 8 M30 -12 L34 8" stroke="#a9c8f5" strokeWidth={4} opacity={0.6} />
      </g>
    </g>
  );
}

/**
 * A young rider on a bike; legs, wheels and chain turn with the crank angle
 * (radians). Jersey, helmet and frame wear the player's colours.
 */
export function Cyclist({
  crankAngle,
  wheelAngle = crankAngle * GEAR_RATIO,
  moving = false,
  livery = ORIGINAL_LIVERY,
}: {
  crankAngle: number;
  /** Radians. By default the wheels turn with the cranks, as when pedaling. */
  wheelAngle?: number;
  moving?: boolean;
  livery?: Livery;
}) {
  const id = useId();
  const clipRear = `${id}-rear`;
  const clipFront = `${id}-front`;
  const wheelTurn = (wheelAngle * 180) / Math.PI;
  const chainOffset = -((crankAngle / TURN) * CHAIN_PER_TURN);

  return (
    <svg className={styles.cyclist} viewBox="600 190 1290 1200" aria-hidden="true">
      <defs>
        <clipPath id={clipRear}>
          <path d="M330 760 C360 690 430 650 500 640 C580 632 660 670 690 740 C715 800 700 880 660 930 C620 975 560 995 500 990 C420 985 340 940 315 870 C300 830 310 790 330 760 Z" />
        </clipPath>
        <clipPath id={clipFront}>
          <path d="M305 1580 C340 1500 420 1455 510 1455 C610 1458 690 1510 715 1600 C735 1690 700 1790 620 1840 C550 1880 460 1880 390 1840 C320 1795 285 1700 295 1640 C298 1615 300 1595 305 1580 Z" />
        </clipPath>
      </defs>

      {/* Air rushing past, and dust behind: only when moving. */}
      <g className={cx(styles.speed, moving && styles.moving)}>
        <g className={styles.air}>
          <path d="M285 1336 L450 1361" />
          <path d="M300 1236 L610 1256" />
          <path d="M300 1216 L640 1236" />
          <path d="M345 1156 L585 1186" />
          <path d="M250 1290 L470 1300" />
          <path d="M330 1080 L520 1095" />
        </g>
        {/* Puffs of dust kicked up by the rear wheel, left behind. */}
        <g className={styles.dust}>
          <circle cx={690} cy={1320} r={55} />
          <circle cx={670} cy={1335} r={42} />
          <circle cx={700} cy={1310} r={65} />
          <circle cx={680} cy={1330} r={48} />
        </g>
      </g>

      <g strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* The far leg, behind the bike. */}
        <Leg
          angle={crankAngle + Math.PI}
          colours={{ skin: "#6b3a1e", sole: "#151515", shoe: "#1d4296" }}
        />

        {/* The bike, drawn upright then turned a quarter turn, as on the paper. */}
        <g transform="translate(0,1661) rotate(-90)">
          <g stroke="#4b55d6" strokeWidth={3} opacity={0.65}>
            <ellipse cx={500} cy={810} rx={185} ry={165} />
            <ellipse cx={515} cy={1645} rx={205} ry={190} />
            <path d="M760 1060 L780 1340 M930 790 C1000 770 1060 780 1090 810" />
          </g>
          {/* Rear wheel. */}
          <path
            d="M330 760 C360 690 430 650 500 640 C580 632 660 670 690 740 C715 800 700 880 660 930 C620 975 560 995 500 990 C420 985 340 940 315 870 C300 830 310 790 330 760 Z"
            stroke="#151515"
            strokeWidth={10}
          />
          <g clipPath={`url(#${clipRear})`}>
            <g transform={`rotate(${wheelTurn} 485 815)`}>
              <path
                d="M485 815 L500 650 M485 815 L560 660 M485 815 L640 720 M485 815 L680 820 M485 815 L650 900 M485 815 L590 975 M485 815 L520 990 M485 815 L440 980 M485 815 L375 930 M485 815 L320 850 M485 815 L330 760 M485 815 L405 680"
                stroke="#151515"
                strokeWidth={10}
              />
              <circle cx={485} cy={815} r={28} fill="#fdfcf8" stroke="#151515" strokeWidth={9} />
              <circle cx={485} cy={815} r={12} fill="#22335a" />
              <path
                d="M400 725 C410 705 470 700 485 715 C490 735 440 745 410 742 C398 740 396 732 400 725 Z"
                fill="#e58a14"
                stroke="#151515"
                strokeWidth={7}
              />
            </g>
          </g>
          {/* Front wheel. */}
          <path
            d="M305 1580 C340 1500 420 1455 510 1455 C610 1458 690 1510 715 1600 C735 1690 700 1790 620 1840 C550 1880 460 1880 390 1840 C320 1795 285 1700 295 1640 C298 1615 300 1595 305 1580 Z"
            stroke="#151515"
            strokeWidth={10}
          />
          <g clipPath={`url(#${clipFront})`}>
            <g transform={`rotate(${wheelTurn} 490 1640)`}>
              <path
                d="M490 1640 L470 1460 M490 1640 L560 1465 M490 1640 L650 1520 M490 1640 L710 1620 M490 1640 L690 1730 M490 1640 L640 1820 M490 1640 L550 1870 M490 1640 L440 1865 M490 1640 L360 1810 M490 1640 L300 1700 M490 1640 L310 1580 M490 1640 L380 1490"
                stroke="#151515"
                strokeWidth={10}
              />
              <path
                d="M440 1600 L485 1580 L535 1600 L545 1650 L520 1690 L470 1695 L438 1660 Z"
                fill={livery.frame}
                stroke="#151515"
                strokeWidth={9}
              />
              <circle cx={490} cy={1640} r={22} fill="#22335a" />
              <path
                d="M525 1525 C540 1505 575 1510 580 1530 C578 1555 545 1560 530 1550 C522 1543 520 1533 525 1525 Z"
                fill="#e58a14"
                stroke="#151515"
                strokeWidth={7}
              />
            </g>
          </g>
          {/* Green frame: a black outline, then the green. */}
          <g stroke="#151515" strokeWidth={34}>
            <path d="M485 815 L720 930" />
            <path d="M790 880 L540 1215" />
            <path d="M800 880 L830 1360" />
            <path d="M545 1225 L820 1380" />
            <path d="M840 1375 L495 1640" />
            <path d="M840 1380 L895 1445" />
            <path d="M795 880 L872 872" />
          </g>
          <g stroke={livery.frame}>
            <path d="M485 815 L720 930" strokeWidth={18} />
            <path d="M790 880 L540 1215" strokeWidth={18} />
            <path d="M800 880 L830 1360" strokeWidth={18} />
            <path d="M545 1225 L820 1380" strokeWidth={18} />
            <path d="M840 1375 L495 1640" strokeWidth={20} />
            <path d="M840 1380 L895 1445" strokeWidth={16} />
            <path d="M795 880 L872 872" strokeWidth={16} />
          </g>
          <path d="M790 1395 L860 1420" stroke="#3d5aa8" strokeWidth={14} opacity={0.6} />
          {/* Chainring. */}
          <circle cx={520} cy={1212} r={45} fill={livery.frame} stroke="#151515" strokeWidth={9} />
          <circle cx={520} cy={1212} r={22} fill="#5fb8d8" stroke="#151515" strokeWidth={5} />
        </g>

        {/* Saddle. */}
        <path
          d="M790 776 C788 754 836 748 880 754 L962 766 C978 770 978 788 962 791 L884 798 C840 806 792 800 790 776 Z"
          fill={livery.frame}
          stroke="#151515"
          strokeWidth={9}
        />
        <path
          d="M808 770 C830 762 860 762 890 766"
          stroke={livery.frameLight}
          strokeWidth={5}
          opacity={0.7}
        />

        {/* Sprocket and chain, running with the cranks. */}
        <circle cx={815} cy={1176} r={26} fill="#9a9a9a" stroke="#151515" strokeWidth={7} />
        <circle cx={815} cy={1176} r={9} fill="#22335a" />
        <path
          d="M810.6 1146.3 L1204.0 1087.6 A54 54 0 1 1 1213.5 1195.0 L815.8 1206.0 A30 30 0 0 1 810.6 1146.3 Z"
          stroke="#151515"
          strokeWidth={13}
          strokeLinecap="butt"
        />
        <path
          d="M810.6 1146.3 L1204.0 1087.6 A54 54 0 1 1 1213.5 1195.0 L815.8 1206.0 A30 30 0 0 1 810.6 1146.3 Z"
          stroke="#8c8c8c"
          strokeWidth={5}
          strokeDasharray="11 7"
          strokeDashoffset={chainOffset}
          strokeLinecap="butt"
        />

        {/* The near leg, in front of the bike. */}
        <Leg angle={crankAngle} colours={{ skin: "#8b4a26", sole: "#e58a14", shoe: "#2a62d0" }} />

        {/* Shorts, red jersey and arm, drawn upright too. */}
        <g transform="translate(0,1661) rotate(-90)">
          <path
            d="M895 845 C930 805 1010 790 1080 805 C1110 830 1100 900 1080 960 C1060 1020 1030 1080 995 1140 C960 1145 920 1130 900 1100 C885 1030 882 920 895 845 Z"
            fill="#141414"
            stroke="#151515"
            strokeWidth={9}
          />
          <path
            d="M1080 815 C1130 800 1180 825 1210 880 C1250 950 1300 1060 1310 1130 C1300 1170 1260 1200 1225 1180 C1180 1165 1120 1175 1065 1110 C1040 1080 1045 1030 1070 980 C1090 930 1100 870 1080 815 Z"
            fill={livery.jersey}
            stroke="#151515"
            strokeWidth={9}
          />
          <path
            d="M1110 860 L1170 1080 M1150 870 L1220 1100 M1190 900 L1260 1110"
            stroke={livery.jerseyLight}
            strokeWidth={4}
            opacity={0.55}
          />
          <path
            d="M1240 1175 C1150 1185 1060 1230 1000 1290 C950 1340 920 1400 900 1440"
            stroke="#151515"
            strokeWidth={66}
          />
          <path
            d="M1240 1175 C1150 1185 1060 1230 1000 1290 C950 1340 920 1400 900 1440"
            stroke="#8b4a26"
            strokeWidth={48}
          />
          <path
            d="M855 1430 C870 1410 920 1415 935 1440 C935 1470 900 1480 880 1475 C860 1468 852 1450 855 1430 Z"
            fill="#8b4a26"
            stroke="#151515"
            strokeWidth={8}
          />
          <path d="M850 1420 L860 1475" stroke="#151515" strokeWidth={10} />
        </g>

        {/* Short thick neck. */}
        <path d="M1150 405 C1190 395 1225 392 1262 398" stroke="#151515" strokeWidth={88} />
        <path d="M1150 405 C1190 395 1225 392 1262 398" stroke="#8b4a26" strokeWidth={66} />
        <path
          d="M1160 385 L1172 420 M1200 380 L1206 415"
          stroke="#c98b5e"
          strokeWidth={5}
          opacity={0.6}
        />

        {/* Head: brown face, yellow helmet, blue wraparound glasses, pointy nose. */}
        <g transform="translate(1106 112) scale(0.95)" stroke="#151515">
          <path
            d="M140 250 C155 236 185 234 205 244 L292 246 C302 268 292 292 290 312 C304 326 318 344 306 352 C292 360 276 352 264 346 C248 368 210 380 184 368 C162 358 148 340 138 318 C130 296 130 266 140 250 Z"
            fill="#8b4a26"
            strokeWidth={15}
          />
          <path
            d="M180 300 L186 345 M215 300 L220 345"
            stroke="#c98b5e"
            strokeWidth={5}
            opacity={0.6}
          />
          <path d="M150 264 L214 266" strokeWidth={9} />
          <path
            d="M196 262 C228 252 276 250 302 258 C312 262 310 274 302 282 C288 296 262 300 240 294 C222 288 206 278 196 262 Z"
            fill="#7fc4ea"
            strokeWidth={10}
          />
          <path
            d="M228 266 C250 262 274 262 292 266"
            stroke="#e8f6ff"
            strokeWidth={6}
            opacity={0.9}
          />
          <path
            d="M86 140 C92 108 148 96 180 98 C214 98 244 116 274 128 C308 142 334 180 334 218 C334 244 302 252 270 248 L200 246 C158 248 126 242 112 218 C98 192 82 166 86 140 Z"
            fill={livery.helmet}
            strokeWidth={16}
          />
          <path
            d="M110 148 C130 128 168 118 196 124 M118 206 C140 226 186 232 230 234 M262 140 C290 158 306 180 312 204"
            stroke={livery.helmetLight}
            strokeWidth={5}
            opacity={0.8}
          />
          <path d="M128 168 C160 146 205 140 240 150" strokeWidth={24} />
          <path d="M140 212 C185 198 240 196 292 202" strokeWidth={24} />
          <path d="M262 150 C288 160 306 178 314 196" strokeWidth={20} />
          <path
            d="M150 166 C175 154 200 151 222 155 M162 210 C200 203 240 202 276 205"
            stroke="#5b5a3a"
            strokeWidth={6}
          />
        </g>
      </g>
    </svg>
  );
}
