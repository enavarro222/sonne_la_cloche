import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MAX_PLAYERS, type Player } from "../core/players";
import { DEFAULT_SETTINGS, type Settings } from "../core/settings";
import { REPOSITORY_URL } from "../credits";
import { HomeScreen } from "./HomeScreen";
import {
  type Connection,
  ZWIFT_PRIMARY_TYPES,
  ZWIFT_SECONDARY_TYPES,
  type ZwiftControllerInfo,
} from "home-trainer-kit";

const noop = () => undefined;

const VIRTUAL: Settings = { ...DEFAULT_SETTINGS, gears: "virtual", chainring: 34, cog: 14 };

/** A connected side of a remote. */
const side = (id: string, state: Partial<ZwiftControllerInfo> = {}): ZwiftControllerInfo => ({
  id,
  name: "Zwift Click",
  lost: false,
  lastButton: null,
  presses: 0,
  ...state,
});

const zwiftRemote = (controllers: ZwiftControllerInfo[] = []) => ({
  supported: true,
  connecting: false,
  controllers,
  lost: controllers.some((c) => c.lost),
  error: null,
  connect: vi.fn(() => Promise.resolve()),
  reconnect: vi.fn(() => Promise.resolve()),
});

function renderHome(
  connection: Connection = { kind: "none" },
  roster: Player[] = [],
  {
    settings = DEFAULT_SETTINGS,
    remote = zwiftRemote(),
    onOpenSettings = noop,
  }: {
    settings?: Settings;
    remote?: ReturnType<typeof zwiftRemote>;
    onOpenSettings?: () => void;
  } = {},
) {
  const sensor = {
    connection,
    connecting: false,
    error: null,
    ready: connection.kind === "demo" || (connection.kind === "bluetooth" && !connection.lost),
    connect: vi.fn(() => Promise.resolve()),
    reconnect: vi.fn(() => Promise.resolve()),
    startDemo: vi.fn(),
  };
  render(
    <HomeScreen
      roster={roster}
      settings={settings}
      sensor={sensor}
      remote={remote}
      bluetoothSupported
      onAddPlayer={noop}
      onRemovePlayer={noop}
      onRecolourPlayer={noop}
      onMovePlayer={noop}
      onStart={noop}
      onOpenSettings={onOpenSettings}
    />,
  );
  return sensor;
}

