import { describe, expect, it } from "vitest";
import {
  profileHasStep2Data,
  step2ValuesFromProfile,
} from "./step2FormValues";

describe("step2ValuesFromProfile", () => {
  it("maps employment, year, and properties for rehydration", () => {
    expect(
      step2ValuesFromProfile({
        employmentType: "part_time",
        businessSinceYear: 2012,
        propertiesHandled: 665,
      }),
    ).toEqual({
      employmentType: "part_time",
      businessSinceYear: 2012,
      propertiesHandled: 665,
      stepCompleted: 2,
    });
  });

  it("keeps blank year/properties as undefined and defaults unknown employment", () => {
    expect(
      step2ValuesFromProfile({
        employmentType: "",
        businessSinceYear: null,
        propertiesHandled: null,
      }),
    ).toEqual({
      employmentType: "full_time",
      businessSinceYear: undefined,
      propertiesHandled: undefined,
      stepCompleted: 2,
    });
  });

  it("preserves propertiesHandled 0 (valid explicit value)", () => {
    expect(
      step2ValuesFromProfile({
        employmentType: "full_time",
        businessSinceYear: 2018,
        propertiesHandled: 0,
      }).propertiesHandled,
    ).toBe(0);
  });
});

describe("profileHasStep2Data", () => {
  it("is false for null / empty profile", () => {
    expect(profileHasStep2Data(null)).toBe(false);
    expect(
      profileHasStep2Data({
        employmentType: "",
        businessSinceYear: null,
        propertiesHandled: null,
      }),
    ).toBe(false);
  });

  it("is true when year alone was saved", () => {
    expect(
      profileHasStep2Data({
        employmentType: "",
        businessSinceYear: 2012,
        propertiesHandled: null,
      }),
    ).toBe(true);
  });

  it("is true when propertiesHandled is 0", () => {
    expect(
      profileHasStep2Data({
        employmentType: "full_time",
        businessSinceYear: null,
        propertiesHandled: 0,
      }),
    ).toBe(true);
  });
});
