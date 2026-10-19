import type { Href, Router } from "expo-router";

type DismissableRouter = {
  canDismiss?: () => boolean;
  dismissAll?: () => void;
  replace: (href: Href) => void;
};

/**
 * Root-stack model (file-based Expo Router):
 *
 *   Root Stack
 *   ├── (auth)     splash | intro | phone | otp | session-expired
 *   ├── (onboarding) step-1…4     ← gestureEnabled: false
 *   ├── (tabs)     home | agreements | records  ← gated on onboardingCompletedAt
 *   ├── profile / notifications / create-agreement / …
 *
 * Desired shapes after each *intent* transition:
 *
 *   unauthenticated cold launch
 *     [splash] → [intro] when onboarding incomplete locally
 *              → [phone] when onboarding complete (re-login)
 *
 *   authenticated, onboarding incomplete
 *     [splash] → [step-N]   (N = stepCompleted+1)
 *
 *   authenticated, onboarding complete
 *     [splash] → [tabs]
 *
 *   leave shell (sign-out / clear local data)
 *     [tabs, profile, …] → [splash]
 *
 *   OTP success
 *     […, phone, otp] → [step-N] | [tabs]
 *
 *   Step 1 Back
 *     [step-1] → [phone]  (signed out)
 *
 *   Step 4 Finish
 *     [step-1…4] → [tabs]
 *
 * Why not unconditional dismissAll()?
 *   expo-router maps dismissAll → POP_TO_TOP. With a single screen in the
 *   closest stack (typical Splash after cold launch / Redirect), that action
 *   is unhandled → "POP_TO_TOP was not handled by any navigator".
 *
 * Strategy: dismissAll only when canDismiss() (a stack with length > 1),
 * then replace. Tab/profile gates remain the safety net if anything is left
 * underneath.
 */
export function replaceRoot(router: Router, href: Href): void {
  const r = router as DismissableRouter;
  if (typeof r.canDismiss === "function" && typeof r.dismissAll === "function") {
    if (r.canDismiss()) {
      r.dismissAll();
    }
  }
  router.replace(href);
}
