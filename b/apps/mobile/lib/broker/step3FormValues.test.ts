import { describe, expect, it } from "vitest";
import {
  profileHasStep3Data,
  step3ValuesFromProfile,
} from "./step3FormValues";

describe("step3ValuesFromProfile", () => {
  it("maps deals and property types for rehydration", () => {
    expect(
      step3ValuesFromProfile({
        dealsWith: ["rent", "other"],
        dealsWithOther: "Auctions",
        propertyTypes: ["flats", "villas"],
        propertyTypesOther: null,
      }),
    ).toEqual({
      dealsWith: ["rent", "other"],
      dealsWithOther: "Auctions",
      propertyTypes: ["flats", "villas"],
      propertyTypesOther: null,
      stepCompleted: 3,
    });
  });

  it("drops unknown option strings and clears other text when other is not selected", () => {
    expect(
      step3ValuesFromProfile({
        dealsWith: ["rent", "legacy_junk"],
        dealsWithOther: "should clear",
        propertyTypes: ["unknown"],
        propertyTypesOther: "nope",
      }),
    ).toEqual({
      dealsWith: ["rent"],
      dealsWithOther: null,
      propertyTypes: [],
      propertyTypesOther: null,
      stepCompleted: 3,
    });
  });
});

describe("profileHasStep3Data", () => {
  it("is false for null / empty selections", () => {
    expect(profileHasStep3Data(null)).toBe(false);
    expect(
      profileHasStep3Data({
        dealsWith: [],
        dealsWithOther: null,
        propertyTypes: [],
        propertyTypesOther: null,
      }),
    ).toBe(false);
  });

  it("is true when dealsWith alone was saved", () => {
    expect(
      profileHasStep3Data({
        dealsWith: ["sale"],
        dealsWithOther: null,
        propertyTypes: [],
        propertyTypesOther: null,
      }),
    ).toBe(true);
  });
});
