import { describe, expect, it } from "vitest";
import {
  validateTenantOnboardL1,
  validateTenantOnboardL2,
  requiresRoommateGender,
} from "./tenantOnboardRequirements";

describe("validateTenantOnboardL1", () => {
  const valid = {
    linkedinUrl: "https://linkedin.com/in/me",
    moveInTimeline: "Immediately" as const,
    occupancyType: "Family" as const,
    occupancyOther: "",
    bachelorGender: "" as const,
    foodPreference: "Vegetarian" as const,
  };

  it("passes when all required fields are present", () => {
    expect(validateTenantOnboardL1(valid)).toBeNull();
  });

  it("requires bachelor gender when bachelor is selected", () => {
    expect(
      validateTenantOnboardL1({
        ...valid,
        occupancyType: "Bachelor",
        bachelorGender: "",
      }),
    ).toBe("Gender is required for bachelors");
  });

  it("requires occupancy other text when other is selected", () => {
    expect(
      validateTenantOnboardL1({
        ...valid,
        occupancyType: "Other",
        occupancyOther: "",
      }),
    ).toBe("Please describe who will be staying");
  });
});

describe("validateTenantOnboardL2", () => {
  const valid = {
    city: "Hyderabad",
    localities: ["Madhapur"],
    sharingPreference: "Single Occupancy" as const,
    roommateGender: "" as const,
    propertyType: "Apartment" as const,
    propertyTypeOther: "",
  };

  it("passes when all required fields are present", () => {
    expect(validateTenantOnboardL2(valid)).toBeNull();
  });

  it("requires roommate gender for double sharing", () => {
    expect(requiresRoommateGender("Double Sharing")).toBe(true);
    expect(
      validateTenantOnboardL2({
        ...valid,
        sharingPreference: "Double Sharing",
        roommateGender: "",
      }),
    ).toBe("Preferred roommate gender is required");
  });

  it("requires property type other text", () => {
    expect(
      validateTenantOnboardL2({
        ...valid,
        propertyType: "Other",
        propertyTypeOther: "",
      }),
    ).toBe("Please specify the property type");
  });
});
