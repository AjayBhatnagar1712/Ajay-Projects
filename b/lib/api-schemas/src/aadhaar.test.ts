import { describe, expect, it } from "vitest";
import {
  AADHAAR_INVALID_ERROR,
  isValidAadhaarNumber,
  normalizeAadhaarDigits,
  verhoeffChecksumOk,
} from "./aadhaar";

describe("normalizeAadhaarDigits", () => {
  it("keeps digits only and caps at 12", () => {
    expect(normalizeAadhaarDigits("12-34 5678 9012 999")).toBe("123456789012");
    expect(normalizeAadhaarDigits("abc")).toBe("");
  });
});

describe("verhoeffChecksumOk", () => {
  it("accepts known Verhoeff-valid 12-digit strings", () => {
    expect(verhoeffChecksumOk("967132807649")).toBe(true);
    expect(verhoeffChecksumOk("234123412346")).toBe(true);
  });

  it("rejects obvious non-checksum sequences", () => {
    expect(verhoeffChecksumOk("123456789012")).toBe(false);
    expect(verhoeffChecksumOk("222222222222")).toBe(false);
  });
});

describe("isValidAadhaarNumber", () => {
  it("requires 12 digits, first digit 2–9, and Verhoeff checksum", () => {
    expect(isValidAadhaarNumber("9671 3280 7649")).toBe(true);
    expect(isValidAadhaarNumber("123456789012")).toBe(false);
    expect(isValidAadhaarNumber("067132807649")).toBe(false);
    expect(isValidAadhaarNumber("96713280764")).toBe(false);
  });

  it("documents invalid copy constant for UI", () => {
    expect(AADHAAR_INVALID_ERROR).toBe("Invalid Aadhaar number");
  });
});
