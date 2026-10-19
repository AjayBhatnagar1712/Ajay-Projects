import { describe, expect, it } from "vitest";
import {
  profileHasStep4Data,
  step4ValuesFromProfile,
} from "./step4FormValues";

describe("step4ValuesFromProfile", () => {
  it("maps region and pincodes for rehydration", () => {
    expect(
      step4ValuesFromProfile({
        region: " Mumbai ",
        pincodes: ["400001", "400002"],
      }),
    ).toEqual({
      region: "Mumbai",
      pincodes: ["400001", "400002"],
      stepCompleted: 4,
    });
  });

  it("keeps empty region and empty pincodes", () => {
    expect(
      step4ValuesFromProfile({
        region: "  ",
        pincodes: [],
      }),
    ).toEqual({
      region: "",
      pincodes: [],
      stepCompleted: 4,
    });
  });
});

describe("profileHasStep4Data", () => {
  it("is false for null / empty profile", () => {
    expect(profileHasStep4Data(null)).toBe(false);
    expect(profileHasStep4Data({ region: "", pincodes: [] })).toBe(false);
  });

  it("is true when pincodes alone were saved", () => {
    expect(
      profileHasStep4Data({
        region: "",
        pincodes: ["560001"],
      }),
    ).toBe(true);
  });
});
