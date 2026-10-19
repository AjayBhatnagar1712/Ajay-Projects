import type { BrokerProfile } from "@workspace/api-schemas";
import type { Href } from "expo-router";

function onboardingStepHref(
  step: 1 | 2 | 3 | 4,
  resumed: boolean,
): Href {
  const pathname =
    step === 1
      ? "/(onboarding)/step-1"
      : step === 2
        ? "/(onboarding)/step-2"
        : step === 3
          ? "/(onboarding)/step-3"
          : "/(onboarding)/step-4";

  if (!resumed) return pathname;
  return { pathname, params: { resumed: "1" } };
}

/**
 * After session is confirmed, route from GET /api/v1/broker/profile.
 * No row or incomplete onboarding → corresponding onboarding step.
 * onboardingCompletedAt set → tabs.
 *
 * When the broker already finished at least one step (`stepCompleted >= 1`),
 * cold launch / OTP / gate redirects include `resumed=1` so the step can show
 * "welcome back" copy — progress itself is server-persisted either way.
 */
export function routeFromBrokerProfile(profile: BrokerProfile | null): Href {
  if (profile?.onboardingCompletedAt) {
    return "/(tabs)/home";
  }

  const completed = profile?.stepCompleted ?? 0;
  const resumed = completed >= 1;

  if (completed >= 4) {
    return onboardingStepHref(4, resumed);
  }
  const nextStep = Math.min(completed + 1, 4) as 1 | 2 | 3 | 4;
  return onboardingStepHref(nextStep, resumed);
}
