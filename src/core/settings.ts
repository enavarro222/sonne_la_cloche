/**
 * Pedal turns (any sensor), or the distance measured power takes a virtual
 * bike (needs a power meter: see handicap.ts).
 */
export const METRICS = ["distance", "cadence"] as const;
export type Metric = (typeof METRICS)[number];

export const DURATIONS_SEC = [5, 20, 30, 45] as const;
export type DurationSec = (typeof DURATIONS_SEC)[number];

export const ROUND_COUNTS = [1, 3, 4, 5] as const;
/** Express games to try things out, offered only in test mode (?dev in the URL). */
export const TEST_ONLY = { durationSec: 5, rounds: 1 } as const;
export type RoundCount = (typeof ROUND_COUNTS)[number];

/**
 * The road's slope, sent to trainers the game can control. "own": each
 * player on their own slope, the weakest on the flat (distance only).
 */
export const SLOPES = ["flat", "gentle", "hill", "wall", "own"] as const;
export type Slope = (typeof SLOPES)[number];

/** Grade of each slope, in percent; for "own", the weakest player's. */
export const SLOPE_PERCENT: Record<Slope, number> = {
  flat: 0,
  gentle: 2,
  hill: 5,
  wall: 10,
  own: 0,
};

/** Own slopes are worked out from power: they need the distance metric. */
export const slopeAllowed = (slope: Slope, metric: Metric): boolean =>
  slope !== "own" || metric === "distance";

export const FINALES = ["off", "on"] as const;
/** The strongman's last-seconds twist, see `finaleFor` in ride.ts. */
export type Finale = (typeof FINALES)[number];

export interface Settings {
  metric: Metric;
  durationSec: DurationSec;
  rounds: RoundCount;
  slope: Slope;
  finale: Finale;
}

// Each on their own slope by default: fair between an 8-year-old's 50 W and
// an adult's 300 W, and it makes the most of a smart trainer. Without a power
// meter the game falls back to pedal turns (see `forSensor`).
export const DEFAULT_SETTINGS: Settings = {
  metric: "distance",
  durationSec: 30,
  rounds: 4,
  slope: "own",
  finale: "on",
};

/** Where the slope goes when the metric no longer allows it. */
const FALLBACK_SLOPE: Slope = "gentle";

/** Keeps the slope consistent with the metric. */
export const consistent = (settings: Settings): Settings =>
  slopeAllowed(settings.slope, settings.metric) ? settings : { ...settings, slope: FALLBACK_SLOPE };

/** The settings a game actually uses: pedal turns when the bike measures no power. */
export const forSensor = (settings: Settings, measuresPower: boolean): Settings =>
  measuresPower ? settings : consistent({ ...settings, metric: "cadence" });

const pick = <T>(allowed: readonly T[], value: unknown, fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/** Reads settings from untrusted data (e.g. storage), field by field. */
export function parseSettings(value: unknown): Settings {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return consistent({
    metric: pick(METRICS, raw.metric, DEFAULT_SETTINGS.metric),
    durationSec: pick(DURATIONS_SEC, raw.durationSec, DEFAULT_SETTINGS.durationSec),
    rounds: pick(ROUND_COUNTS, raw.rounds, DEFAULT_SETTINGS.rounds),
    slope: pick(SLOPES, raw.slope, DEFAULT_SETTINGS.slope),
    finale: pick(FINALES, raw.finale, DEFAULT_SETTINGS.finale),
  });
}
