export interface SensorReading {
  /** Pedal turns per minute. */
  cadence: number;
  /** Watts. */
  power: number;
}

/** Anything that measures pedaling. The game polls it once per frame. */
export interface Sensor {
  readonly kind: "bluetooth" | "demo";
  read(nowMs: number): SensorReading;
  /** Called before each ride so a stale value does not leak into it. */
  reset(): void;
  disconnect(): void;
}

export const ZERO_READING: SensorReading = { cadence: 0, power: 0 };
