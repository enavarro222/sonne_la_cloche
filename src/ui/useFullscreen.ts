import { useCallback, useEffect, useState } from "react";

/** Whole-page fullscreen, so the game fills the tablet or the TV. */
export function useFullscreen() {
  const supported = typeof document !== "undefined" && document.fullscreenEnabled;
  const [active, setActive] = useState(() => supported && document.fullscreenElement !== null);

  useEffect(() => {
    if (!supported) return;
    // Also follows the way out the browser offers (Esc, back gesture).
    const onChange = () => {
      setActive(document.fullscreenElement !== null);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
    };
  }, [supported]);

  const toggle = useCallback(() => {
    // Refused (not from a click, kiosk…): the page just stays as it is.
    const request = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen({ navigationUI: "hide" });
    request.catch(() => undefined);
  }, []);

  return { supported, active, toggle };
}
