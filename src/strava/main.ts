// The page a player's QR code opens on their phone (/strava/#<their game>):
// share the results picture with their own apps, and, for a game ridden on a
// real bike, publish it on their Strava account or download it as a .fit file.
// The path says "strava" because Strava's OAuth sends players back to it.

import "@fontsource/bungee/400.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/900.css";
import "../ui/theme.css";
import "./strava.css";
import "../feedback/feedback.css";

import i18n from "i18next";
import { activityText } from "../export/activityText";
import { buildFit } from "../export/fit";
import { feedbackAvailable, feedbackForm } from "../feedback/form";
import { decodePlayerActivity, type PlayerActivity } from "../export/playerLink";
import type { LatLon } from "../export/virtualTrack";
import { applyLocale, initI18n } from "../i18n/i18n";
import { pickLocale } from "../i18n/locales";
import { renderResultCard } from "../ui/share/resultCard";
import { shareContent } from "../ui/share/shareContent";
import { shareResults } from "../ui/share/shareResults";
import { fitFileName, fromState, toBase64, toState } from "./phonePage";

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

function downloadFit(activity: PlayerActivity, center: LatLon | null): void {
  const file = buildFit(activity.rides, center ?? undefined);
  const url = URL.createObjectURL(new Blob([file], { type: "application/octet-stream" }));
  el("a", { href: url, download: fitFileName(activity) }).click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10_000);
}

/**
 * Whether this site can publish on Strava: without the optional server (a
 * local copy of the game, a plain static host), only the download works.
 */
async function publishingAvailable(): Promise<boolean> {
  try {
    const response = await fetch("/api/strava/status");
    if (!response.ok) return false;
    const status = (await response.json()) as { configured?: unknown };
    return status.configured === true;
  } catch {
    return false;
  }
}

function startPublishing(fragment: string, center: LatLon | null): void {
  const mobile = /Android|iPhone|iPad/.test(navigator.userAgent) ? "1" : "0";
  const state = encodeURIComponent(toState(fragment, center));
  location.href = `/api/strava/authorize?state=${state}&mobile=${mobile}`;
}

async function upload(
  activity: PlayerActivity,
  code: string,
  center: LatLon | null,
): Promise<{ url?: string; error?: string }> {
  const { name, description } = activityText(activity, i18n.t, `${location.origin}/`);
  const response = await fetch("/api/strava/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      file: toBase64(buildFit(activity.rides, center ?? undefined)),
      name,
      description,
      sportType: "VirtualRide",
      externalId: `sonne-la-cloche-${String(activity.rides[0]?.startedAt ?? 0)}-${activity.name}`,
    }),
  });
  return (await response.json().catch(() => ({}))) as { url?: string; error?: string };
}

/** The same results picture as the tablet's, redrawn from the link. */
function imageSection(activity: PlayerActivity): HTMLElement | null {
  if (!activity.summary) return null;
  const t = i18n.t;
  const content = shareContent(
    activity.summary,
    t,
    activity.locale,
    `${location.origin}/${activity.locale}/`,
    new Date(activity.rides[0]?.startedAt ?? Date.now()),
  );
  const preview = el("img", { className: "card", alt: t("strava.imageAlt"), hidden: true });
  let image: Blob | null = null;
  void renderResultCard(content).then((blob) => {
    image = blob;
    if (!blob) return;
    preview.src = URL.createObjectURL(blob);
    preview.hidden = false;
  });
  const note = el("p", { className: "status", hidden: true });
  note.setAttribute("role", "status");
  const share = el("button", { type: "button", className: "primary big" }, t("strava.shareImage"));
  share.onclick = () => {
    note.hidden = true;
    // No await before sharing: the phone only allows it right after a tap.
    void shareResults(content, image).then((outcome) => {
      if (outcome !== "downloaded" && outcome !== "failed") return;
      note.textContent = t(outcome === "downloaded" ? "share.fallback" : "share.failed");
      note.hidden = false;
    });
  };
  return el(
    "section",
    {},
    preview,
    el("div", { className: "row" }, share),
    note,
    el("p", { className: "help" }, t("strava.shareHelp")),
  );
}

/** Publishing on Strava, or downloading the .fit file. */
function stravaSection(activity: PlayerActivity, fragment: string): HTMLElement {
  const t = i18n.t;
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

  const publish = el(
    "button",
    { type: "button", className: "strava big", hidden: true },
    t("strava.publish"),
  );
  const publishHelp = el("p", { className: "help", hidden: true }, t("strava.help"));
  const photoHelp = el("p", { className: "help", hidden: true }, t("strava.imageHelp"));
  const importHelp = el("p", { className: "help", hidden: true }, t("strava.importHelp"));
  void publishingAvailable().then((available) => {
    publish.hidden = !available;
    publishHelp.hidden = !available;
    photoHelp.hidden = !available || !activity.summary;
    importHelp.hidden = available;
  });
  publish.onclick = () => {
    startPublishing(fragment, center);
  };
  const download = el("button", { type: "button", className: "secondary" }, t("strava.download"));
  download.onclick = () => {
    downloadFit(activity, center);
  };
  return el(
    "section",
    {},
    el("h2", {}, t("strava.stravaTitle")),
    el("label", { className: "map" }, mapToggle, " ", t("strava.map")),
    mapStatus,
    el("div", { className: "row" }, publish, download),
    publishHelp,
    photoHelp,
    importHelp,
  );
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
  );
  const image = imageSection(activity);
  if (image) root.append(image);
  if (activity.strava) root.append(stravaSection(activity, fragment));
  void feedbackAvailable().then((available) => {
    if (!available) return;
    const bike = activity.strava ? "bike" : "demo";
    root.append(
      el(
        "section",
        {},
        el("h2", {}, t("feedback.title")),
        feedbackForm({ locale: activity.locale, source: "phone", bike }),
      ),
    );
  });
  return report;
}

async function main(root: HTMLElement): Promise<void> {
  // Back from Strava's consent page with ?code=… (or ?error=…) and our state.
  const params = new URLSearchParams(location.search);
  const back = params.has("code") || params.has("error");
  const returned = fromState(params.get("state") ?? "");
  const fragment = back ? returned.fragment : location.hash.slice(1);
  if (back) history.replaceState(null, "", `/strava/#${fragment}`);
  const activity = await decodePlayerActivity(fragment);

  const locale = activity?.locale ?? pickLocale(navigator.languages);
  initI18n(locale);
  applyLocale(locale);
  document.title = `${i18n.t("strava.title")} — ${i18n.t("app.title")}`;

  if (!activity) {
    root.replaceChildren(
      el("h1", {}, i18n.t("strava.title")),
      el("p", {}, i18n.t("strava.invalid")),
    );
    return;
  }
  const report = renderActivity(root, activity, fragment);
  if (!back) return;

  const code = params.get("code");
  if (!code) {
    const notConfigured = params.get("error") === "not_configured";
    report("failed", i18n.t(notConfigured ? "strava.notConfigured" : "strava.refused"));
    return;
  }
  report("working", i18n.t("strava.sending"));
  const result = await upload(activity, code, returned.center);
  if (result.url) report("done", i18n.t("strava.done"), result.url);
  else if (result.error === "duplicate") report("failed", i18n.t("strava.duplicate"));
  else report("failed", i18n.t("strava.failed"));
}

const root = document.getElementById("root");
if (root) void main(root);
