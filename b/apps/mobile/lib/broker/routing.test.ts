import { describe, expect, it } from "vitest";
import type { BrokerProfile } from "@workspace/api-schemas";
import { routeFromBrokerProfile } from "./routing";

function baseProfile(overrides: Partial<BrokerProfile>): BrokerProfile {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "22222222-2222-4222-8222-222222222222",
    name: "",
    age: null,
    firmName: null,
    employmentType: "",
    businessSinceYear: null,
    propertiesHandled: null,
    dealsWith: [],
    dealsWithOther: null,
    propertyTypes: [],
    propertyTypesOther: null,
    region: "",
    pincodes: [],
    stepCompleted: 0,
    onboardingCompletedAt: null,
    createdAt: "2026-07-23T09:00:00.000Z",
    updatedAt: "2026-07-23T09:00:00.000Z",
    ...overrides,
  };
}

describe("routeFromBrokerProfile", () => {
  it("routes to step 1 when no profile", () => {
    expect(routeFromBrokerProfile(null)).toBe("/(onboarding)/step-1");
  });

  it("routes to next step with resumed flag after stepCompleted", () => {
    expect(routeFromBrokerProfile(baseProfile({ stepCompleted: 1 }))).toEqual({
      pathname: "/(onboarding)/step-2",
      params: { resumed: "1" },
    });
    expect(routeFromBrokerProfile(baseProfile({ stepCompleted: 2 }))).toEqual({
      pathname: "/(onboarding)/step-3",
      params: { resumed: "1" },
    });
    expect(routeFromBrokerProfile(baseProfile({ stepCompleted: 3 }))).toEqual({
      pathname: "/(onboarding)/step-4",
      params: { resumed: "1" },
    });
  });

  it("does not mark step 1 as resumed when nothing is completed", () => {
    expect(routeFromBrokerProfile(baseProfile({ stepCompleted: 0 }))).toBe(
      "/(onboarding)/step-1",
    );
  });

  it("routes to tabs when onboardingCompletedAt is set", () => {
    expect(
      routeFromBrokerProfile(
        baseProfile({
          stepCompleted: 4,
          onboardingCompletedAt: "2026-07-23T10:00:00.000Z",
        }),
      ),
    ).toBe("/(tabs)/home");
  });
});
