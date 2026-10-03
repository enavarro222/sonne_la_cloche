import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type Game, initialState, reducer } from "../core/game";
import { DEFAULT_SETTINGS } from "../core/settings";
import { decodePlayerActivity } from "../export/playerLink";
import { PhoneDialog } from "./PhoneDialog";

// jsdom cannot draw the QR code itself; the link it carries is what matters.
vi.mock("qrcode", () => ({
  default: { toDataURL: (url: string) => Promise.resolve(`data:image/png;qr=${url}`) },
}));

const TRACE = { startedAt: "2026-09-29T15:00:00.000Z", samples: [] };
const STATS = { avgCadence: 88, avgPower: 70, maxCadence: 104, maxPower: 95 };

/** Léa then Tom, one round each: 500 and 320 points. */
function finishedGame(): Game {
  const players = [
    { id: "lea", name: "Léa" },
    { id: "tom", name: "Tom" },
  ];
  let state = reducer(initialState(players, { ...DEFAULT_SETTINGS, rounds: 1 }), {
    type: "gameStarted",
  });
  state = reducer(state, { type: "rideFinished", points: 500, stats: STATS, trace: TRACE });
  state = reducer(state, { type: "nextTurn" });
  state = reducer(state, { type: "rideFinished", points: 320, stats: STATS, trace: TRACE });
  if (!state.game) throw new Error("no game");
  return state.game;
}

/** The game the "open it here" link (the QR code's address) carries. */
async function linkedActivity() {
  const link = await screen.findByRole("link", { name: "or open it on this device" });
  return decodePlayerActivity(new URL(link.getAttribute("href") ?? "").hash.slice(1));
}

describe("PhoneDialog", () => {
  it("gives each player a code to their own game", async () => {
    render(<PhoneDialog game={finishedGame()} strava={false} onClose={() => undefined} />);
    expect(await linkedActivity()).toMatchObject({ name: "Léa", total: 500, rank: 1 });

    await userEvent.click(screen.getByRole("button", { name: "Tom" }));
    expect(
      await screen.findByRole("img", { name: "Tom, scan this with your phone" }),
    ).toBeVisible();
    expect(await linkedActivity()).toMatchObject({ name: "Tom", total: 320, rank: 2 });
  });

  it("offers Strava on the phones only for a game ridden on a real bike", async () => {
    const { unmount } = render(
      <PhoneDialog game={finishedGame()} strava={false} onClose={() => undefined} />,
    );
    expect((await linkedActivity())?.strava).toBe(false);
    unmount();
    render(<PhoneDialog game={finishedGame()} strava onClose={() => undefined} />);
    expect((await linkedActivity())?.strava).toBe(true);
  });

  it("opens on its close button, and closes with Escape", async () => {
    const onClose = vi.fn();
    render(<PhoneDialog game={finishedGame()} strava={false} onClose={onClose} />);
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
