import { describe, expect, it } from "vitest";
import { emptyParty } from "./flow";
import {
  isPartyFullyComplete,
  normalizeAadhaarInput,
  partyCardLabel,
  partyHasEnteredData,
} from "./partyCardHelpers";

describe("partyHasEnteredData", () => {
  it("is false for a blank party", () => {
    expect(partyHasEnteredData(emptyParty("owner", true))).toBe(false);
  });

  it("is true when name is set", () => {
    expect(
      partyHasEnteredData({ ...emptyParty("tenant", true), name: "Priya" }),
    ).toBe(true);
  });
});

describe("partyCardLabel", () => {
  it("uses New owner / New tenant when name is empty", () => {
    expect(partyCardLabel("owner", 1, "")).toBe("New owner");
    expect(partyCardLabel("tenant", 1, "")).toBe("New tenant");
  });

  it("shows only the name when present", () => {
    expect(partyCardLabel("tenant", 1, "Priya Nair")).toBe("Priya Nair");
  });
});

describe("isPartyFullyComplete", () => {
  it("requires KYC fields and a 12-digit Aadhaar", () => {
    expect(
      isPartyFullyComplete({
        name: "Rajesh",
        phone: "9876543210",
        title: "Mr.",
        age: 52,
        address: "12 MG Road",
        aadhaar: "967132807649",
        email: "rajesh@example.com",
      }),
    ).toBe(true);
    expect(
      isPartyFullyComplete({
        name: "Rajesh",
        phone: "9876543210",
        title: "Mr.",
        age: 52,
        address: "12 MG Road",
        aadhaar: "123",
        email: "rajesh@example.com",
      }),
    ).toBe(false);
  });
});

describe("normalizeAadhaarInput", () => {
  it("strips non-digits and caps at 12", () => {
    expect(normalizeAadhaarInput("12-34 5678 9012 999")).toBe("123456789012");
  });

  it("returns null for empty or non-digit input", () => {
    expect(normalizeAadhaarInput("")).toBeNull();
    expect(normalizeAadhaarInput("abc")).toBeNull();
  });

  it("keeps a partial digit string while typing", () => {
    expect(normalizeAadhaarInput("1234")).toBe("1234");
  });
});
