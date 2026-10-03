// The phone page's pure helpers, kept out of main.ts so they can be tested.

import type { PlayerActivity } from "../export/playerLink";
import type { LatLon } from "../export/virtualTrack";

/**
 * The OAuth "state" carries the game (and the map center) through Strava's
 * consent page, which Strava hands back untouched: the upload can finish in
 * whatever tab or browser Strava returns to (its app opens a new one). No
 * need to check it against a nonce: the code is bound to the account that
 * just consented, so it can only ever publish to that account.
 */
export function toState(fragment: string, center: LatLon | null): string {
  return center ? `${fragment}.${center.lat.toFixed(5)},${center.lon.toFixed(5)}` : fragment;
}

export function fromState(state: string): { fragment: string; center: LatLon | null } {
  // Only the first dot separates: the coordinates have their own.
  const dot = state.indexOf(".");
  const fragment = dot === -1 ? state : state.slice(0, dot);
  const position = dot === -1 ? "" : state.slice(dot + 1);
  const parts = position.split(",");
  const [lat, lon] = parts.map((part) => (part.trim() ? Number(part) : Number.NaN));
  const center =
    parts.length === 2 &&
    lat !== undefined &&
    lon !== undefined &&
    Number.isFinite(lat) &&
    Number.isFinite(lon)
      ? { lat, lon }
      : null;
  return { fragment, center };
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fitFileName(activity: PlayerActivity): string {
  const date = new Date(activity.rides[0]?.startedAt ?? Date.now()).toISOString().slice(0, 10);
  const name = activity.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents off: "Léa" → "Lea"
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `sonne-la-cloche-${date}-${name || "player"}.fit`;
}
