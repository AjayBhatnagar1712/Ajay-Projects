/**
 * Safe back for screens that may be the only stack entry after a resume/deep link.
 * Prefer real history; otherwise run `fallback` (typically `router.replace` to the
 * logical previous step).
 */
export function goBackOrFallback(
  router: { canGoBack: () => boolean; back: () => void },
  fallback: () => void,
): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  fallback();
}
