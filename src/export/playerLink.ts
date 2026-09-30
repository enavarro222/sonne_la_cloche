// A player's game, packed into the address a QR code opens on their phone.
// It travels after the "#", which browsers never send to the server: the
// data goes from the tablet to the phone without being stored anywhere.

import type { GameSummary, SummaryFeat } from "../core/game";
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
  /** The whole game, to redraw the results image; null in older links. */
  summary: GameSummary | null;
  /** Ridden on a real bike, so it can go to Strava (older links: all were). */
  strava: boolean;
}

const VERSION = 1;
/** Power is stored in 2 W steps in one byte: up to 510 W. */
const POWER_STEP = 2;

/** Awards in the order they are packed. */
const AWARDS = ["bestRide", "fastest", "strongest"] as const;

/**
 * The summary in the header: ranking rows as [rank, name, total], awards as
 * [row index, value] or 0, so a name is never written twice.
 */
function packSummary({ ranking, awards }: GameSummary) {
  return {
    k: ranking.map((r) => [r.rank, r.name, r.total]),
    a: AWARDS.map((key) => {
      const feat = awards[key];
      const row = feat ? ranking.findIndex((r) => r.name === feat.name) : -1;
      return feat && row >= 0 ? [row, feat.value] : 0;
    }),
  };
}

const isInt = (value: unknown): value is number => Number.isInteger(value);

function unpackSummary(packed: unknown): GameSummary | null {
  if (typeof packed !== "object" || packed === null) return null;
  const { k, a } = packed as Record<string, unknown>;
  if (!Array.isArray(k) || !Array.isArray(a) || a.length !== AWARDS.length) return null;
  const ranking: GameSummary["ranking"] = [];
  for (const row of k as unknown[]) {
    if (!Array.isArray(row)) return null;
    const [rank, name, total] = row as unknown[];
    if (!isInt(rank) || typeof name !== "string" || !isInt(total)) return null;
    ranking.push({ rank, name, total });
  }
  const feat = (entry: unknown): SummaryFeat | null | undefined => {
    if (entry === 0) return null;
    if (!Array.isArray(entry)) return undefined;
    const [row, value] = entry as unknown[];
    const name = isInt(row) ? ranking[row]?.name : undefined;
    return name !== undefined && isInt(value) ? { name, value } : undefined;
  };
  const [bestRide, fastest, strongest] = (a as unknown[]).map(feat);
  if (bestRide === undefined || fastest === undefined || strongest === undefined) return null;
  return { ranking, awards: { bestRide, fastest, strongest } };
}

const clampByte = (value: number) => Math.min(255, Math.max(0, Math.round(value)));

function pack(activity: PlayerActivity): Uint8Array<ArrayBuffer> {
  const header = new TextEncoder().encode(
    JSON.stringify({
      l: activity.locale,
      n: activity.name,
      r: activity.rank,
      p: activity.players,
      t: activity.total,
      ...(activity.summary && { s: packSummary(activity.summary) }),
      ...(!activity.strava && { d: 1 }),
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
  const { l, n, r, p, t, s, d } = header;
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
  return {
    locale: l,
    name: n,
    rank: r,
    players: p,
    total: t,
    rides,
    summary: unpackSummary(s),
    strava: d !== 1,
  };
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
