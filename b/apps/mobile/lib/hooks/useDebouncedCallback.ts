import { useCallback, useEffect, useRef } from "react";

/**
 * Debounced async callback with cancel + flush for create-agreement autosave.
 * Leading edge is not used — fires `delayMs` after the last call.
 * `schedule` / `cancel` / `flush` identities are stable across renders.
 */
export function useDebouncedCallback(
  callback: () => void | Promise<void>,
  delayMs: number,
): {
  schedule: () => void;
  cancel: () => void;
  flush: () => Promise<void>;
} {
  const callbackRef = useRef(callback);
  const delayRef = useRef(delayMs);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);
  const inFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    delayRef.current = delayMs;
  }, [delayMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const cancel = useCallback((): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = false;
  }, []);

  const run = useCallback(async (): Promise<void> => {
    const result = callbackRef.current();
    const promise = Promise.resolve(result).then(() => undefined);
    inFlightRef.current = promise;
    try {
      await promise;
    } finally {
      if (inFlightRef.current === promise) {
        inFlightRef.current = null;
      }
    }
  }, []);

  const schedule = useCallback((): void => {
    pendingRef.current = true;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (!pendingRef.current) return;
      pendingRef.current = false;
      void run();
    }, delayRef.current);
  }, [run]);

  const flush = useCallback(async (): Promise<void> => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = false;
    if (inFlightRef.current) {
      await inFlightRef.current;
    }
    // Always persist current form state — not only a pending debounce.
    // Cancel Save / step Back must not no-op just because the timer already
    // fired or watch had not marked pending yet.
    await run();
  }, [run]);

  return { schedule, cancel, flush };
}
