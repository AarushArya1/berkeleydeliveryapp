"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Reads a browser-only value (cookie, localStorage, display mode) without a
 * hydration mismatch: `serverValue` on the server and first paint, then the
 * real value. `read` must return a primitive or a cached object.
 */
export function useClientValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(noopSubscribe, read, () => serverValue);
}
