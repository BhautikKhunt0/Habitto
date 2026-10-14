/**
 * Overlay registry.
 *
 * The floating dock is `fixed bottom-8`, which is exactly where a bottom-sheet
 * modal's action row lands — the two read as colliding even though the modal
 * (z-100) already paints over the dock (z-50). Modals announce themselves here
 * so the dock can actually step aside instead of just being covered.
 *
 * Reference-counted, so nested or stacked modals don't hide the dock early.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

let depth = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => depth > 0;

export function useOverlayOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Hold the dock back for as long as this modal is open.
 *
 * Returns a `release()` to call the moment the user commits to closing — a
 * modal wrapped in `AnimatePresence` stays mounted for its whole exit spring,
 * so waiting on unmount would leave the dock hidden long after the click.
 * `release()` is idempotent, so the unmount cleanup can call it too.
 */
export function useRegisterOverlay(): () => void {
  const releaseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let released = false;

    depth += 1;
    emit();

    releaseRef.current = () => {
      if (released) return;
      released = true;
      depth = Math.max(0, depth - 1);
      emit();
    };

    return releaseRef.current;
  }, []);

  return useCallback(() => releaseRef.current?.(), []);
}

/**
 * Same registration, but for anything that only exists conditionally — a
 * portalled modal that can't hold hooks of its own (it lives outside the
 * component's tree), or a drag on the dashboard board.
 */
export function OverlaySignal({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    depth += 1;
    emit();
    return () => {
      depth = Math.max(0, depth - 1);
      emit();
    };
  }, [active]);

  return null;
}