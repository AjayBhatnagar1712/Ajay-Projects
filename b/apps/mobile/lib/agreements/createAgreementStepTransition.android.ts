import type { Href, Router } from "expo-router";

export type CreateAgreementStepRouter = Pick<Router, "push" | "replace">;

/**
 * Work around react-native-screens/Fabric duplicate-parent crashes caused by
 * replacing one mounted agreement form with the next on Android. Wizard Back,
 * Cancel, and hardware-back actions are explicit, so pushed stale steps remain
 * unreachable and are discarded when the flow exits.
 */
export function navigateCreateAgreementStep(
  router: CreateAgreementStepRouter,
  href: Href,
): void {
  router.push(href);
}
