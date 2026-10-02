import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

function renderHeader() {
  render(
    <Header
      connection={{ kind: "none" }}
      connecting={false}
      error={null}
      reconnect={() => Promise.resolve()}
    />,
  );
}

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
