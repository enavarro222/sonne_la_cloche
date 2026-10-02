// The page the home screen's "Your opinion?" link opens, in a new tab so the
// game keeps its Bluetooth connection: /feedback/?lang=fr&bike=FTMS&trainer=KICKR

import "@fontsource/bungee/400.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/900.css";
import "../ui/theme.css";
import "../strava/strava.css";
import "./feedback.css";

import i18n from "i18next";
import { applyLocale, initI18n } from "../i18n/i18n";
import { isLocale, type Locale, pathForLocale, pickLocale } from "../i18n/locales";
import { REPOSITORY_URL } from "../ui/credits";
import { feedbackAvailable, feedbackForm } from "./form";

/**
 * The game is still open in the tab this one came from: closing this tab goes
 * back to it. Opened some other way (a bookmark), the browser refuses to
 * close it: open the game here instead.
 */
function backToGame(locale: Locale): void {
  window.close();
  setTimeout(() => {
    location.href = pathForLocale(locale);
  }, 300);
}

async function main(root: HTMLElement): Promise<void> {
  const params = new URLSearchParams(location.search);
  const lang = params.get("lang") ?? "";
  const locale = isLocale(lang) ? lang : pickLocale(navigator.languages);
  initI18n(locale);
  applyLocale(locale);
  const t = i18n.t;
  document.title = `${t("feedback.title")} — ${t("app.title")}`;

  const title = document.createElement("h1");
  title.textContent = t("feedback.title");
  root.replaceChildren(title);
  if (await feedbackAvailable()) {
    root.append(
      feedbackForm(
        {
          locale,
          source: "home",
          bike: params.get("bike") ?? "",
          trainer: params.get("trainer") ?? "",
        },
        () => {
          backToGame(locale);
        },
      ),
    );
    return;
  }
  // Without the server (a local copy, a plain static host): the public tracker.
  const unavailable = document.createElement("p");
  const link = Object.assign(document.createElement("a"), {
    href: `${REPOSITORY_URL}/issues`,
    className: "link",
    textContent: t("feedback.github"),
  });
  unavailable.append(t("feedback.unavailable"), " ", link);
  root.append(unavailable);
}

const root = document.getElementById("root");
if (root) void main(root);
