import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type Game, initialState, reducer } from "../core/game";
import type { RideStats } from "../core/ride";
import { DEFAULT_SETTINGS } from "../core/settings";
import { ResultScreen } from "./ResultScreen";

const TRACE = { startedAt: "2026-09-29T15:00:00.000Z", samples: [] };

const players = [
  { id: "lea", name: "Léa" },
  { id: "tom", name: "Tom" },
];

function gameAfterOneRide(stats: RideStats): Game {
  let state = reducer(initialState(players, DEFAULT_SETTINGS), { type: "gameStarted" });
  state = reducer(state, { type: "rideFinished", points: 500, stats, trace: TRACE });
  if (!state.game) throw new Error("no game");
  return state.game;
}

const renderResult = (game: Game, onHome: () => void = () => undefined) =>
  render(
    <ResultScreen
      game={game}
      bikeReady
      onNext={() => undefined}
      onRetry={() => undefined}
      onPlayAgain={() => undefined}
      onHome={onHome}
    />,
  );

const STATS = { avgCadence: 88, avgPower: 70, maxCadence: 104, maxPower: 95 };

describe("ResultScreen", () => {
  it("shows the ride's averages and peaks", () => {
    renderResult(gameAfterOneRide({ avgCadence: 88, avgPower: 70, maxCadence: 104, maxPower: 95 }));
    expect(screen.getByText("average · max 104")).toBeInTheDocument();
    expect(screen.getByText("average · max 95")).toBeInTheDocument();
  });

  it("hides what the sensor does not measure (cadence-only sensor)", () => {
    renderResult(gameAfterOneRide({ avgCadence: 88, avgPower: 0, maxCadence: 104, maxPower: 0 }));
    expect(screen.getByText("average · max 104")).toBeInTheDocument();
    expect(screen.queryByText("W")).not.toBeInTheDocument();
  });

  it("shows each round and the total in the ranking", () => {
    renderResult(gameAfterOneRide({ avgCadence: 88, avgPower: 70, maxCadence: 104, maxPower: 95 }));
    const lea = screen.getByRole("row", { name: /Léa/ });
    expect(lea).toHaveTextContent(/^1Léa500–––500$/);
  });

  it("asks before leaving a game in progress", async () => {
    const onHome = vi.fn();
    renderResult(gameAfterOneRide(STATS), onHome);
    await userEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(onHome).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog", { name: "Leave the game?" });
    expect(dialog).toHaveTextContent("The scores of this game will be lost.");
    // The safe choice has the focus.
    expect(screen.getByRole("button", { name: "Keep playing" })).toHaveFocus();

    await userEvent.click(screen.getByRole("button", { name: "Keep playing" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onHome).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Home" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Home" }));
    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("leaves a finished game without asking", async () => {
    let state = reducer(initialState(players, { ...DEFAULT_SETTINGS, rounds: 3 }), {
      type: "gameStarted",
    });
    for (let i = 0; i < 6; i++) {
      state = reducer(state, { type: "rideFinished", points: 10, stats: STATS, trace: TRACE });
      if (i < 5) state = reducer(state, { type: "nextTurn" });
    }
    if (!state.game) throw new Error("no game");
    const onHome = vi.fn();
    renderResult(state.game, onHome);
    await userEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(onHome).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
