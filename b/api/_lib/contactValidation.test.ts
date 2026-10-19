import { afterEach, describe, expect, it } from "vitest";
import {
  CONTACT_MESSAGE_MAX_LENGTH,
  ContactRequestSchema,
  isContactHoneypotTriggered,
  validateContactBody,
} from "./contactValidation.js";

const validBody = {
  firstName: "Asha",
  lastName: "Sharma",
  phone: "+91 9876543210",
  email: "asha@example.com",
  role: "property_owner",
  serviceTiming: "within_1_month",
  message: "I need help managing two properties.",
};

describe("ContactRequestSchema", () => {
  it("accepts a valid payload", () => {
    const result = validateContactBody(validBody);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.phone).toBe("9876543210");
    }
  });

  it("requires first and last name", () => {
    expect(validateContactBody({ ...validBody, firstName: "  " }).ok).toBe(false);
    expect(validateContactBody({ ...validBody, lastName: "" }).ok).toBe(false);
  });

  it("requires exactly 10 phone digits after normalization", () => {
    expect(validateContactBody({ ...validBody, phone: "12345" }).ok).toBe(false);
    expect(validateContactBody({ ...validBody, phone: "9876543210" }).ok).toBe(true);
  });

  it("allows empty email and rejects invalid email", () => {
    expect(validateContactBody({ ...validBody, email: "" }).ok).toBe(true);
    expect(validateContactBody({ ...validBody, email: "bad" }).ok).toBe(false);
  });

  it("requires role and serviceTiming enums", () => {
    expect(validateContactBody({ ...validBody, role: "admin" }).ok).toBe(false);
    expect(validateContactBody({ ...validBody, serviceTiming: "soon" }).ok).toBe(false);
  });

  it("requires a non-empty message and caps length", () => {
    expect(validateContactBody({ ...validBody, message: "  " }).ok).toBe(false);
    const tooLong = "a".repeat(CONTACT_MESSAGE_MAX_LENGTH + 1);
    expect(validateContactBody({ ...validBody, message: tooLong }).ok).toBe(false);
    expect(
      ContactRequestSchema.safeParse({ ...validBody, message: "a".repeat(CONTACT_MESSAGE_MAX_LENGTH) })
        .success,
    ).toBe(true);
  });
});

describe("isContactHoneypotTriggered", () => {
  it("returns false for empty or missing website field", () => {
    expect(isContactHoneypotTriggered(validBody)).toBe(false);
    expect(isContactHoneypotTriggered({ ...validBody, website: "" })).toBe(false);
    expect(isContactHoneypotTriggered({ ...validBody, website: "   " })).toBe(false);
  });

  it("returns true when website is non-empty", () => {
    expect(isContactHoneypotTriggered({ ...validBody, website: "https://spam.test" })).toBe(true);
  });
});
