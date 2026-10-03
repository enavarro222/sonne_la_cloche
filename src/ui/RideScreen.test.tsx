import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../core/settings";
import { DemoSensor } from "../sensors/demo/demoSensor";
import type { Sensor } from "../sensors/types";
import { COUNTDOWN_STEP_MS, type FinishedRide, GO_DISPLAY_MS, RideScreen } from "./RideScreen";

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

// Each test plays up to 25 s of a ride in 50 ms steps (hundreds of renders):
// fast alone, but slower than the default 5 s budget under coverage.
describe("RideScreen", { timeout: 20_000 }, () => {
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

  const renderRide = (sensor: Sensor, onFinish: (ride: FinishedRide) => void) =>
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
    expect((onFinish.mock.calls[0]?.[0] as FinishedRide | undefined)?.points).toBeCloseTo(600, -1);
  });

  it("hands over the ride's trace: start time and one sample per second", () => {
    const onFinish = vi.fn();
    renderRide(steadySensor(90), onFinish);
    advance(COUNTDOWN_MS + 21_000);
    const ride = onFinish.mock.calls[0]?.[0] as FinishedRide;
    expect(Date.parse(ride.trace.startedAt)).not.toBeNaN();
    expect(ride.trace.samples).toHaveLength(20);
    expect(ride.trace.samples[19]).toEqual({ second: 20, cadence: 90, power: 0 });
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
    expect((onFinish.mock.calls[0]?.[0] as FinishedRide | undefined)?.points).toBeCloseTo(600, -1);
  });

  it("rings the bell once the record is beaten", () => {
    render(
      <RideScreen
        player={player}
        round={1}
        settings={settings}
        record={{ player: { id: "tom", name: "Tom" }, points: 100 }}
        sensor={steadySensor(90)}
        onFinish={vi.fn()}
      />,
    );
    advance(COUNTDOWN_MS + 2_000);
    expect(screen.getByText("Record: Tom")).toBeInTheDocument();
    // 90 rpm = 30 pts/s: 100 points after ~3.3 s.
    advance(2_000);
    expect(screen.getByText("Record beaten!")).toBeInTheDocument();
    expect(screen.queryByText("Record: Tom")).not.toBeInTheDocument();
  });

  it("gives the first ride a goal to ring", () => {
    render(
      <RideScreen
        player={player}
        round={1}
        settings={settings}
        record={null}
        sensor={steadySensor(90)}
        onFinish={vi.fn()}
      />,
    );
    advance(COUNTDOWN_MS + 1_000);
    expect(screen.getByText("Goal")).toBeInTheDocument();
    // Goal for 20 s = 80 rpm × 20 s / 3 ≈ 533 points; 90 rpm gets there in ~18 s.
    advance(18_000);
    expect(screen.getByText("Goal reached!")).toBeInTheDocument();
  });

  it("sets the trainer's resistance at the start of each ride", () => {
    const sensor = { ...steadySensor(90), setResistance: vi.fn(() => Promise.resolve(true)) };
    render(
      <RideScreen
        player={player}
        round={1}
        settings={{ ...settings, resistance: "hard" }}
        record={null}
        sensor={sensor}
        onFinish={vi.fn()}
      />,
    );
    expect(sensor.setResistance).toHaveBeenCalledWith("hard");
  });

  it("pedals in demo mode with ← and → in turn, not with one key", () => {
    const onFinish = vi.fn();
    render(
      <RideScreen
        player={player}
        round={1}
        settings={settings}
        record={null}
        sensor={new DemoSensor()}
        onFinish={onFinish}
      />,
    );
    advance(COUNTDOWN_MS + 100);
    // Same key only: no pedaling.
    for (let i = 0; i < 10; i++) {
      fireEvent.keyDown(window, { code: "ArrowRight" });
      advance(350);
    }
    expect(Number(screen.getByTestId("ride-score").textContent)).toBe(0);
    // Alternating every 170 ms: about 95 rpm, 30 points per second.
    for (let i = 0; i < 20; i++) {
      fireEvent.keyDown(window, { code: i % 2 ? "ArrowRight" : "ArrowLeft" });
      advance(170);
    }
    expect(Number(screen.getByTestId("ride-score").textContent)).toBeGreaterThan(80);
    expect(screen.getByRole("button", { name: "← Left foot" })).toBeInTheDocument();
  });
});
