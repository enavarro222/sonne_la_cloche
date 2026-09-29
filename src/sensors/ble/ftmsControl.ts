// Controlling an FTMS trainer's resistance through its Control Point
// (0x2AD9). Byte encoding and decoding are pure functions; FtmsControl does
// the request/response dance over a GATT characteristic.

import type { Resistance } from "../../core/settings";

export const OP_REQUEST_CONTROL = 0x00;
export const OP_SET_RESISTANCE = 0x04;
export const OP_START = 0x07;
const RESPONSE_CODE = 0x80;

export const RESULT_SUCCESS = 0x01;
export const RESULT_CONTROL_NOT_PERMITTED = 0x05;

/** Target setting feature bit: resistance level can be set. */
const RESISTANCE_TARGET_SUPPORTED = 1 << 2;

export interface ResistanceRange {
  /** In the trainer's own units (0.1 resolution in FTMS). */
  min: number;
  max: number;
  increment: number;
}

/** Elite Suito's range, used when a trainer does not publish its own. */
export const DEFAULT_RANGE: ResistanceRange = { min: 0, max: 200, increment: 1 };

/**
 * Share of the trainer's range for each setting. Calibrated on an Elite
 * Suito with an 8-year-old: 0 → spins above 90 rpm, 10 → about 85 rpm,
 * 25 → about 65 rpm. 50 ("mega hard") stopped an adult within seconds:
 * a challenge for grown-ups.
 */
export const RESISTANCE_SHARE: Record<Resistance, number> = {
  light: 0,
  normal: 0.05,
  hard: 0.125,
  megaHard: 0.25,
};

/** Fitness Machine Feature (0x2ACC): can the resistance be set? */
export function supportsResistance(feature: DataView): boolean {
  if (feature.byteLength < 8) return false;
  return (feature.getUint32(4, true) & RESISTANCE_TARGET_SUPPORTED) !== 0;
}

/** Supported Resistance Level Range (0x2AD6). */
export function parseResistanceRange(view: DataView): ResistanceRange | null {
  if (view.byteLength < 6) return null;
  const range = {
    min: view.getInt16(0, true),
    max: view.getInt16(2, true),
    increment: view.getUint16(4, true),
  };
  return range.max > range.min && range.increment > 0 ? range : null;
}

export function resistanceLevel(resistance: Resistance, range: ResistanceRange): number {
  const raw = range.min + (range.max - range.min) * RESISTANCE_SHARE[resistance];
  const stepped = range.min + Math.round((raw - range.min) / range.increment) * range.increment;
  // The FTMS 1.0 parameter is a UINT8.
  return Math.min(255, Math.max(0, Math.min(range.max, stepped)));
}

export const encodeSetResistance = (level: number): Uint8Array<ArrayBuffer> =>
  new Uint8Array([OP_SET_RESISTANCE, level]);

/** Control Point indication: [0x80, request op code, result code]. */
export function parseControlResponse(view: DataView): { opCode: number; result: number } | null {
  if (view.byteLength < 3 || view.getUint8(0) !== RESPONSE_CODE) return null;
  return { opCode: view.getUint8(1), result: view.getUint8(2) };
}

/** What FtmsControl needs from a GATT characteristic; lets tests use a fake. */
export interface ControlPoint {
  writeValueWithResponse(value: BufferSource): Promise<void>;
  addEventListener(type: "characteristicvaluechanged", listener: () => void): void;
  readonly value?: DataView;
}

export const RESPONSE_TIMEOUT_MS = 3000;

export class FtmsControl {
  private hasControl = false;
  private pending: ((result: number) => void) | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly controlPoint: ControlPoint,
    private readonly range: ResistanceRange,
  ) {
    controlPoint.addEventListener("characteristicvaluechanged", () => {
      const response = controlPoint.value && parseControlResponse(controlPoint.value);
      if (response) this.pending?.(response.result);
    });
  }

  /**
   * Sets the resistance; resolves to false if the trainer refused or did not
   * answer. Never rejects: a trainer that cannot be controlled just keeps
   * its current resistance.
   */
  setResistance(resistance: Resistance): Promise<boolean> {
    const run = async () => {
      try {
        if (!this.hasControl && !(await this.takeControl())) return false;
        const payload = encodeSetResistance(resistanceLevel(resistance, this.range));
        let result = await this.send(payload);
        // Another app took over meanwhile: ask again once.
        if (result === RESULT_CONTROL_NOT_PERMITTED && (await this.takeControl())) {
          result = await this.send(payload);
        }
        return result === RESULT_SUCCESS;
      } catch {
        return false;
      }
    };
    // Commands go one at a time: responses do not say which write they answer.
    const next = this.queue.then(run, run);
    this.queue = next;
    return next;
  }

  private async takeControl(): Promise<boolean> {
    this.hasControl = (await this.send(new Uint8Array([OP_REQUEST_CONTROL]))) === RESULT_SUCCESS;
    // Some trainers only apply targets once "started"; others refuse it: ignore.
    if (this.hasControl) await this.send(new Uint8Array([OP_START]));
    return this.hasControl;
  }

  private send(payload: Uint8Array<ArrayBuffer>): Promise<number> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        resolve(-1);
      }, RESPONSE_TIMEOUT_MS);
      this.pending = (result) => {
        clearTimeout(timer);
        this.pending = null;
        resolve(result);
      };
      this.controlPoint.writeValueWithResponse(payload).catch((error: unknown) => {
        clearTimeout(timer);
        this.pending = null;
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }
}
