import { describe, expect, it } from "vitest";
import { type Action, initialState, reducer } from "../core/game";
import { NO_STATS } from "../core/ride";
import { DEFAULT_SETTINGS } from "../core/settings";
import { playerActivities } from "./fromGame";

const players = [
  { id: "lea", name: "Léa" },
  { id: "tom", name: "Tom" },
];
const at = (minute: number) => `2026-09-29T15:${String(minute).padStart(2, "0")}:00.000Z`;
const ride = (points: number, minute: number): Action => ({
  type: "rideFinished",
  points,
  stats: NO_STATS,
  trace: { startedAt: at(minute), samples: [{ second: 1, cadence: 90, power: 60 }] },
});

describe("playerActivities", () => {
  it("gives each player their rides in round order, rank and total", () => {
    const actions: Action[] = [
      { type: "gameStarted" },
      ride(100, 0),
      { type: "nextTurn" },
      ride(300, 1),
      { type: "nextTurn" },
      ride(150, 2),
    ];
    const state = actions.reduce(reducer, initialState(players, DEFAULT_SETTINGS));
    if (!state.game) throw new Error("no game");
    const [lea, tom] = playerActivities(state.game, "fr", true);
    expect(lea).toMatchObject({ locale: "fr", name: "Léa", rank: 2, players: 2, total: 250 });
    expect(lea?.rides.map((r) => [r.points, new Date(r.startedAt).toISOString()])).toEqual([
      [100, at(0)],
      [150, at(2)],
    ]);
    expect(tom).toMatchObject({ name: "Tom", rank: 1, total: 300 });
    expect(tom?.rides[0]?.samples).toEqual([{ second: 1, cadence: 90, power: 60 }]);
    // Everyone carries the whole ranking, to redraw the results image.
    expect(lea?.summary?.ranking).toEqual([
      { rank: 1, name: "Tom", total: 300 },
      { rank: 2, name: "Léa", total: 250 },
    ]);
    expect(lea?.summary).toEqual(tom?.summary);
  });
});
