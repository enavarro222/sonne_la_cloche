// The page a player's QR code opens on their phone (/strava/#<their game>):
// publish the game on their Strava account, or download it as a .fit file.

import "@fontsource/bungee/400.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/900.css";
import "../ui/theme.css";
import "./strava.css";

import i18n from "i18next";
import { activityText } from "../export/activityText";
import { buildFit } from "../export/fit";
import { decodePlayerActivity, type PlayerActivity } from "../export/playerLink";
import type { LatLon } from "../export/virtualTrack";
import { applyLocale, initI18n } from "../i18n/i18n";
import { pickLocale } from "../i18n/locales";

const PENDING_KEY = "sonne-la-cloche.strava-pending";

/** What must survive the round trip to Strava's consent page. */
interface Pending {
  state: string;
  fragment: string;
  center: LatLon | null;
}

type BannerState = "working" | "done" | "failed";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fileName(activity: PlayerActivity): string {
  const date = new Date(activity.rides[0]?.startedAt ?? Date.now()).toISOString().slice(0, 10);
  const name = activity.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents off: "Léa" → "Lea"
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `sonne-la-cloche-${date}-${name || "player"}.fit`;
}

function downloadFit(activity: PlayerActivity, center: LatLon | null): void {
  const file = buildFit(activity.rides, center ?? undefined);
  const url = URL.createObjectURL(new Blob([file], { type: "application/octet-stream" }));
  el("a", { href: url, download: fileName(activity) }).click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10_000);
}

function startPublishing(fragment: string, center: LatLon | null): void {
  const pending: Pending = { state: crypto.randomUUID(), fragment, center };
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  const mobile = /Android|iPhone|iPad/.test(navigator.userAgent) ? "1" : "0";
  location.href = `/api/strava/authorize?state=${pending.state}&mobile=${mobile}`;
}

async function upload(
  activity: PlayerActivity,
  code: string,
  pending: Pending,
): Promise<{ url?: string; error?: string }> {
  const { name, description } = activityText(activity, i18n.t, `${location.origin}/`);
  const response = await fetch("/api/strava/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      file: toBase64(buildFit(activity.rides, pending.center ?? undefined)),
      name,
      description,
      sportType: "VirtualRide",
      externalId: `sonne-la-cloche-${String(activity.rides[0]?.startedAt ?? 0)}-${activity.name}`,
    }),
  });
  return (await response.json().catch(() => ({}))) as { url?: string; error?: string };
}

function renderActivity(root: HTMLElement, activity: PlayerActivity, fragment: string) {
  const t = i18n.t;
  const banner = el("div", { className: "banner", hidden: true });
  banner.setAttribute("role", "status");
  const report = (state: BannerState, text: string, link?: string) => {
    banner.hidden = false;
    banner.className = `banner ${state}`;
    banner.replaceChildren(el("p", {}, (state === "done" ? "✓ " : "") + text));
    if (link) {
      banner.append(
        el(
          "a",
          { href: link, className: "primary", target: "_blank", rel: "noopener" },
          t("strava.view"),
        ),
      );
    }
  };

  let center: LatLon | null = null;
  const mapStatus = el("p", { className: "help" }, t("strava.mapHelp"));
  const mapToggle = el("input", { type: "checkbox" });
  mapToggle.onchange = () => {
    center = null;
    if (!mapToggle.checked) {
      mapStatus.textContent = t("strava.mapHelp");
      return;
    }
    mapStatus.textContent = t("strava.locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        center = { lat: position.coords.latitude, lon: position.coords.longitude };
        mapStatus.textContent = `${t("strava.located")} ${t("strava.mapHelp")}`;
      },
      () => {
        mapToggle.checked = false;
        mapStatus.textContent = t("strava.noPosition");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  const publish = el("button", { type: "button", className: "primary" }, t("strava.publish"));
  publish.onclick = () => {
    startPublishing(fragment, center);
  };
  const download = el("button", { type: "button", className: "secondary" }, t("strava.download"));
  download.onclick = () => {
    downloadFit(activity, center);
  };

  const { summary } = activityText(activity, t, `${location.origin}/`);
  root.replaceChildren(
    el("h1", {}, t("strava.title")),
    banner,
    el("p", { className: "player" }, activity.name),
    el("p", { className: "summary" }, summary),
    el(
      "ul",
      { className: "rides" },
      ...activity.rides.map((ride, i) =>
        el(
          "li",
          {},
          t("strava.ride", { round: i + 1, points: ride.points, seconds: ride.samples.length }),
        ),
      ),
    ),
    el("label", { className: "map" }, mapToggle, " ", t("strava.map")),
    mapStatus,
    el("div", { className: "row" }, publish, download),
    el("p", { className: "help" }, t("strava.help")),
  );
  return report;
}

async function main(root: HTMLElement): Promise<void> {
  // Back from Strava's consent page with ?code=… (or ?error=…) and our state.
  const params = new URLSearchParams(location.search);
  const back = params.has("code") || params.has("error");
  const raw = back ? sessionStorage.getItem(PENDING_KEY) : null;
  const pending = raw ? (JSON.parse(raw) as Pending) : null;
  if (back) sessionStorage.removeItem(PENDING_KEY);

  const fragment = back ? (pending?.fragment ?? "") : location.hash.slice(1);
  if (back) history.replaceState(null, "", `/strava/#${fragment}`);
  const activity = await decodePlayerActivity(fragment);

  const locale = activity?.locale ?? pickLocale(navigator.languages);
  initI18n(locale);
  applyLocale(locale);
  document.title = `${i18n.t("app.title")} — Strava`;

  if (!activity) {
    root.replaceChildren(
      el("h1", {}, i18n.t("strava.title")),
      el("p", {}, i18n.t("strava.invalid")),
    );
    return;
  }
  const report = renderActivity(root, activity, fragment);
  if (!back) return;

  // The state proves this answer comes from the consent we asked for.
  const code = params.get("code");
  if (!code || pending?.state !== params.get("state")) {
    report("failed", i18n.t("strava.refused"));
    return;
  }
  report("working", i18n.t("strava.sending"));
  const result = await upload(activity, code, pending);
  if (result.url) report("done", i18n.t("strava.done"), result.url);
  else if (result.error === "duplicate") report("failed", i18n.t("strava.duplicate"));
  else report("failed", i18n.t("strava.failed"));
}

const root = document.getElementById("root");
if (root) void main(root);
