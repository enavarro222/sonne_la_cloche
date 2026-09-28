import type { Sensor } from "../types";
import {
  type ParsedData,
  parseCscMeasurement,
  parseCyclingPower,
  parseIndoorBikeData,
} from "./parsers";
import { ReadingTracker } from "./readingTracker";

export type Protocol = "FTMS" | "Cycling Power" | "CSC";

// Tried in this order: the richest data first.
const PROFILES: readonly {
  protocol: Protocol;
  service: number;
  characteristic: number;
  parse: (view: DataView) => ParsedData;
}[] = [
  { protocol: "FTMS", service: 0x1826, characteristic: 0x2ad2, parse: parseIndoorBikeData },
  { protocol: "Cycling Power", service: 0x1818, characteristic: 0x2a63, parse: parseCyclingPower },
  { protocol: "CSC", service: 0x1816, characteristic: 0x2a5b, parse: parseCscMeasurement },
];

export type BluetoothErrorCode = "unsupported" | "cancelled" | "noData" | "failed";

export class BluetoothError extends Error {
  constructor(
    readonly code: BluetoothErrorCode,
    message: string = code,
  ) {
    super(message);
  }
}

export const isBluetoothSupported = (): boolean =>
  typeof navigator !== "undefined" && "bluetooth" in navigator;

export interface BluetoothSensor extends Sensor {
  readonly kind: "bluetooth";
  readonly device: BluetoothDevice;
  /** Stops listening but keeps the GATT link (e.g. when that same device reconnects). */
  detach(): void;
}

export interface BluetoothConnection {
  sensor: BluetoothSensor;
  deviceName: string;
  protocol: Protocol;
}

/** Opens the browser device picker. Must run from a user gesture. */
export async function requestTrainer(): Promise<BluetoothDevice> {
  if (!isBluetoothSupported()) throw new BluetoothError("unsupported");
  try {
    return await navigator.bluetooth.requestDevice({
      filters: PROFILES.map((p) => ({ services: [p.service] })),
      optionalServices: PROFILES.map((p) => p.service),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") {
      throw new BluetoothError("cancelled");
    }
    throw new BluetoothError("failed", String(error));
  }
}

/**
 * Connects to a device (picked earlier, so no gesture needed: this is how a
 * lost trainer reconnects) and subscribes to the first usable characteristic.
 */
export async function connectTrainer(
  device: BluetoothDevice,
  onLost: () => void,
): Promise<BluetoothConnection> {
  const gatt = device.gatt;
  if (!gatt) throw new BluetoothError("failed", "no GATT server");
  const server = await gatt.connect().catch((error: unknown) => {
    throw new BluetoothError("failed", String(error));
  });

  for (const profile of PROFILES) {
    let characteristic: BluetoothRemoteGATTCharacteristic;
    try {
      const service = await server.getPrimaryService(profile.service);
      characteristic = await service.getCharacteristic(profile.characteristic);
      await characteristic.startNotifications();
    } catch {
      continue; // service missing on this device: try the next one
    }

    const tracker = new ReadingTracker();
    const onValue = () => {
      if (characteristic.value) {
        tracker.update(profile.parse(characteristic.value), performance.now());
      }
    };
    const onDisconnected = () => {
      tracker.reset();
      onLost();
    };
    characteristic.addEventListener("characteristicvaluechanged", onValue);
    device.addEventListener("gattserverdisconnected", onDisconnected);

    const detach = () => {
      characteristic.removeEventListener("characteristicvaluechanged", onValue);
      device.removeEventListener("gattserverdisconnected", onDisconnected);
    };
    const sensor: BluetoothSensor = {
      kind: "bluetooth",
      device,
      read: (nowMs) => tracker.read(nowMs),
      reset: () => {
        tracker.reset();
      },
      detach,
      disconnect: () => {
        detach();
        gatt.disconnect();
      },
    };
    return { sensor, deviceName: device.name ?? "", protocol: profile.protocol };
  }

  gatt.disconnect();
  throw new BluetoothError("noData");
}
