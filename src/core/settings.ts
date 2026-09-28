export const METRICS = ["cadence", "power"] as const;
export type Metric = (typeof METRICS)[number];

export const DURATIONS_SEC = [20, 30, 45] as const;
export type DurationSec = (typeof DURATIONS_SEC)[number];

export const ROUND_COUNTS = [3, 4, 5] as const;
export type RoundCount = (typeof ROUND_COUNTS)[number];

export interface Settings {
  metric: Metric;
  durationSec: DurationSec;
  rounds: RoundCount;
}

// Cadence by default: an 8-year-old produces 40-60 W, so ranking by watts
// would just rank children by size.
export const DEFAULT_SETTINGS: Settings = { metric: "cadence", durationSec: 30, rounds: 4 };

const pick = <T>(allowed: readonly T[], value: unknown, fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/** Reads settings from untrusted data (e.g. storage), field by field. */
export function parseSettings(value: unknown): Settings {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    metric: pick(METRICS, raw.metric, DEFAULT_SETTINGS.metric),
    durationSec: pick(DURATIONS_SEC, raw.durationSec, DEFAULT_SETTINGS.durationSec),
    rounds: pick(ROUND_COUNTS, raw.rounds, DEFAULT_SETTINGS.rounds),
  };
}
