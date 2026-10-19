import { describe, expect, it } from "vitest";
import {
  profileHasStep1Data,
  step1ValuesFromProfile,
} from "./step1FormValues";

describe("step1ValuesFromProfile", () => {
  it("maps name, age, and firmName for rehydration after back navigation", () => {
    expect(
      step1ValuesFromProfile({
        name: "Arjun",
        age: 32,
        firmName: "Sky Homes",
      }),
    ).toEqual({
      name: "Arjun",
      age: 32,
      firmName: "Sky Homes",
      stepCompleted: 1,
    });
  });

  it("keeps empty name and null firmName when unset", () => {
    expect(
      step1ValuesFromProfile({
        name: "  ",
        age: null,
        firmName: null,
      }),
    ).toEqual({
      name: "",
      age: undefined,
      firmName: null,
      stepCompleted: 1,
    });
  });
});

describe("profileHasStep1Data", () => {
  it("is false for null / empty profile", () => {
    expect(profileHasStep1Data(null)).toBe(false);
    expect(
      profileHasStep1Data({ name: "", age: null, firmName: null }),
    ).toBe(false);
  });

  it("is true when firmName alone was saved (optional field bug repro)", () => {
    expect(
      profileHasStep1Data({
        name: "Arjun",
        age: 32,
        firmName: "Sky Homes",
      }),
    ).toBe(true);
    expect(
      profileHasStep1Data({
        name: "Arjun",
        age: 32,
        firmName: null,
      }),
    ).toBe(true);
  });
});
