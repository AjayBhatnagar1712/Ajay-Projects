import { describe, expect, it } from "vitest";
import {
  ONBOARDING_RESUME_HINT,
  onboardingStepDescription,
} from "./onboardingResumeCopy";

describe("onboardingStepDescription", () => {
  it("returns the base description when not resumed", () => {
    expect(onboardingStepDescription("Tell us a bit about yourself.", false)).toBe(
      "Tell us a bit about yourself.",
    );
  });

  it("uses the resume hint alone when base is empty", () => {
    expect(onboardingStepDescription(undefined, true)).toBe(ONBOARDING_RESUME_HINT);
    expect(onboardingStepDescription("", true)).toBe(ONBOARDING_RESUME_HINT);
  });

  it("prepends the resume hint to an existing description", () => {
    expect(onboardingStepDescription("Where do you operate?", true)).toBe(
      `${ONBOARDING_RESUME_HINT} Where do you operate?`,
    );
  });
});
