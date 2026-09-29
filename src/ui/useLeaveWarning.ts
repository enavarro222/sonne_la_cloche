import { useEffect } from "react";

/**
 * While `active`, reloading or closing the tab asks for confirmation (the
 * browser's own dialog): the game in progress would be lost.
 */
export function useLeaveWarning(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    addEventListener("beforeunload", onBeforeUnload);
    return () => {
      removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [active]);
}
