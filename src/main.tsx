import "@fontsource/bungee/400.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/900.css";
import "./ui/theme.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyLocale, followLocaleInHistory, initI18n } from "./i18n/i18n";
import { DEFAULT_LOCALE, localeFromPath } from "./i18n/locales";
import { App } from "./ui/App";
import { installAudioUnlock } from "./ui/sound";

const locale = localeFromPath(location.pathname) ?? DEFAULT_LOCALE;
initI18n(locale);
applyLocale(locale);
followLocaleInHistory();

installAudioUnlock();

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
