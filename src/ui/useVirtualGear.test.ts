import { act, renderHook } from "@testing-library/react";
import {
  emitControl,
  gearFactor,
  neutralGear,
  type Sensor,
  VIRTUAL_RATIOS,
} from "home-trainer-kit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sounds } from "./sound";
import { useVirtualGear } from "./useVirtualGear";

const COG = { chainring: 34, cog: 14 };

const trainer = () => {
  const setGear = vi.fn(() => Promise.resolve(true));
  const sensor: Sensor = {
    kind: "bluetooth",
    read: () => ({ cadence: 0, power: 0 }),
    measuresPower: () => true,
    reset: () => undefined,
    disconnect: () => undefined,
    setGear,
  };
  return { sensor, setGear };
};

const press = (key: string) => {
  act(() => {
    dispatchEvent(new KeyboardEvent("keydown", { key }));
  });
};

describe("useVirtualGear", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts each ride on the gear closest to the real one", () => {
    const { sensor, setGear } = trainer();
    const { result } = renderHook(() => useVirtualGear(sensor, COG));
    expect(result.current).toBe(neutralGear(COG));
    expect(setGear).toHaveBeenLastCalledWith(gearFactor(neutralGear(COG), COG));
  });

  it("shifts with + and −, a clic-clac each time, and tells the trainer", () => {
    const shift = vi.spyOn(sounds, "shift").mockImplementation(() => undefined);
    const { sensor, setGear } = trainer();
    const { result } = renderHook(() => useVirtualGear(sensor, COG));
    const start = neutralGear(COG);
    press("+");
    expect(result.current).toBe(start + 1);
    expect(shift).toHaveBeenLastCalledWith(true);
    expect(setGear).toHaveBeenLastCalledWith(gearFactor(start + 1, COG));
    press("-");
    press("-");
    expect(result.current).toBe(start - 1);
    expect(shift).toHaveBeenLastCalledWith(false);
    expect(shift).toHaveBeenCalledTimes(3);
  });

  it("shifts from a Zwift remote or a gamepad", () => {
    vi.spyOn(sounds, "shift").mockImplementation(() => undefined);
    const { sensor } = trainer();
    const { result } = renderHook(() => useVirtualGear(sensor, COG));
    act(() => {
      emitControl("gearUp");
    });
    expect(result.current).toBe(neutralGear(COG) + 1);
  });

  it("stays quiet at the end of the cassette", () => {
    const shift = vi.spyOn(sounds, "shift").mockImplementation(() => undefined);
    const { sensor } = trainer();
    const { result } = renderHook(() => useVirtualGear(sensor, COG));
    for (let i = 0; i < VIRTUAL_RATIOS.length + 2; i++) press("+");
    expect(result.current).toBe(VIRTUAL_RATIOS.length - 1);
    expect(shift).toHaveBeenCalledTimes(VIRTUAL_RATIOS.length - 1 - neutralGear(COG));
  });

  it("gives the trainer its plain slope back when the ride ends", () => {
    const { sensor, setGear } = trainer();
    const { unmount } = renderHook(() => useVirtualGear(sensor, COG));
    unmount();
    expect(setGear).toHaveBeenLastCalledWith(1);
  });

  it("does nothing with the bike's own gears", () => {
    const shift = vi.spyOn(sounds, "shift").mockImplementation(() => undefined);
    const { sensor, setGear } = trainer();
    const { result, unmount } = renderHook(() => useVirtualGear(sensor, null));
    press("+");
    unmount();
    expect(result.current).toBeNull();
    expect(shift).not.toHaveBeenCalled();
    expect(setGear).not.toHaveBeenCalled();
  });
});
