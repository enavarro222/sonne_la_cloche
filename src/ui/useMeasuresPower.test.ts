import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Sensor } from "../sensors/types";
import { CHECK_EVERY_MS, useMeasuresPower } from "./useMeasuresPower";

const sensor = (measures: () => boolean): Sensor => ({
  kind: "bluetooth",
  read: () => ({ cadence: 0, power: 0 }),
  measuresPower: measures,
  reset: () => undefined,
  disconnect: () => undefined,
});

describe("useMeasuresPower", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is true without a sensor", () => {
    const { result } = renderHook(() => useMeasuresPower(null, true));
    expect(result.current).toBe(true);
  });

  it("follows what the sensor finds out after connecting", () => {
    let measures = true;
    const trainer = sensor(() => measures);
    const { result } = renderHook(() => useMeasuresPower(trainer, true));
    expect(result.current).toBe(true);
    // Pedaling shows the power stuck at 0: the home screen says so.
    measures = false;
    act(() => {
      vi.advanceTimersByTime(CHECK_EVERY_MS);
    });
    expect(result.current).toBe(false);
  });

  it("stops checking when not watching", () => {
    const measuresPower = vi.fn(() => true);
    renderHook(() => useMeasuresPower(sensor(measuresPower), false));
    const before = measuresPower.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(CHECK_EVERY_MS * 5);
    });
    expect(measuresPower.mock.calls.length).toBe(before);
  });
});
