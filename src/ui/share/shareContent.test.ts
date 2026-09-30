import i18n from "i18next";
import { describe, expect, it } from "vitest";
import { type Action, initialState, reducer, summarize } from "../../core/game";
import { NO_STATS } from "../../core/ride";
import { DEFAULT_SETTINGS } from "../../core/settings";
import { wrapText } from "./resultCard";
import { shareContent } from "./shareContent";

const players = [
  { id: "lea", name: "Léa" },
  { id: "tom", name: "Tom" },
  { id: "zoe", name: "Zoé" },
];

function finishedGame(points: number[]) {
  const actions: Action[] = [{ type: "gameStarted" }];
  points.forEach((p, i) => {
    actions.push({
      type: "rideFinished",
      points: p,
      stats: { ...NO_STATS, maxCadence: 90 + i, maxPower: 60 },
      trace: { startedAt: "2026-09-29T15:00:00.000Z", samples: [] },
    });
    if (i < points.length - 1) actions.push({ type: "nextTurn" });
  });
  const state = actions.reduce(reducer, initialState(players, { ...DEFAULT_SETTINGS, rounds: 3 }));
  if (!state.game) throw new Error("no game");
  return summarize(state.game);
}

const URL = "https://sonnelacloche.enavarro.eu/en/";
const DATE = new Date(2026, 8, 29);

describe("shareContent", () => {
  it("builds the message: winner, ranking, link", () => {
    const content = shareContent(
      finishedGame([300, 200, 100, 300, 200, 100, 300, 200, 100]),
      i18n.t,
      "en",
      URL,
      DATE,
    );
    expect(content.text).toBe(
      [
        "🔔 Léa rings the bell!",
        "1. Léa (900)",
        "2. Tom (600)",
        "3. Zoé (300)",
        "",
        `Ring the Bell! ${URL}`,
      ].join("\n"),
    );
    expect(content.date).toBe("Game of September 29, 2026");
  });

  it("names every winner of a tie", () => {
    const content = shareContent(
      finishedGame(Array.from({ length: 9 }, () => 100)),
      i18n.t,
      "en",
      URL,
      DATE,
    );
    expect(content.winner).toBe("Léa, Tom, and Zoé ring the bell!");
  });

  it("lists the awards with their units", () => {
    const content = shareContent(
      finishedGame([300, 200, 100, 300, 200, 100, 300, 200, 100]),
      i18n.t,
      "en",
      URL,
      DATE,
    );
    expect(content.awards).toEqual([
      { label: "Best ride", value: "Léa: 300 points" },
      { label: "Fastest legs", value: "Zoé: 98 rpm" },
      { label: "Strongest", value: "Léa: 60 W" },
    ]);
  });
});

describe("wrapText", () => {
  // One unit per character, to reason about widths easily.
  const measure = (text: string) => text.length;

  it("keeps short text on one line", () => {
    expect(wrapText(measure, "Tom rings the bell!", 40)).toEqual(["Tom rings the bell!"]);
  });

  it("breaks between words", () => {
    expect(wrapText(measure, "Anne-Charlotte, Tom and Zoé ring the bell!", 20)).toEqual([
      "Anne-Charlotte, Tom",
      "and Zoé ring the",
      "bell!",
    ]);
  });

  it("never splits a word, even a long one", () => {
    expect(wrapText(measure, "Supercalifragilistic!", 5)).toEqual(["Supercalifragilistic!"]);
  });
});
