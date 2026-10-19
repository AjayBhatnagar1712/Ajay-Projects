/**
 * Counts rapid taps and fires once the threshold is met within a time window.
 * Used for hidden QA / demo unlock gestures (not advertised in the UI).
 */
export function createTapUnlock(options: {
  tapsRequired: number;
  windowMs: number;
  onUnlock: () => void;
  now?: () => number;
}): () => void {
  const { tapsRequired, windowMs, onUnlock, now = Date.now } = options;
  let count = 0;
  let windowStart = 0;

  return () => {
    const t = now();
    if (count === 0 || t - windowStart > windowMs) {
      count = 1;
      windowStart = t;
    } else {
      count += 1;
    }

    if (count >= tapsRequired) {
      count = 0;
      windowStart = 0;
      onUnlock();
    }
  };
}
