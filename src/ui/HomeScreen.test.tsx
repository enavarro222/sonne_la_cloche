import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Player } from "../core/players";
import { DEFAULT_SETTINGS } from "../core/settings";
import { REPOSITORY_URL } from "./credits";
import { HomeScreen } from "./HomeScreen";
import type { Connection } from "./useSensor";

const noop = () => undefined;

function renderHome(connection: Connection = { kind: "none" }, roster: Player[] = []) {
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
      settings={DEFAULT_SETTINGS}
      sensor={sensor}
      bluetoothSupported
      onAddPlayer={noop}
      onRemovePlayer={noop}
      onStart={noop}
      onOpenSettings={noop}
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
      lost: false,
    });
    expect(screen.getByRole("status")).toHaveTextContent("✓ KICKR connected (FTMS)");
    expect(screen.getByRole("button", { name: "Change bike" })).toBeInTheDocument();
  });

  it("says when the game sets the trainer's resistance", () => {
    renderHome({
      kind: "bluetooth",
      deviceName: "SUITO",
      protocol: "FTMS",
      controllable: true,
      lost: false,
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "✓ SUITO connected (FTMS), resistance set by the game",
    );
  });

  it("with a lost bike: offers to reconnect it", async () => {
    const sensor = renderHome({
      kind: "bluetooth",
      deviceName: "KICKR",
      protocol: "FTMS",
      controllable: true,
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
