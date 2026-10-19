/** Default budget for user-facing network calls (OTP, API). */
export const NETWORK_TIMEOUT_MS = 15_000;

export const NETWORK_TIMEOUT_MESSAGE =
  "Couldn't reach the server. Check your connection and try again.";

/**
 * Rejects if `promise` does not settle within `ms`.
 * Clears the timer when the underlying promise settles first.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number = NETWORK_TIMEOUT_MS,
  message: string = NETWORK_TIMEOUT_MESSAGE,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(message));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  });
}
