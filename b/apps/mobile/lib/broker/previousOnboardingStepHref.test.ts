import { describe, expect, it } from "vitest";
import {
  onboardingStepHref,
  previousOnboardingStepHref,
} from "./previousOnboardingStepHref";

describe("previousOnboardingStepHref", () => {
  it("maps each step to the prior onboarding screen", () => {
    expect(previousOnboardingStepHref(2)).toBe("/(onboarding)/step-1");
    expect(previousOnboardingStepHref(3)).toBe("/(onboarding)/step-2");
    expect(previousOnboardingStepHref(4)).toBe("/(onboarding)/step-3");
  });

  it("preserves profile edit mode between steps", () => {
    expect(onboardingStepHref(2, true)).toEqual({
      pathname: "/(onboarding)/step-2",
      params: { edit: "1" },
    });
    expect(previousOnboardingStepHref(4, true)).toEqual({
      pathname: "/(onboarding)/step-3",
      params: { edit: "1" },
    });
  });
});
