import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZWIFT_PRIMARY_TYPES } from "home-trainer-kit";
import { Header } from "./Header";

const zwiftRemote = (state: { name?: string; lost?: boolean; count?: number } = {}) => ({
  supported: true,
  connecting: false,
  controllers: Array.from({ length: state.count ?? (state.name ? 1 : 0) }, (_, i) => ({
    id: String(i),
    name: state.name ?? "Zwift Click",
    lost: state.lost ?? false,
    lastButton: null,
    presses: 0,
  })),
  name: state.name ?? null,
  lost: state.lost ?? false,
  connect: vi.fn(() => Promise.resolve()),
  reconnect: vi.fn(() => Promise.resolve()),
});

function renderHeader(remote?: ReturnType<typeof zwiftRemote>, offerRemote = false) {
  render(
    <Header
      connection={{ kind: "none" }}
      connecting={false}
      error={null}
      reconnect={() => Promise.resolve()}
      remote={remote}
      offerRemote={offerRemote}
    />,
  );
}

describe("Header remote", () => {
  it("says a remote that dropped is asleep, to wake with a press", () => {
    renderHeader(zwiftRemote({ name: "Zwift Click", lost: true }));
    expect(screen.getByText("Remote asleep: press a button")).toBeInTheDocument();
  });

  it("says the remotes are connected while they hold", () => {
    renderHeader(zwiftRemote({ name: "Zwift Click", count: 2 }), true);
    expect(screen.getByText("2 remotes connected")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remote/ })).not.toBeInTheDocument();
  });

  it("offers to connect a remote mid-game, when asked to", async () => {
    const remote = zwiftRemote();
    renderHeader(remote, true);
    await userEvent.click(screen.getByRole("button", { name: "Connect the Zwift remote" }));
    expect(remote.connect).toHaveBeenCalledWith(ZWIFT_PRIMARY_TYPES);
  });

  it("does not offer one otherwise", () => {
    renderHeader(zwiftRemote());
    expect(screen.queryByRole("button", { name: /remote/ })).not.toBeInTheDocument();
  });
});

/** jsdom has no Fullscreen API: fake a browser that has one. */
function fakeFullscreen() {
  let element: Element | null = null;
  const change = () => document.dispatchEvent(new Event("fullscreenchange"));
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => element,
  });
  const request = vi.fn(() => {
    element = document.documentElement;
    change();
    return Promise.resolve();
  });
  const exit = vi.fn(() => {
    element = null;
    change();
    return Promise.resolve();
  });
  Object.defineProperty(document.documentElement, "requestFullscreen", {
    configurable: true,
    value: request,
  });
  Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exit });
  return { request, exit };
}

describe("Header fullscreen button", () => {
  afterEach(() => {
    for (const key of ["fullscreenEnabled", "fullscreenElement", "exitFullscreen"]) {
      Reflect.deleteProperty(document, key);
    }
    Reflect.deleteProperty(document.documentElement, "requestFullscreen");
  });

  it("is hidden when the browser cannot go fullscreen", () => {
    renderHeader();
    expect(screen.queryByRole("button", { name: "Full screen" })).not.toBeInTheDocument();
  });

  it("enters fullscreen, then offers the way back", async () => {
    const { request, exit } = fakeFullscreen();
    renderHeader();
    await userEvent.click(screen.getByRole("button", { name: "Full screen" }));
    expect(request).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Exit full screen" }));
    expect(exit).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Full screen" })).toBeInTheDocument();
  });

  it("follows a fullscreen left with the browser's own controls", () => {
    fakeFullscreen();
    renderHeader();
    act(() => {
      void document.documentElement.requestFullscreen();
    });
    expect(screen.getByRole("button", { name: "Exit full screen" })).toBeInTheDocument();
    act(() => {
      void document.exitFullscreen();
    });
    expect(screen.getByRole("button", { name: "Full screen" })).toBeInTheDocument();
  });
});
