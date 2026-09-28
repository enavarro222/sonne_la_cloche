import { useEffect } from "react";

/**
 * While `active`, the browser/Android back button stays on the page instead
 * of leaving it: leaving would drop the Bluetooth connection and the game.
 * Uses the current URL, so a language switched meanwhile is preserved.
 */
export function useHistoryGuard(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const guard = () => {
      history.pushState({ guard: true }, "", location.href);
    };
    guard();
    addEventListener("popstate", guard);
    return () => {
      removeEventListener("popstate", guard);
      // Drop our entry, or the next back press after the game would do nothing.
      if ((history.state as { guard?: boolean } | null)?.guard) history.back();
    };
  }, [active]);
}
