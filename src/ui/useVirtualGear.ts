import {
  type Drivetrain,
  gearFactor,
  neutralGear,
  type Sensor,
  shift,
  useControls,
} from "home-trainer-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import { sounds } from "./sound";
import { useLatest } from "./useLatest";

/** Keys a remote bridge (BikeControl) or a keyboard sends for + and −. */
const KEYS: Record<string, 1 | -1> = { "+": 1, "=": 1, "-": -1 };

/**
 * Virtual gears for one ride, on a trainer with a single cog: each ride
 * starts on the gear closest to the real one. + and − shift (keyboard, Zwift
 * remote, gamepad shoulders), with a derailleur's clic-clac. Null with the
 * bike's own gears.
 */
export function useVirtualGear(sensor: Sensor, drivetrain: Drivetrain | null): number | null {
  const [gear, setGear] = useState(() => (drivetrain ? neutralGear(drivetrain) : 0));
  const current = useRef(gear);
  const enabled = drivetrain !== null;

  const shiftBy = useCallback(
    (by: 1 | -1) => {
      if (!enabled) return;
      const next = shift(current.current, by);
      // None at the end of the cassette: nothing changed.
      if (next === current.current) return;
      current.current = next;
      setGear(next);
      sounds.shift(by > 0);
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      const by = KEYS[event.key];
      if (by === undefined) return;
      event.preventDefault();
      shiftBy(by);
    };
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("keydown", onKey);
    };
  }, [enabled, shiftBy]);

  useControls({
    gearUp: () => {
      shiftBy(1);
    },
    gearDown: () => {
      shiftBy(-1);
    },
  });

  const chainring = drivetrain?.chainring;
  const cog = drivetrain?.cog;
  useEffect(() => {
    if (chainring === undefined || cog === undefined) return;
    void sensor.setGear?.(gearFactor(gear, { chainring, cog }));
  }, [sensor, gear, chainring, cog]);
  // Off the ride, the trainer goes back to the plain slope.
  const latestSensor = useLatest(sensor);
  useEffect(
    () => () => {
      if (enabled) void latestSensor.current.setGear?.(1);
    },
    // Once, when the ride ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return enabled ? gear : null;
}
