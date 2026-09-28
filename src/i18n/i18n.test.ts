import { describe, expect, it } from "vitest";
import { en } from "./en";
import { fr } from "./fr";
import { elisionContext } from "./elision";
import { localeFromPath, pickLocale } from "./locales";

const keys = (obj: object, prefix = ""): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

const placeholders = (text: string) => [...text.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort();

describe("translations", () => {
  it("have the same keys in every language", () => {
    expect(keys(fr).sort()).toEqual(keys(en).sort());
  });

  it("use the same placeholders in every language", () => {
    const get = (obj: object, path: string) =>
      path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], obj) as string;
    for (const key of keys(en)) {
      expect(placeholders(get(fr, key)), key).toEqual(placeholders(get(en, key)));
    }
  });
});

describe("locales", () => {
  it("reads the language from the URL path", () => {
    expect(localeFromPath("/fr/")).toBe("fr");
    expect(localeFromPath("/en")).toBe("en");
    expect(localeFromPath("/en/index.html")).toBe("en");
    expect(localeFromPath("/")).toBeNull();
    expect(localeFromPath("/de/")).toBeNull();
  });

  it("picks the first supported browser language, French otherwise", () => {
    expect(pickLocale(["en-US", "fr"])).toBe("en");
    expect(pickLocale(["de-DE", "FR-ca"])).toBe("fr");
    expect(pickLocale(["de-DE"])).toBe("fr");
    expect(pickLocale([])).toBe("fr");
  });
});

describe("elisionContext", () => {
  it("elides before a vowel or an h, accents included", () => {
    for (const name of ["Anne", "émile", "Hugo", "Yanis", "Œlia", "Ïsa"]) {
      expect(elisionContext(name), name).toBe("elided");
    }
    for (const name of ["Tom", "Léa", "Zoé", ""]) {
      expect(elisionContext(name), name).toBeUndefined();
    }
  });
});
