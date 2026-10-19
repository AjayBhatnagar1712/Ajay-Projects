/**
 * Direction for in-flow create-agreement `replace` (Expo Router has no
 * animation argument on `replace()`, and `setOptions` on the current screen
 * would not apply to the destination).
 *
 * The nested stack reads this when building the incoming screen's options.
 * Set it synchronously before `router.replace`, then leave it until the next
 * step replace or an explicit clear on exit (Cancel / Property Back).
 *
 * Kept free of react-native so Vitest can cover the policy.
 */

export type CreateAgreementReplaceAnimation = "push" | "pop";

const DEFAULT_REPLACE_ANIMATION: CreateAgreementReplaceAnimation = "push";

let pendingReplaceAnimation: CreateAgreementReplaceAnimation =
  DEFAULT_REPLACE_ANIMATION;

export function setCreateAgreementReplaceAnimation(
  animation: CreateAgreementReplaceAnimation,
): void {
  pendingReplaceAnimation = animation;
}

export function peekCreateAgreementReplaceAnimation(): CreateAgreementReplaceAnimation {
  return pendingReplaceAnimation;
}

/**
 * Reset to forward-replace default so Cancel / Property-Back-to-entry do not
 * inherit a leftover Back `pop` from the last in-flow step.
 */
export function clearCreateAgreementStepReplaceAnimation(): void {
  pendingReplaceAnimation = DEFAULT_REPLACE_ANIMATION;
}
