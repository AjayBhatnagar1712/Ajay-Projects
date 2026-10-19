import { describe, expect, it } from "vitest";
import { routeFromBrokerProfile } from "./routing";

/**
 * Gate rule (mirrors useRequireOnboardingComplete): shell is allowed only when
 * onboardingCompletedAt is set. Otherwise redirect via routeFromBrokerProfile.
 */
function allowsAuthenticatedShell(
  profile: { onboardingCompletedAt: string | null } | null,
): boolean {
  return Boolean(profile?.onboardingCompletedAt);
}

describe("authenticated shell onboarding gate rule", () => {
  it("blocks null profile (no brokers row yet)", () => {
    expect(allowsAuthenticatedShell(null)).toBe(false);
    expect(routeFromBrokerProfile(null)).toBe("/(onboarding)/step-1");
  });

  it("blocks incomplete onboarding", () => {
    expect(
      allowsAuthenticatedShell({ onboardingCompletedAt: null }),
    ).toBe(false);
  });

  it("allows completed onboarding", () => {
    expect(
      allowsAuthenticatedShell({
        onboardingCompletedAt: "2026-08-01T00:00:00.000Z",
      }),
    ).toBe(true);
  });
});
