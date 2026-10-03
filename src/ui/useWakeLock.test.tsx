import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWakeLock } from "./useWakeLock";

/** A browser with the Screen Wake Lock API, recording every lock it hands out. */
function fakeWakeLock() {
  const locks: { release: ReturnType<typeof vi.fn> }[] = [];
  const request = vi.fn(() => {
    const lock = { release: vi.fn(() => Promise.resolve()) };
    locks.push(lock);
    return Promise.resolve(lock);
  });
  Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
  return { request, locks };
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

/** Lets the hook's pending promises settle. */
const settle = () => act(() => Promise.resolve());

describe("useWakeLock", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "wakeLock");
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("keeps the screen on while active, and lets it sleep afterwards", async () => {
    const { request, locks } = fakeWakeLock();
    const { rerender } = renderHook(
      ({ active }) => {
        useWakeLock(active);
      },
      { initialProps: { active: false } },
    );
    await settle();
    expect(request).not.toHaveBeenCalled();

    rerender({ active: true });
    await settle();
    expect(request).toHaveBeenCalledWith("screen");

    rerender({ active: false });
    await settle();
    expect(locks[0]?.release).toHaveBeenCalled();
  });

  it("takes the lock again when the page comes back into view", async () => {
    const { request } = fakeWakeLock();
    renderHook(() => {
      useWakeLock(true);
    });
    await settle();
    // The browser drops the lock while the page is hidden (another app, a tab).
    setVisibility("hidden");
    await settle();
    expect(request).toHaveBeenCalledOnce();
    setVisibility("visible");
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("releases a lock granted after the game no longer needs it", async () => {
    let grant: (lock: { release: () => Promise<void> }) => void = () => undefined;
    const release = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "wakeLock", {
      value: { request: () => new Promise((resolve) => (grant = resolve)) },
      configurable: true,
    });
    const { unmount } = renderHook(() => {
      useWakeLock(true);
    });
    unmount();
    grant({ release });
    await settle();
    expect(release).toHaveBeenCalled();
  });

  it("stays quiet when the browser refuses, or has no wake lock", async () => {
    Object.defineProperty(navigator, "wakeLock", {
      value: {
        request: () => Promise.reject(new DOMException("Battery saver", "NotAllowedError")),
      },
      configurable: true,
    });
    renderHook(() => {
      useWakeLock(true);
    });
    await settle();
    Reflect.deleteProperty(navigator, "wakeLock");
    expect(() =>
      renderHook(() => {
        useWakeLock(true);
      }),
    ).not.toThrow();
  });
});
