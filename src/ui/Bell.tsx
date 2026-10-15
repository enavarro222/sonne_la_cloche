import { useId } from "react";

// The bell, drawn by hand like the cyclist: a pale yellow hand bell coloured
// in with a crayon, its handle on top, a pencil outline that trembles a little
// and two small arcs of ringing. Laid on the paper of the track. Shown small
// (a few dozen pixels), so its lines are drawn thicker than on paper.

/** The outline of the bell's body, filled and then drawn over. */
const BODY =
  "M770 750 C700 752 620 790 575 860 C535 925 522 1010 520 1100 C519 1170 522 1220 525 1248 L470 1262 L420 1275 C425 1300 432 1335 436 1366 C520 1362 600 1356 700 1352 C800 1348 900 1342 1000 1336 C1030 1333 1050 1326 1057 1318 C1056 1285 1055 1250 1054 1226 C1010 1224 975 1215 950 1195 C932 1170 925 1120 922 1050 C920 970 915 880 895 820 C875 770 830 748 770 750 Z";

export function Bell() {
  const id = useId();
  const pencil = `${id}-pencil`;
  const crayon = `${id}-crayon`;
  const clip = `${id}-clip`;

  return (
    <svg viewBox="400 440 780 950" width="100%" overflow="visible" aria-hidden="true">
      <defs>
        {/* A slight tremble, like a pencil line. */}
        <filter id={pencil} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.04"
            numOctaves={2}
            seed={3}
            result="n"
          />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={4} />
        </filter>
        {/* The grain of a coloured crayon. */}
        <filter id={crayon} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.015 0.25"
            numOctaves={2}
            seed={7}
            result="t"
          />
          <feColorMatrix
            in="t"
            type="matrix"
            values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1.6 1.15"
            result="holes"
          />
          <feComposite in="SourceGraphic" in2="holes" operator="in" />
        </filter>
        <clipPath id={clip}>
          <path d={BODY} />
        </clipPath>
      </defs>

      {/* Yellow crayon, lighter strokes down the middle. */}
      <g clipPath={`url(#${clip})`}>
        <rect x={410} y={740} width={660} height={640} fill="#f3ef9a" />
        <g filter={`url(#${crayon})`}>
          <rect x={410} y={740} width={660} height={640} fill="#ece64f" />
        </g>
        <g
          stroke="#f7f4c8"
          strokeWidth={10}
          strokeLinecap="round"
          opacity={0.8}
          filter={`url(#${pencil})`}
        >
          <path d="M690 930 L695 1180" />
          <path d="M730 900 L735 1170" />
          <path d="M770 920 L772 1200" />
          <path d="M810 960 L815 1190" />
          <path d="M650 980 L652 1160" />
        </g>
      </g>

      {/* The handle on top. */}
      <g filter={`url(#${pencil})`}>
        <path
          d="M714 790 L716 520 L722 470 L760 466 L766 448 L772 470 L776 545 L780 560 L781 760 Z"
          fill="#c9c5c0"
          opacity={0.9}
        />
        <g fill="none" stroke="#6d6a67" strokeWidth={12} strokeLinecap="round">
          <path d="M714 795 L716 520 L722 472 L760 468" />
          <path d="M760 468 L766 446 L773 470 L776 545" />
          <path d="M776 545 L784 538" />
          <path d="M778 545 L781 760" />
          <path d="M740 520 L742 760" strokeWidth={6} opacity={0.5} />
          <path d="M755 500 L757 750" strokeWidth={6} opacity={0.4} />
        </g>
      </g>

      {/* The pencil outline. */}
      <g
        filter={`url(#${pencil})`}
        fill="none"
        stroke="#55524f"
        strokeWidth={20}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d={BODY} />
        <path d="M430 1325 C520 1322 600 1318 640 1316" strokeWidth={10} opacity={0.6} />
      </g>

      {/* Small arcs of ringing. */}
      <g
        filter={`url(#${pencil})`}
        fill="none"
        stroke="#8a8784"
        strokeWidth={12}
        strokeLinecap="round"
      >
        <path d="M428 1178 C440 1160 460 1150 478 1152" />
        <path d="M1158 1060 C1165 1110 1150 1150 1108 1172" />
      </g>
    </svg>
  );
}
