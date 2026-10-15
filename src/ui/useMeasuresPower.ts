import { useEffect, useState } from "react";
import type { Sensor } from "../sensors/types";

/** How often the home screen checks again, ms. */
export const CHECK_EVERY_MS = 1000;

/**
 * Whether the sensor measures power, kept up to date while `watching`: what
 * the bike sends only shows after connecting, outside React (a trainer whose
 * power stays at 0 while pedaling). True without a sensor.
 */
export function useMeasuresPower(sensor: Sensor | null, watching: boolean): boolean {
  const [measures, setMeasures] = useState(() => sensor?.measuresPower() ?? true);
  useEffect(() => {
    const check = () => {
      setMeasures(sensor?.measuresPower() ?? true);
    };
    if (!watching) return;
    const timer = setInterval(check, CHECK_EVERY_MS);
    // Right away too: the sensor may have just changed.
    const first = setTimeout(check, 0);
    return () => {
      clearInterval(timer);
      clearTimeout(first);
    };
  }, [sensor, watching]);
  return measures;
}
