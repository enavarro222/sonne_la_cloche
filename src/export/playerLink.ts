// A player's game, packed into the address a QR code opens on their phone.
// It travels after the "#", which browsers never send to the server: the
// data goes from the tablet to the phone without being stored anywhere.

import type { RideSample } from "../core/ride";
import type { Locale } from "../i18n/locales";
import { isLocale } from "../i18n/locales";

export interface PlayerRide {
  /** Milliseconds since the epoch (kept to the second). */
  startedAt: number;
  points: number;
  samples: readonly RideSample[];
}

export interface PlayerActivity {
  locale: Locale;
  name: string;
  rank: number;
  players: number;
  total: number;
  rides: readonly PlayerRide[];
}

const VERSION = 1;
/** Power is stored in 2 W steps in one byte: up to 510 W. */
const POWER_STEP = 2;

const clampByte = (value: number) => Math.min(255, Math.max(0, Math.round(value)));

function pack(activity: PlayerActivity): Uint8Array<ArrayBuffer> {
  const header = new TextEncoder().encode(
    JSON.stringify({
      l: activity.locale,
      n: activity.name,
      r: activity.rank,
      p: activity.players,
      t: activity.total,
    }),
  );
  const size =
    3 + header.length + 1 + activity.rides.reduce((sum, r) => sum + 8 + r.samples.length * 2, 0);
  const view = new DataView(new ArrayBuffer(size));
  let o = 0;
  view.setUint8(o++, VERSION);
  view.setUint16(o, header.length);
  o += 2;
  new Uint8Array(view.buffer).set(header, o);
  o += header.length;
  view.setUint8(o++, activity.rides.length);
  for (const ride of activity.rides) {
    view.setUint32(o, Math.floor(ride.startedAt / 1000));
    view.setUint16(o + 4, Math.min(65535, Math.round(ride.points)));
    view.setUint16(o + 6, ride.samples.length);
    o += 8;
    for (const sample of ride.samples) {
      view.setUint8(o++, clampByte(sample.cadence));
      view.setUint8(o++, clampByte(sample.power / POWER_STEP));
    }
  }
  return new Uint8Array(view.buffer);
}

function unpack(bytes: Uint8Array): PlayerActivity | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint8(0) !== VERSION) return null;
  const headerLength = view.getUint16(1);
  let o = 3;
  const header = JSON.parse(
    new TextDecoder().decode(bytes.subarray(o, o + headerLength)),
  ) as Record<string, unknown>;
  o += headerLength;
  const { l, n, r, p, t } = header;
  if (
    typeof l !== "string" ||
    !isLocale(l) ||
    typeof n !== "string" ||
    typeof r !== "number" ||
    typeof p !== "number" ||
    typeof t !== "number"
  ) {
    return null;
  }
  const rides: PlayerRide[] = [];
  const count = view.getUint8(o++);
  for (let i = 0; i < count; i++) {
    const startedAt = view.getUint32(o) * 1000;
    const points = view.getUint16(o + 4);
    const length = view.getUint16(o + 6);
    o += 8;
    const samples: RideSample[] = [];
    for (let s = 0; s < length; s++) {
      samples.push({
        second: s + 1,
        cadence: view.getUint8(o++),
        power: view.getUint8(o++) * POWER_STEP,
      });
    }
    rides.push({ startedAt, points, samples });
  }
  return { locale: l, name: n, rank: r, players: p, total: t, rides };
}

async function transform(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array<ArrayBuffer>> {
  const source = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  return new Uint8Array(await new Response(source.pipeThrough(stream)).arrayBuffer());
}

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (text: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

/** The part of the address after "#". */
export async function encodePlayerActivity(activity: PlayerActivity): Promise<string> {
  return toBase64Url(await transform(pack(activity), new CompressionStream("deflate-raw")));
}

/** Null for anything that is not a link made by the game. */
export async function decodePlayerActivity(fragment: string): Promise<PlayerActivity | null> {
  try {
    return unpack(await transform(fromBase64Url(fragment), new DecompressionStream("deflate-raw")));
  } catch {
    return null;
  }
}
