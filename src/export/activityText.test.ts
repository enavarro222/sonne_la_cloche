import i18n from "i18next";
import { afterEach, describe, expect, it } from "vitest";
import { activityText } from "./activityText";
import type { PlayerActivity } from "./playerLink";

const game = (rank: number, rides = 3): PlayerActivity => ({
  locale: "fr",
  name: "Léa",
  rank,
  players: 6,
  total: 1881,
  rides: Array.from({ length: rides }, () => ({ startedAt: 0, points: 627, samples: [] })),
  summary: null,
  strava: true,
});
const URL = "https://sonnelacloche.enavarro.eu/";

describe("activityText", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("writes ordinal ranks in English", () => {
    const text = (rank: number) => activityText(game(rank), i18n.t, URL).summary;
    expect(text(1)).toBe("1st of 6 · 1881 points");
    expect(text(2)).toBe("2nd of 6 · 1881 points");
    expect(text(3)).toBe("3rd of 6 · 1881 points");
    expect(text(4)).toBe("4th of 6 · 1881 points");
  });

  it("writes ordinal ranks and plurals in French", async () => {
    await i18n.changeLanguage("fr");
    expect(activityText(game(1), i18n.t, URL).summary).toBe("1er sur 6 · 1881 points");
    expect(activityText(game(2, 1), i18n.t, URL).description).toBe(
      `2e sur 6 avec 1881 points en 1 passage. ${URL}`,
    );
    expect(activityText(game(2), i18n.t, URL).name).toBe("🔔 Sonne la cloche !");
  });
});
