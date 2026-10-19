import { describe, expect, it } from "vitest";
import {
  partyPhoneBlurError,
  partyPhoneChangeError,
  PARTY_PHONE_FORMAT_ERROR,
  PARTY_PHONE_REQUIRED_ERROR,
} from "@workspace/api-schemas";
import {
  AADHAAR_FORMAT_ERROR,
  AADHAAR_INVALID_ERROR,
  AADHAAR_REQUIRED_ERROR,
  ADDRESS_REQUIRED_ERROR,
  AGE_ERROR_MESSAGE,
  AGE_REQUIRED_ERROR,
  aadhaarBlurError,
  aadhaarChangeError,
  addressBlurError,
  ageBlurError,
  EMAIL_FORMAT_ERROR,
  EMAIL_REQUIRED_ERROR,
  emailBlurError,
  NAME_REQUIRED_ERROR,
  nameBlurError,
} from "./partyFieldValidation";

describe("nameBlurError", () => {
  it("requires a non-blank name on blur", () => {
    expect(nameBlurError("")).toBe(NAME_REQUIRED_ERROR);
    expect(nameBlurError("   ")).toBe(NAME_REQUIRED_ERROR);
    expect(nameBlurError(null)).toBe(NAME_REQUIRED_ERROR);
  });

  it("accepts a filled name", () => {
    expect(nameBlurError("Priya")).toBeNull();
  });
});

describe("addressBlurError", () => {
  it("requires a non-blank address on blur", () => {
    expect(addressBlurError("")).toBe(ADDRESS_REQUIRED_ERROR);
    expect(addressBlurError(null)).toBe(ADDRESS_REQUIRED_ERROR);
  });

  it("accepts a filled address", () => {
    expect(addressBlurError("12 MG Road")).toBeNull();
  });
});

describe("aadhaarBlurError / aadhaarChangeError", () => {
  it("requires Aadhaar on blank blur", () => {
    expect(aadhaarBlurError("")).toBe(AADHAAR_REQUIRED_ERROR);
    expect(aadhaarBlurError(null)).toBe(AADHAAR_REQUIRED_ERROR);
  });

  it("rejects incomplete digit strings on blur", () => {
    expect(aadhaarBlurError("1234")).toBe(AADHAAR_FORMAT_ERROR);
  });

  it("rejects 12 digits that fail Verhoeff (not a live UIDAI check)", () => {
    expect(aadhaarBlurError("123456789012")).toBe(AADHAAR_INVALID_ERROR);
    expect(aadhaarChangeError("123456789012")).toBe(AADHAAR_INVALID_ERROR);
  });

  it("accepts a Verhoeff-valid Aadhaar", () => {
    expect(aadhaarBlurError("967132807649")).toBeNull();
    expect(aadhaarChangeError("967132807649")).toBeNull();
  });

  it("stays quiet on change while under 12 digits", () => {
    expect(aadhaarChangeError("96713280764")).toBeNull();
    expect(aadhaarChangeError("")).toBeNull();
  });
});

describe("emailBlurError", () => {
  it("requires email on blank blur (only this field — not siblings)", () => {
    expect(emailBlurError("")).toBe(EMAIL_REQUIRED_ERROR);
    expect(emailBlurError(null)).toBe(EMAIL_REQUIRED_ERROR);
  });

  it("returns an error for invalid format", () => {
    expect(emailBlurError("not-an-email")).toBe(EMAIL_FORMAT_ERROR);
    expect(emailBlurError("a@b")).toBe(EMAIL_FORMAT_ERROR);
  });

  it("returns null for a valid email", () => {
    expect(emailBlurError("owner@example.com")).toBeNull();
  });
});

describe("ageBlurError", () => {
  it("requires age on blank blur", () => {
    expect(ageBlurError(null)).toBe(AGE_REQUIRED_ERROR);
    expect(ageBlurError(undefined)).toBe(AGE_REQUIRED_ERROR);
  });

  it("returns the product message outside 18–120", () => {
    expect(ageBlurError(17)).toBe(AGE_ERROR_MESSAGE);
    expect(ageBlurError(3000)).toBe(AGE_ERROR_MESSAGE);
    expect(ageBlurError(121)).toBe(AGE_ERROR_MESSAGE);
  });

  it("returns null for a valid age", () => {
    expect(ageBlurError(18)).toBeNull();
    expect(ageBlurError(45)).toBeNull();
    expect(ageBlurError(120)).toBeNull();
  });
});

describe("partyPhoneChangeError", () => {
  it("stays quiet while typing under country length", () => {
    expect(partyPhoneChangeError("98765", "IN")).toBeNull();
    expect(partyPhoneChangeError("", "IN")).toBeNull();
  });

  it("flags invalid numbers once country length is reached", () => {
    expect(partyPhoneChangeError("0000000000", "IN")).toBe(
      PARTY_PHONE_FORMAT_ERROR,
    );
  });

  it("clears when the number is valid for the country", () => {
    expect(partyPhoneChangeError("9876543210", "IN")).toBeNull();
  });
});

describe("party required blur helpers are field-scoped", () => {
  it("blurring an empty name does not imply sibling messages", () => {
    expect(nameBlurError("")).toBe(NAME_REQUIRED_ERROR);
    expect(ageBlurError(null)).toBe(AGE_REQUIRED_ERROR);
    expect(addressBlurError("")).toBe(ADDRESS_REQUIRED_ERROR);
    expect(aadhaarBlurError("")).toBe(AADHAAR_REQUIRED_ERROR);
    expect(emailBlurError("")).toBe(EMAIL_REQUIRED_ERROR);
    expect(partyPhoneBlurError("", "IN")).toBe(PARTY_PHONE_REQUIRED_ERROR);
  });
});
