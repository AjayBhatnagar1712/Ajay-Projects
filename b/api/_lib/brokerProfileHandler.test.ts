import { describe, expect, it } from "vitest";
import {
  BrokerOnboardingStep1Schema,
  BrokerOnboardingStep2Schema,
  BrokerOnboardingStep3Schema,
  BrokerOnboardingStep4Schema,
  BrokerProfilePatchSchema,
} from "./brokerProfileSchemas.js";
import { mapBrokerRowToProfile } from "./brokerProfileHandler.js";

describe("BrokerProfilePatchSchema", () => {
  it("requires step 1 fields when stepCompleted is 1", () => {
    const result = BrokerProfilePatchSchema.safeParse({
      stepCompleted: 1,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts step 1 without employmentType (DB keeps '' sentinel)", () => {
    const step = BrokerOnboardingStep1Schema.safeParse({
      name: "Riya",
      age: 32,
      firmName: null,
      stepCompleted: 1,
    });
    expect(step.success).toBe(true);

    const patch = BrokerProfilePatchSchema.safeParse({
      name: "Riya",
      age: 32,
      firmName: null,
      stepCompleted: 1,
    });
    expect(patch.success).toBe(true);
    if (patch.success) {
      expect(patch.data.employmentType).toBeUndefined();
      // Handler insert uses `patch.employmentType ?? ""` — abandoned step 1 → ''.
      expect(patch.data.employmentType ?? "").toBe("");
    }
  });

  it("step 1 age accepts 18 and 120, rejects 121/17 with exact age copy", () => {
    expect(
      BrokerOnboardingStep1Schema.safeParse({
        name: "Riya",
        age: 18,
        stepCompleted: 1,
      }).success,
    ).toBe(true);
    expect(
      BrokerOnboardingStep1Schema.safeParse({
        name: "Riya",
        age: 120,
        stepCompleted: 1,
      }).success,
    ).toBe(true);

    for (const age of [121, 17]) {
      const result = BrokerOnboardingStep1Schema.safeParse({
        name: "Riya",
        age,
        stepCompleted: 1,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) => issue.message === "Please enter a correct age",
          ),
        ).toBe(true);
      }
    }
  });

  it('step 1 blank age is "Age is required", not Zod NaN copy', () => {
    const result = BrokerOnboardingStep1Schema.safeParse({
      name: "Riya",
      age: undefined,
      stepCompleted: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) => issue.message === "Age is required",
        ),
      ).toBe(true);
      expect(
        result.error.issues.some((issue) => /nan/i.test(issue.message)),
      ).toBe(false);
    }
  });

  it("rejects step 2 when employmentType is missing", () => {
    const step = BrokerOnboardingStep2Schema.safeParse({
      businessSinceYear: 2018,
      propertiesHandled: 10,
      stepCompleted: 2,
    });
    expect(step.success).toBe(false);

    const patch = BrokerProfilePatchSchema.safeParse({
      businessSinceYear: 2018,
      propertiesHandled: 10,
      stepCompleted: 2,
    });
    expect(patch.success).toBe(false);
  });

  it("accepts a valid step 2 payload with employmentType", () => {
    const result = BrokerOnboardingStep2Schema.safeParse({
      employmentType: "part_time",
      businessSinceYear: 2018,
      propertiesHandled: 10,
      stepCompleted: 2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects blank step 2 year/properties without coercing empty to 0", () => {
    const blankYear = BrokerOnboardingStep2Schema.safeParse({
      employmentType: "full_time",
      businessSinceYear: undefined,
      propertiesHandled: 10,
      stepCompleted: 2,
    });
    expect(blankYear.success).toBe(false);

    const blankProps = BrokerOnboardingStep2Schema.safeParse({
      employmentType: "full_time",
      businessSinceYear: 2018,
      propertiesHandled: "",
      stepCompleted: 2,
    });
    expect(blankProps.success).toBe(false);
  });

  it("rejects legacy employment_type values on step 2", () => {
    const result = BrokerOnboardingStep2Schema.safeParse({
      employmentType: "self_employed",
      businessSinceYear: 2018,
      propertiesHandled: 10,
      stepCompleted: 2,
    });
    expect(result.success).toBe(false);
  });

  it("requires dealsWithOther when other is selected", () => {
    const result = BrokerOnboardingStep3Schema.safeParse({
      dealsWith: ["rent", "other"],
      dealsWithOther: null,
      propertyTypes: ["flats"],
      propertyTypesOther: null,
      stepCompleted: 3,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid step 3 payload with other text", () => {
    const result = BrokerOnboardingStep3Schema.safeParse({
      dealsWith: ["rent", "other"],
      dealsWithOther: "PG leasing",
      propertyTypes: ["flats", "other"],
      propertyTypesOther: "Farmhouse",
      stepCompleted: 3,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid step 4 payload", () => {
    const result = BrokerOnboardingStep4Schema.safeParse({
      region: "Bengaluru",
      pincodes: ["560001"],
      stepCompleted: 4,
    });
    expect(result.success).toBe(true);
  });

  it("requires at least one pincode at step 4", () => {
    const result = BrokerOnboardingStep4Schema.safeParse({
      region: "Pune",
      pincodes: [],
      stepCompleted: 4,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toMatch(/pincode/i);
  });
});

describe("mapBrokerRowToProfile", () => {
  it("maps snake_case row to camelCase API shape", () => {
    const profile = mapBrokerRowToProfile({
      id: "11111111-1111-4111-8111-111111111111",
      user_id: "22222222-2222-4222-8222-222222222222",
      name: "Riya",
      age: 32,
      firm_name: null,
      employment_type: "full_time",
      business_since_year: 2018,
      properties_handled: 40,
      deals_with: ["rent", "sale"],
      deals_with_other: null,
      property_types: ["flats"],
      property_types_other: null,
      region: "Bengaluru",
      pincodes: ["560001"],
      step_completed: 4,
      onboarding_completed_at: new Date("2026-07-23T10:00:00.000Z"),
      created_at: new Date("2026-07-23T09:00:00.000Z"),
      updated_at: new Date("2026-07-23T10:00:00.000Z"),
    });

    expect(profile.userId).toBe("22222222-2222-4222-8222-222222222222");
    expect(profile.firmName).toBeNull();
    expect(profile.stepCompleted).toBe(4);
    expect(profile.onboardingCompletedAt).toBe("2026-07-23T10:00:00.000Z");
    expect(profile.pincodes).toEqual(["560001"]);
  });
});
