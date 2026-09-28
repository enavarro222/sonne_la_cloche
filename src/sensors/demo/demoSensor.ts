import type { Sensor, SensorReading } from "../types";

export const DEMO_CADENCE = 95;
/** Rise/fall time constant: about 1 s to reach full speed. */
export const DEMO_TIME_CONSTANT_SEC = 0.2;
const WATTS_PER_RPM = 1.6;

/** Simulated pedaling: full speed while "pressed", slows down when released. */
export class DemoSensor implements Sensor {
  readonly kind = "demo";
  private pressed = false;
  private cadence = 0;
  private lastReadMs: number | null = null;

  press(): void {
    this.pressed = true;
  }

  release(): void {
    this.pressed = false;
  }

  read(nowMs: number): SensorReading {
    const dtSec = this.lastReadMs === null ? 0 : Math.max(0, nowMs - this.lastReadMs) / 1000;
    this.lastReadMs = nowMs;
    const target = this.pressed ? DEMO_CADENCE : 0;
    this.cadence = target + (this.cadence - target) * Math.exp(-dtSec / DEMO_TIME_CONSTANT_SEC);
    return { cadence: this.cadence, power: this.cadence * WATTS_PER_RPM };
  }

  /** Forgets the speed but not whether the button is held right now. */
  reset(): void {
    this.cadence = 0;
    this.lastReadMs = null;
  }

  disconnect(): void {
    this.release();
    this.reset();
  }
}
