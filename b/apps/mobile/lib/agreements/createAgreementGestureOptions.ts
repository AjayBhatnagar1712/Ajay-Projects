/**
 * Native swipe-back must be off on BOTH navigators:
 *
 * 1. Nested `(create-agreement)` Stack — blocks pops between steps (and is
 *    mostly redundant today because in-flow nav is `replace`, so that stack
 *    usually has a single screen).
 * 2. Root Stack screen that hosts the group — this is the one that actually
 *    handled the Tenants left-edge swipe. Entry is `router.push` over tabs
 *    (`[tabs, create-agreement]`). iOS interactive pop belongs to the *parent*
 *    native stack; it dismisses the whole group and reveals Home. Nested
 *    `gestureEnabled: false` does not disable that. Android `BackHandler`
 *    also does not fire for iOS edge-swipe.
 *
 * Kept free of react-native so Vitest can lock the policy.
 */
export const CREATE_AGREEMENT_GESTURE_OPTIONS = {
  gestureEnabled: false,
  fullScreenGestureEnabled: false,
} as const;
