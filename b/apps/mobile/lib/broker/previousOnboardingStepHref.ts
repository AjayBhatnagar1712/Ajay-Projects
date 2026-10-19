import type { Href } from "expo-router";

export function onboardingStepHref(
  step: 1 | 2 | 3 | 4,
  isEditing = false,
): Href {
  const pathname =
    step === 1
      ? "/(onboarding)/step-1"
      : step === 2
        ? "/(onboarding)/step-2"
        : step === 3
          ? "/(onboarding)/step-3"
          : "/(onboarding)/step-4";
  return isEditing ? { pathname, params: { edit: "1" } } : pathname;
}

/** Logical previous onboarding route when stack history is empty (resume). */
export function previousOnboardingStepHref(
  step: 2 | 3 | 4,
  isEditing = false,
): Href {
  return onboardingStepHref((step - 1) as 1 | 2 | 3, isEditing);
}
