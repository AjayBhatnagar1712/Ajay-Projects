import { Stack } from "expo-router";

/**
 * Onboarding must not gesture-pop into `(tabs)` left under the root stack
 * after Profile → Splash → OTP (native Back / swipe would otherwise hit Home).
 *
 * Navigation pattern: Expo Router Stack of `step-1`…`step-4`.
 * - Next → `router.push` (forward: new screen slides in from the right)
 * - Back → `goBackOrFallback` (`router.back` when history exists; else
 *   `router.replace` to the previous step). `animationTypeForReplace: "pop"`
 *   makes that replace animate like a back (previous screen from the left).
 *
 * Create-agreement in-flow Next is also `replace` (resume-safe), so it cannot
 * copy this stack-wide `animationTypeForReplace: "pop"`. Direction is set
 * per replace in `createAgreementNav` instead.
 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        fullScreenGestureEnabled: false,
        animation: "slide_from_right",
        animationTypeForReplace: "pop",
      }}
    />
  );
}
