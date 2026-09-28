import { describe, expect, it } from "vitest";
import {
  type Action,
  type AppState,
  bestRide,
  currentPlayer,
  type Game,
  initialState,
  isGameOver,
  lastRide,
  reducer,
  standings,
  upNext,
} from "./game";
import { DEFAULT_SETTINGS } from "./settings";

const lea = { id: "lea", name: "Léa" };
const tom = { id: "tom", name: "Tom" };
const sam = { id: "sam", name: "Sam" };

const run = (state: AppState, ...actions: Action[]): AppState => actions.reduce(reducer, state);

const started = (players = [lea, tom], rounds: 3 | 4 | 5 = 3): Game => {
  const { game } = run(initialState(players, { ...DEFAULT_SETTINGS, rounds }), {
    type: "gameStarted",
  });
  if (!game) throw new Error("game did not start");
  return game;
};

const withGame = (game: Game): AppState => ({
  roster: game.players,
  settings: game.settings,
  game,
});

const ride = (points: number): Action[] => [{ type: "rideFinished", points }, { type: "nextTurn" }];

describe("roster", () => {
  it("adds players with normalized names", () => {
    const state = run(initialState([], DEFAULT_SETTINGS), {
      type: "playerAdded",
      player: { id: "a", name: "  Léa   Marie " },
    });
    expect(state.roster).toEqual([{ id: "a", name: "Léa Marie" }]);
  });

  it("rejects empty and duplicate names (case-insensitive)", () => {
    const state = run(
      initialState([lea], DEFAULT_SETTINGS),
      { type: "playerAdded", player: { id: "b", name: "   " } },
      { type: "playerAdded", player: { id: "c", name: "LÉA" } },
    );
    expect(state.roster).toEqual([lea]);
  });

  it("removes a player", () => {
    const state = run(initialState([lea, tom], DEFAULT_SETTINGS), {
      type: "playerRemoved",
      id: "lea",
    });
    expect(state.roster).toEqual([tom]);
  });

  it("freezes roster and settings during a game", () => {
    const state = run(
      withGame(started()),
      { type: "playerAdded", player: sam },
      { type: "playerRemoved", id: "lea" },
      { type: "settingsChanged", settings: { rounds: 5 } },
    );
    expect(state.roster).toEqual([lea, tom]);
    expect(state.settings.rounds).toBe(3);
  });
});

describe("starting a game", () => {
  it("needs at least two players", () => {
    expect(run(initialState([], DEFAULT_SETTINGS), { type: "gameStarted" }).game).toBeNull();
    expect(run(initialState([lea], DEFAULT_SETTINGS), { type: "gameStarted" }).game).toBeNull();
    expect(
      run(initialState([lea, tom], DEFAULT_SETTINGS), { type: "gameStarted" }).game,
    ).not.toBeNull();
  });

  it("starts with the first player, round 1", () => {
    const game = started();
    expect(currentPlayer(game)).toEqual(lea);
    expect(game.round).toBe(1);
    expect(game.phase).toBe("riding");
  });

  it("uses the current settings", () => {
    const state = run(
      initialState([lea, tom], DEFAULT_SETTINGS),
      { type: "settingsChanged", settings: { durationSec: 20, metric: "power" } },
      { type: "gameStarted" },
    );
    expect(state.game?.settings).toEqual({ metric: "power", durationSec: 20, rounds: 4 });
  });
});

describe("turn order", () => {
  it("goes through every player, then the next round", () => {
    let state = withGame(started([lea, tom, sam]));
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      if (!state.game) throw new Error("no game");
      seen.push(`${currentPlayer(state.game).name}/${state.game.round}`);
      state = run(state, ...ride(10));
    }
    expect(seen).toEqual(["Léa/1", "Tom/1", "Sam/1", "Léa/2", "Tom/2"]);
  });

  it("announces who rides next", () => {
    let state = run(withGame(started()), { type: "rideFinished", points: 1 });
    expect(state.game && upNext(state.game)).toEqual({ player: tom, round: 1 });
    state = run(state, { type: "nextTurn" }, { type: "rideFinished", points: 1 });
    expect(state.game && upNext(state.game)).toEqual({ player: lea, round: 2 });
  });

  it("ends after the last player of the last round", () => {
    let state = withGame(started([lea, tom], 3));
    for (let i = 0; i < 5; i++) state = run(state, ...ride(10));
    state = run(state, { type: "rideFinished", points: 10 });
    const game = state.game;
    if (!game) throw new Error("no game");
    expect(isGameOver(game)).toBe(true);
    expect(upNext(game)).toBeNull();
    expect(run(state, { type: "nextTurn" })).toBe(state);
  });

  it("can start a new game once the previous one is over, not before", () => {
    let state = withGame(started([lea, tom], 3));
    expect(run(state, { type: "gameStarted" })).toBe(state);
    for (let i = 0; i < 5; i++) state = run(state, ...ride(10));
    state = run(state, { type: "rideFinished", points: 10 }, { type: "gameStarted" });
    expect(state.game?.rides).toEqual([]);
    expect(state.game?.round).toBe(1);
  });

  it("ignores actions that do not fit the current phase", () => {
    const state = withGame(started());
    expect(run(state, { type: "nextTurn" })).toBe(state);
    expect(run(state, { type: "rideRetried" })).toBe(state);
    const done = run(state, { type: "rideFinished", points: 5 });
    expect(run(done, { type: "rideFinished", points: 50 })).toBe(done);
  });

  it("changes the ride id on every new attempt", () => {
    const game = started();
    const retried = run(
      withGame(game),
      { type: "rideFinished", points: 1 },
      { type: "rideRetried" },
    );
    const next = run(withGame(game), ...ride(1));
    expect(retried.game?.rideId).not.toBe(game.rideId);
    expect(next.game?.rideId).not.toBe(game.rideId);
  });
});

