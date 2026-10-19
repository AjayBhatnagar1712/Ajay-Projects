import type { Href, Router } from "expo-router";

export type CreateAgreementStepRouter = Pick<Router, "push" | "replace">;

/**
 * iOS/web keep replace semantics so only the current wizard step is retained.
 * Android supplies a platform override because Fabric native-stack replace can
 * attempt to attach the outgoing view twice during this form transition.
 */
export function navigateCreateAgreementStep(
  router: CreateAgreementStepRouter,
  href: Href,
): void {
  router.replace(href);
}
