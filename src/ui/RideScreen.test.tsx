import { act, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../core/settings";
import type { Sensor } from "../sensors/types";
import { COUNTDOWN_STEP_MS, GO_DISPLAY_MS, RideScreen } from "./RideScreen";

const COUNTDOWN_MS = COUNTDOWN_STEP_MS * 3 + GO_DISPLAY_MS;
const player = { id: "lea", name: "Léa" };
const settings = { ...DEFAULT_SETTINGS, durationSec: 20 as const };

const steadySensor = (cadence: number): Sensor => ({
  kind: "bluetooth",
  read: () => ({ cadence, power: 0 }),
  reset: vi.fn(),
  disconnect: vi.fn(),
});

const advance = (ms: number) => {
  // Small steps so every animation frame and React update runs.
  for (let t = 0; t < ms; t += 50) {
    act(() => {
      vi.advanceTimersByTime(50);
    });
  }
};

describe("RideScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "performance",
      ],
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const renderRide = (sensor: Sensor, onFinish: (points: number) => void) =>
    render(
      <StrictMode>
        <RideScreen
          player={player}
          round={1}
          settings={settings}
          record={null}
          sensor={sensor}
          onFinish={onFinish}
        />
      </StrictMode>,
    );

  it("counts down, then scores value/3 per second and finishes exactly once", () => {
    const onFinish = vi.fn();
    renderRide(steadySensor(90), onFinish);
    expect(screen.getByText("3")).toBeInTheDocument();
    advance(COUNTDOWN_MS + 100);
    expect(screen.getByTestId("ride-score")).toBeInTheDocument();
    advance(25_000);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]?.[0]).toBeCloseTo(600, -1);
  });

  it("does not restart when the sensor is replaced mid-ride (bike reconnected)", () => {
    const onFinish = vi.fn();
    const { rerender } = renderRide(steadySensor(90), onFinish);
    advance(COUNTDOWN_MS + 10_000);
    rerender(
      <StrictMode>
        <RideScreen
          player={player}
          round={1}
          settings={settings}
          record={null}
          sensor={steadySensor(90)}
          onFinish={onFinish}
        />
      </StrictMode>,
    );
    advance(10_500);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]?.[0]).toBeCloseTo(600, -1);
  });
});
