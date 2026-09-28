export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];

// The audience is primarily French-speaking.
export const DEFAULT_LOCALE: Locale = "fr";

export const LOCALE_LABELS: Record<Locale, string> = { fr: "FR", en: "EN" };

export const isLocale = (value: string): value is Locale =>
  (LOCALES as readonly string[]).includes(value);

/** "/fr/", "/fr" or "/fr/index.html" → "fr". */
export function localeFromPath(pathname: string): Locale | null {
  const segment = pathname.split("/")[1] ?? "";
  return isLocale(segment) ? segment : null;
}

/** First supported language in the browser preferences (e.g. navigator.languages). */
export function pickLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const primary = tag.toLowerCase().split("-")[0] ?? "";
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}

export const pathForLocale = (locale: Locale): string => `/${locale}/`;
