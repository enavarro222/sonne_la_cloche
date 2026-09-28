import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type Game, initialState, reducer } from "../core/game";
import type { RideStats } from "../core/ride";
import { DEFAULT_SETTINGS } from "../core/settings";
import { ResultScreen } from "./ResultScreen";

const players = [
  { id: "lea", name: "Léa" },
  { id: "tom", name: "Tom" },
];

function gameAfterOneRide(stats: RideStats): Game {
  let state = reducer(initialState(players, DEFAULT_SETTINGS), { type: "gameStarted" });
  state = reducer(state, { type: "rideFinished", points: 500, stats });
  if (!state.game) throw new Error("no game");
  return state.game;
}

const renderResult = (game: Game) =>
  render(
    <ResultScreen
      game={game}
      bikeReady
      onNext={() => undefined}
      onRetry={() => undefined}
      onPlayAgain={() => undefined}
      onHome={() => undefined}
    />,
  );

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
});
