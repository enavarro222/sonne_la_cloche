import { useId } from "react";
import { Bell } from "../ui/Bell";
import { Cyclist } from "../ui/cyclist/Cyclist";
import styles from "./Preview.module.css";

const TEXTS = {
  fr: {
    title: "Sonne la cloche !",
    tagline: "Le jeu de sprint sur home trainer, chacun son tour devant un seul écran.",
    tags: "Gratuit · Dans le navigateur · Dès 8 ans",
  },
  en: {
    title: "Ring the Bell!",
    tagline: "The home-trainer sprint game: everyone takes turns on one screen.",
    tags: "Free · In the browser · Ages 8 and up",
  },
};

/** The link preview card, 1200×630: the cyclist on his sheet of paper, racing for the bell. */
export function Card({ lang }: { lang: keyof typeof TEXTS }) {
  const t = TEXTS[lang];
  return (
    <main className={styles.card}>
      <div className={styles.sheet}>
        <div className={styles.rider}>
          <Cyclist crankAngle={0.7} />
        </div>
        <div className={styles.bell}>
          <Bell />
        </div>
      </div>
      <div>
        <h1 className={styles.title}>{t.title}</h1>
        <p className={styles.tagline}>{t.tagline}</p>
        <p className={styles.tags}>{t.tags}</p>
      </div>
    </main>
  );
}

/** Icon size: the drawing's units. */
const SIZE = 512;

/**
 * The app icon: the bell on a square of indigo construction paper. Plain SVG
 * (no CSS): its markup is saved as is as the favicon. Maskable, it fills the
 * square and keeps the bell in the middle 80% that every mask shows.
 */
export function Icon({ maskable = false }: { maskable?: boolean }) {
  const id = useId();
  const grain = `${id}-grain`;
  const tint = `${id}-tint`;
  const corners = `${id}-corners`;
  const bell = maskable ? 330 : 400;
  // The bell's drawing is 780 wide for 950 high.
  const width = (bell * 780) / 950;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={SIZE}
      height={SIZE}
      data-icon
    >
      <defs>
        <radialGradient id={tint} cx="50%" cy="0%" r="110%">
          <stop offset="0" stopColor="#2c217e" />
          <stop offset="0.7" stopColor="#1b1464" />
        </radialGradient>
        {/* The paper's grain, as on the game's background. */}
        <filter id={grain}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={3} />
          <feColorMatrix values="0 0 0 0 1 0 0 0 0 0.95 0 0 0 0 0.85 0.35 0 0 0 -0.1" />
        </filter>
        <clipPath id={corners}>
          <rect width={SIZE} height={SIZE} rx={maskable ? 0 : 112} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${corners})`}>
        <rect width={SIZE} height={SIZE} fill={`url(#${tint})`} />
        <rect width={SIZE} height={SIZE} filter={`url(#${grain})`} />
      </g>
      {/* The bell, its rim level, swinging a little. It draws itself as wide as its box. */}
      <g transform={`rotate(8 ${SIZE / 2} ${SIZE / 2})`}>
        <svg
          x={(SIZE - width) / 2 + 12}
          y={(SIZE - bell) / 2}
          width={width}
          height={bell}
          overflow="visible"
        >
          <Bell />
        </svg>
      </g>
    </svg>
  );
}
