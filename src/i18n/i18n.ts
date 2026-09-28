import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./en";
import { fr } from "./fr";
import { type Locale, localeFromPath, pathForLocale } from "./locales";

export const resources = { en: { translation: en }, fr: { translation: fr } } as const;

export function initI18n(locale: Locale): void {
  void i18n.use(initReactI18next).init({
    resources,
    lng: locale,
    fallbackLng: "en",
    initAsync: false,
    interpolation: { escapeValue: false }, // React already escapes.
  });
}

export function applyLocale(locale: Locale): void {
  void i18n.changeLanguage(locale);
  document.documentElement.lang = locale;
  document.title = i18n.t("app.title");
}

/**
 * Switches language without reloading the page: a reload would drop the
 * Bluetooth connection and the game in progress.
 */
export function switchLocale(locale: Locale): void {
  if (locale === i18n.language) return;
  history.pushState(null, "", pathForLocale(locale) + location.search + location.hash);
  applyLocale(locale);
}

/** Keeps the language in sync with the back/forward buttons. */
export function followLocaleInHistory(): () => void {
  const onPopState = () => {
    const locale = localeFromPath(location.pathname);
    if (locale) applyLocale(locale);
  };
  addEventListener("popstate", onPopState);
  return () => {
    removeEventListener("popstate", onPopState);
  };
}