describe("HomeScreen bike block", () => {
  it("without a bike: connect or try the demo", async () => {
    const sensor = renderHome();
    expect(screen.getByRole("button", { name: "Connect the bike" })).toBeInTheDocument();
    expect(screen.getByText(/must be switched on/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try without a bike" }));
    expect(sensor.startDemo).toHaveBeenCalled();
  });

  it("in demo mode: says so, explains how to pedal, offers the real bike", async () => {
    const sensor = renderHome({ kind: "demo" });
    expect(screen.getByRole("status")).toHaveTextContent(/Demo mode: .*pressing ← and → in turn/);
    expect(screen.queryByRole("button", { name: "Try without a bike" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Connect the bike" }));
    expect(sensor.connect).toHaveBeenCalled();
  });

  it("with a bike: shows which one, and lets you change it", () => {
    renderHome({
      kind: "bluetooth",
      deviceName: "KICKR",
      protocol: "FTMS",
      controllable: false,
      slopeControl: null,
      lost: false,
    });
    expect(screen.getByRole("status")).toHaveTextContent("✓ KICKR connected (FTMS)");
    expect(screen.getByRole("button", { name: "Change bike" })).toBeInTheDocument();
  });

  it("says when the game sets the trainer's slope", () => {
    renderHome({
      kind: "bluetooth",
      deviceName: "SUITO",
      protocol: "FTMS",
      controllable: true,
      slopeControl: "simulation",
      lost: false,
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "✓ SUITO connected (FTMS), slope set by the game",
    );
  });

  it("with a lost bike: offers to reconnect it", async () => {
    const sensor = renderHome({
      kind: "bluetooth",
      deviceName: "KICKR",
      protocol: "FTMS",
      controllable: true,
      slopeControl: "simulation",
      lost: true,
    });
    expect(screen.getByRole("status")).toHaveTextContent("Bike disconnected");
    await userEvent.click(screen.getByRole("button", { name: "Reconnect" }));
    expect(sensor.reconnect).toHaveBeenCalled();
  });
});

describe("HomeScreen credits", () => {
  it("credits the author and links to the source code in a new tab", () => {
    renderHome();
    expect(screen.getByText("Made by enavarro222")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Source code on GitHub" });
    expect(link).toHaveAttribute("href", REPOSITORY_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows which version is running, linked to its release notes", () => {
    renderHome();
    const version = screen.getByRole("link", { name: /^Version \d+\.\d+\.\d+: what's new$/ });
    expect(version).toHaveTextContent(/^v\d+\.\d+\.\d+$/);
    expect(version.getAttribute("href")).toBe(
      `${REPOSITORY_URL}/releases/tag/${version.textContent}`,
    );
  });
});

describe("HomeScreen start button", () => {
  it("names the player who rides first", () => {
    renderHome({ kind: "demo" }, [
      { id: "1", name: "Léa" },
      { id: "2", name: "Tom" },
    ]);
    expect(screen.getByRole("button", { name: "Let's go! Léa rides first" })).toBeEnabled();
  });

  it("names nobody until there are enough players", () => {
    renderHome({ kind: "demo" }, [{ id: "1", name: "Léa" }]);
    expect(screen.getByRole("button", { name: "Let's go!" })).toBeDisabled();
  });
});

describe("HomeScreen players", () => {
  it("takes no one past a full party, saying so in the field", () => {
    const full = Array.from({ length: MAX_PLAYERS }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
    renderHome({ kind: "demo" }, full);
    const field = screen.getByRole("textbox", { name: "First name" });
    expect(field).toBeDisabled();
    expect(field).toHaveAttribute("placeholder", "8 players at most");
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });
});

describe("HomeScreen gears", () => {
  it("says the bike's own gears are used, and opens the settings on a tap", async () => {
    const onOpenSettings = vi.fn();
    renderHome({ kind: "none" }, [], { onOpenSettings });
    const gears = screen.getByTestId("gears-mode");
    expect(gears).toHaveTextContent("Bike's own gears");
    expect(screen.queryByRole("button", { name: /Zwift remote/ })).not.toBeInTheDocument();
    await userEvent.click(gears);
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it("says virtual gears are on, with the real drivetrain, and offers the remote", async () => {
    const remote = zwiftRemote();
    renderHome({ kind: "none" }, [], { settings: VIRTUAL, remote });
    expect(screen.getByTestId("gears-mode")).toHaveTextContent(
      "Virtual gearsSingle cog 34 × 14: shift with + and − on the handlebar.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Connect the Zwift remote" }));
    expect(remote.connect).toHaveBeenCalledWith(ZWIFT_PRIMARY_TYPES);
  });

  it("shows the remote and the last button pressed, and offers the left pod", async () => {
    const remote = zwiftRemote([side("right", { lastButton: "plus", presses: 3 })]);
    renderHome({ kind: "demo" }, [], { settings: VIRTUAL, remote });
    expect(screen.getByTestId("remote")).toHaveTextContent("✓ Zwift Click connectedbutton +");
    await userEvent.click(screen.getByRole("button", { name: "Add the left pod (−)" }));
    expect(remote.connect).toHaveBeenCalledWith(ZWIFT_SECONDARY_TYPES);
  });

  it("shows each side once both are there, and offers no third", () => {
    const remote = zwiftRemote([side("right"), side("left", { lastButton: "minus", presses: 1 })]);
    renderHome({ kind: "demo" }, [], { settings: VIRTUAL, remote });
    const [right, left] = screen.getAllByTestId("remote");
    expect(right).toHaveTextContent("✓ Zwift Click connectedpress a button to test it");
    expect(left).toHaveTextContent("✓ Zwift Click connectedbutton −");
    expect(screen.queryByRole("button", { name: /remote|left pod/ })).not.toBeInTheDocument();
  });

  it("says a remote asleep wakes with a press, and can be reconnected by hand", async () => {
    const remote = zwiftRemote([side("right", { lost: true })]);
    renderHome({ kind: "demo" }, [], { settings: VIRTUAL, remote });
    expect(screen.getByText("Zwift Click asleep: press a button")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reconnect the remote" }));
    expect(remote.reconnect).toHaveBeenCalled();
    expect(remote.connect).not.toHaveBeenCalled();
  });

  it("warns when the trainer can't be controlled: virtual gears would change nothing", () => {
    renderHome(
      {
        kind: "bluetooth",
        deviceName: "Power meter",
        protocol: "Cycling Power",
        controllable: false,
        slopeControl: null,
        lost: false,
      },
      [],
      { settings: VIRTUAL },
    );
    expect(screen.getByText(/virtual gears change nothing on it/)).toBeInTheDocument();
  });
});
