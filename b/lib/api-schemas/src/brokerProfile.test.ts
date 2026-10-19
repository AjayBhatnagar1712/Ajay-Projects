import { describe, expect, it } from "vitest";
import {
  BROKER_AGE_ERROR,
  BROKER_AGE_REQUIRED_ERROR,
  BROKER_PROPERTIES_REQUIRED_ERROR,
  BROKER_YEAR_REQUIRED_ERROR,
  BrokerOnboardingStep1Schema,
  BrokerOnboardingStep2Schema,
} from "./brokerProfile";

describe("BrokerOnboardingStep1Schema age", () => {
  const base = {
    name: "Riya",
    firmName: null,
    stepCompleted: 1 as const,
  };

  it("accepts age 18 (lower bound)", () => {
    const result = BrokerOnboardingStep1Schema.safeParse({ ...base, age: 18 });
    expect(result.success).toBe(true);
  });

  it("accepts age 120 (upper bound)", () => {
    const result = BrokerOnboardingStep1Schema.safeParse({ ...base, age: 120 });
    expect(result.success).toBe(true);
  });

  it('rejects age 121 with "Please enter a correct age"', () => {
    const result = BrokerOnboardingStep1Schema.safeParse({ ...base, age: 121 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.path.includes("age") && issue.message === BROKER_AGE_ERROR,
        ),
      ).toBe(true);
      expect(BROKER_AGE_ERROR).toBe("Please enter a correct age");
    }
  });

  it('rejects age 17 with "Please enter a correct age"', () => {
    const result = BrokerOnboardingStep1Schema.safeParse({ ...base, age: 17 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.path.includes("age") &&
            issue.message === "Please enter a correct age",
        ),
      ).toBe(true);
    }
  });

  it('rejects blank age with "Age is required" (not Zod NaN message)', () => {
    for (const age of [undefined, null, "", Number.NaN] as const) {
      const result = BrokerOnboardingStep1Schema.safeParse({ ...base, age });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.path.includes("age") &&
              issue.message === BROKER_AGE_REQUIRED_ERROR,
          ),
        ).toBe(true);
        expect(
          result.error.issues.some((issue) =>
            /nan/i.test(issue.message),
          ),
        ).toBe(false);
      }
    }
    expect(BROKER_AGE_REQUIRED_ERROR).toBe("Age is required");
  });
});

describe("BrokerOnboardingStep2Schema blank numeric fields", () => {
  const base = {
    employmentType: "full_time" as const,
    stepCompleted: 2 as const,
  };

  it("rejects blank businessSinceYear without NaN message", () => {
    for (const businessSinceYear of [
      undefined,
      null,
      "",
      Number.NaN,
    ] as const) {
      const result = BrokerOnboardingStep2Schema.safeParse({
        ...base,
        businessSinceYear,
        propertiesHandled: 10,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.path.includes("businessSinceYear") &&
              issue.message === BROKER_YEAR_REQUIRED_ERROR,
          ),
        ).toBe(true);
        expect(
          result.error.issues.some((issue) => /nan/i.test(issue.message)),
        ).toBe(false);
      }
    }
  });

  it("rejects blank propertiesHandled (empty must not coerce to 0)", () => {
    for (const propertiesHandled of [
      undefined,
      null,
      "",
      Number.NaN,
    ] as const) {
      const result = BrokerOnboardingStep2Schema.safeParse({
        ...base,
        businessSinceYear: 2018,
        propertiesHandled,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.path.includes("propertiesHandled") &&
              issue.message === BROKER_PROPERTIES_REQUIRED_ERROR,
          ),
        ).toBe(true);
      }
    }
  });

  it("accepts propertiesHandled 0 when explicitly entered", () => {
    const result = BrokerOnboardingStep2Schema.safeParse({
      ...base,
      businessSinceYear: 2018,
      propertiesHandled: 0,
    });
    expect(result.success).toBe(true);
  });
});