describe("scores", () => {
  it("sums every ride over the rounds", () => {
    // Regression: the prototype subtracted the previous round's gain.
    const state = run(withGame(started()), ...ride(10), ...ride(20), ...ride(30), ...ride(5));
    const totals = state.game && standings(state.game).map((s) => [s.player.name, s.total]);
    expect(totals).toEqual([
      ["Léa", 40],
      ["Tom", 25],
    ]);
  });

  it("replaces a retried ride instead of adding it", () => {
    const state = run(
      withGame(started()),
      { type: "rideFinished", points: 30 },
      { type: "rideRetried" },
      { type: "rideFinished", points: 12 },
    );
    expect(state.game && standings(state.game)[0]).toMatchObject({ player: lea, total: 12 });
  });

  it("rounds points and clamps invalid values to zero", () => {
    const state = run(withGame(started()), ...ride(10.6), ...ride(-5), {
      type: "rideFinished",
      points: Number.NaN,
    });
    expect(state.game?.rides.map((r) => r.points)).toEqual([11, 0, 0]);
  });

  it("gives equal totals the same rank, in playing order", () => {
    const state = run(withGame(started([lea, tom, sam])), ...ride(10), ...ride(20), ...ride(20));
    const ranks = state.game && standings(state.game).map((s) => [s.player.name, s.rank]);
    expect(ranks).toEqual([
      ["Tom", 1],
      ["Sam", 1],
      ["Léa", 3],
    ]);
  });

  it("keeps the best single ride as the record", () => {
    const game = started();
    expect(bestRide(game)).toBeNull();
    const state = run(withGame(game), ...ride(10), ...ride(25), ...ride(25));
    expect(state.game && bestRide(state.game)).toEqual({ player: tom, points: 25 });
  });

  it("flags a personal best only when beating an earlier ride", () => {
    let state = run(withGame(started()), { type: "rideFinished", points: 10 });
    expect(state.game && lastRide(state.game)).toEqual({ points: 10, personalBest: false });
    state = run(state, { type: "nextTurn" }, ...ride(5), { type: "rideFinished", points: 11 });
    expect(state.game && lastRide(state.game)).toEqual({ points: 11, personalBest: true });
  });

  it("keeps earlier rounds when a later round is retried", () => {
    const state = run(
      withGame(started()),
      ...ride(10),
      ...ride(20),
      { type: "rideFinished", points: 30 },
      { type: "rideRetried" },
      { type: "rideFinished", points: 7 },
    );
    expect(state.game && standings(state.game)[0]).toMatchObject({ player: tom, total: 20 });
    expect(state.game && standings(state.game)[1]).toMatchObject({ player: lea, total: 17 });
  });

  it("can retry the very last ride: still over, total replaced", () => {
    let state = withGame(started([lea, tom], 3));
    for (let i = 0; i < 5; i++) state = run(state, ...ride(10));
    state = run(
      state,
      { type: "rideFinished", points: 50 },
      { type: "rideRetried" },
      { type: "rideFinished", points: 5 },
    );
    const game = state.game;
    if (!game) throw new Error("no game");
    expect(isGameOver(game)).toBe(true);
    expect(standings(game).find((s) => s.player.id === "tom")?.total).toBe(25);
  });

  it("does not show the attempt being retried as the record", () => {
    const state = run(
      withGame(started()),
      ...ride(10),
      { type: "rideFinished", points: 40 },
      { type: "rideRetried" },
    );
    expect(state.game && bestRide(state.game)).toEqual({ player: lea, points: 10 });
  });
});
