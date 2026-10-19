import { describe, expect, it } from "vitest";
import {
  composePartyPhone,
  formatPartyPhoneDisplay,
  normalizePartyPhoneE164,
  partyPhoneBlurError,
  partyPhoneChangeError,
  PARTY_PHONE_REQUIRED_ERROR,
  partyPhoneUniqueKey,
  splitPartyPhone,
} from "./partyPhone";

describe("normalizePartyPhoneE164", () => {
  it("normalizes India numbers to E.164", () => {
    expect(normalizePartyPhoneE164("9876543210")).toBe("+919876543210");
    expect(normalizePartyPhoneE164("+91 98765 43210")).toBe("+919876543210");
  });

  it("accepts US and UK E.164", () => {
    expect(normalizePartyPhoneE164("+14155552671")).toBe("+14155552671");
    expect(normalizePartyPhoneE164(composePartyPhone("GB", "7911123456"))).toBe(
      "+447911123456",
    );
  });

  it("returns null for incomplete or invalid", () => {
    expect(normalizePartyPhoneE164("98765")).toBeNull();
    expect(normalizePartyPhoneE164("+1415555")).toBeNull();
    expect(normalizePartyPhoneE164("")).toBeNull();
  });

  it("returns null for non-string runtime values without throwing", () => {
    // Zod leaves `{ status: "aborted" }` on failed transforms; RHF may also
    // pass numbers from other fields if wiring is wrong.
    expect(normalizePartyPhoneE164(undefined)).toBeNull();
    expect(normalizePartyPhoneE164(null)).toBeNull();
    expect(
      normalizePartyPhoneE164({ status: "aborted" } as unknown as string),
    ).toBeNull();
    expect(normalizePartyPhoneE164(9876543210 as unknown as string)).toBeNull();
  });
});

describe("composePartyPhone / splitPartyPhone", () => {
  it("round-trips a valid US number", () => {
    const stored = composePartyPhone("US", "4155552671");
    expect(stored).toBe("+14155552671");
    expect(splitPartyPhone(stored)).toEqual({
      country: "US",
      national: "4155552671",
    });
  });

  it("keeps provisional US mid-edit under the hinted country", () => {
    const provisional = composePartyPhone("US", "415555");
    expect(provisional).toBe("+1415555");
    expect(splitPartyPhone(provisional, "US")).toEqual({
      country: "US",
      national: "415555",
    });
  });
});

describe("partyPhoneBlurError", () => {
  it("requires a number when blank on blur", () => {
    expect(partyPhoneBlurError("", "IN")).toBe(PARTY_PHONE_REQUIRED_ERROR);
  });

  it("returns null for a valid number", () => {
    expect(partyPhoneBlurError("9876543210", "IN")).toBeNull();
    expect(partyPhoneBlurError("4155552671", "US")).toBeNull();
  });

  it("returns an error for incomplete national numbers", () => {
    expect(partyPhoneBlurError("98765", "IN")).toBeTruthy();
    expect(partyPhoneBlurError("415555", "US")).toBeTruthy();
  });
});

describe("partyPhoneChangeError", () => {
  it("stays quiet while under country digit length", () => {
    expect(partyPhoneChangeError("", "IN")).toBeNull();
    expect(partyPhoneChangeError("98765", "IN")).toBeNull();
  });

  it("errors once length is reached and the number is invalid", () => {
    expect(partyPhoneChangeError("0000000000", "IN")).toBeTruthy();
  });

  it("accepts a valid full national number", () => {
    expect(partyPhoneChangeError("9876543210", "IN")).toBeNull();
  });
});

describe("formatPartyPhoneDisplay", () => {
  it("formats internationally", () => {
    expect(formatPartyPhoneDisplay("+919876543210")).toContain("91");
    expect(formatPartyPhoneDisplay("+14155552671")).toContain("1");
  });
});

describe("partyPhoneUniqueKey", () => {
  it("collapses formatted India variants to one key", () => {
    expect(partyPhoneUniqueKey("9876543210")).toBe(
      partyPhoneUniqueKey("+91 98765 43210"),
    );
  });

  it("returns empty string for Zod aborted / non-string phones", () => {
    expect(
      partyPhoneUniqueKey({ status: "aborted" } as unknown as string),
    ).toBe("");
    expect(partyPhoneUniqueKey(9876543210 as unknown as string)).toBe("");
  });
});
