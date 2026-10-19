import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { getBrokerProfile } from "@/lib/api/client";
import { classifyLaunchFailure } from "@/lib/auth/launchGate";
import { signOut } from "@/lib/auth/phoneOtp";
import { routeFromBrokerProfile } from "@/lib/broker/routing";
import { replaceRoot } from "@/lib/navigation/replaceRoot";

export type OnboardingGateState =
  | { status: "loading" }
  | { status: "allowed" }
  | { status: "redirecting" };

/**
 * Blocks authenticated shell screens (tabs, Profile) until onboarding is complete.
 * Incomplete / missing broker profile → replaceRoot to the correct onboarding step.
 */
export function useRequireOnboardingComplete(): OnboardingGateState {
  const router = useRouter();
  const profileQuery = useQuery({
    queryKey: ["broker-profile"],
    queryFn: getBrokerProfile,
  });

  useEffect(() => {
    if (profileQuery.isLoading || profileQuery.isFetching) return;

    if (profileQuery.isError) {
      const err = profileQuery.error;
      if (classifyLaunchFailure(err) === "unauthenticated") {
        void (async () => {
          await signOut();
          replaceRoot(router, "/(auth)/session-expired");
        })();
        return;
      }
      // Soft failure: keep shell visible; screens show their own error UI.
      return;
    }

    const profile = profileQuery.data ?? null;
    if (profile?.onboardingCompletedAt) return;

    replaceRoot(router, routeFromBrokerProfile(profile));
  }, [
    profileQuery.data,
    profileQuery.error,
    profileQuery.isError,
    profileQuery.isFetching,
    profileQuery.isLoading,
    router,
  ]);

  if (profileQuery.isLoading) {
    return { status: "loading" };
  }

  if (profileQuery.data?.onboardingCompletedAt) {
    return { status: "allowed" };
  }

  if (profileQuery.isError) {
    // Non-auth errors: allow render so the screen can show recovery UI.
    if (classifyLaunchFailure(profileQuery.error) !== "unauthenticated") {
      return { status: "allowed" };
    }
  }

  return { status: "redirecting" };
}
