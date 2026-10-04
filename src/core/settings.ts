export const METRICS = ["cadence", "power"] as const;
export type Metric = (typeof METRICS)[number];

export const DURATIONS_SEC = [5, 20, 30, 45] as const;
export type DurationSec = (typeof DURATIONS_SEC)[number];

export const ROUND_COUNTS = [1, 3, 4, 5] as const;
/** Express games to try things out, offered only in test mode (?dev in the URL). */
export const TEST_ONLY = { durationSec: 5, rounds: 1 } as const;
export type RoundCount = (typeof ROUND_COUNTS)[number];

export const SLOPES = ["flat", "gentle", "hill", "wall"] as const;
/** The road's slope, sent to trainers the game can control. */
export type Slope = (typeof SLOPES)[number];

/** Grade of each slope, in percent. */
export const SLOPE_PERCENT: Record<Slope, number> = { flat: 0, gentle: 2, hill: 5, wall: 10 };

/** The resistance setting the slope replaced, as saved by earlier versions. */
const SLOPE_OF_RESISTANCE: Record<string, Slope> = {
  light: "flat",
  normal: "gentle",
  hard: "hill",
  megaHard: "wall",
};

export interface Settings {
  metric: Metric;
  durationSec: DurationSec;
  rounds: RoundCount;
  slope: Slope;
}

// Cadence by default: an 8-year-old produces 40-60 W, so ranking by watts
// would just rank children by size.
export const DEFAULT_SETTINGS: Settings = {
  metric: "cadence",
  durationSec: 30,
  rounds: 4,
  slope: "gentle",
};

const pick = <T>(allowed: readonly T[], value: unknown, fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/** Reads settings from untrusted data (e.g. storage), field by field. */
export function parseSettings(value: unknown): Settings {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    metric: pick(METRICS, raw.metric, DEFAULT_SETTINGS.metric),
    durationSec: pick(DURATIONS_SEC, raw.durationSec, DEFAULT_SETTINGS.durationSec),
    rounds: pick(ROUND_COUNTS, raw.rounds, DEFAULT_SETTINGS.rounds),
    slope: pick(
      SLOPES,
      raw.slope ??
        (typeof raw.resistance === "string" ? SLOPE_OF_RESISTANCE[raw.resistance] : null),
      DEFAULT_SETTINGS.slope,
    ),
  };
}
