import { type RefObject, useLayoutEffect, useRef } from "react";

/** A ref always holding the latest value, for effects that must not restart. */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
