"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Returns false during SSR + the first hydration render, then true afterwards.
 *
 * Useful for client components that need to defer timezone- or clock-dependent
 * rendering until after hydration so the server and the first client render
 * emit identical markup. Drop-in safer replacement for the legacy
 * `useState(false) + useEffect(() => setState(true), [])` idiom — that
 * pattern trips React 19's `set-state-in-effect` lint, this one does not.
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
