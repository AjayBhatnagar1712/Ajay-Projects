import { describe, expect, it } from "vitest";
import {
  bankAccountLast4,
  buildRazorpayAccountPayload,
  razorpayReferenceId,
} from "./paymentOnboardHandler.js";

const PHONE = "8860826738";

describe("razorpayReferenceId", () => {
  it("returns exactly 20 lowercase-alphanumeric chars with role + phone prefix", () => {
    const id = razorpayReferenceId(PHONE, "owner");
    expect(id).toHaveLength(20);
    expect(id).toMatch(/^o8860826738[0-9a-z]{9}$/);
  });

  it("maps owner/tenant/broker to o/t/b", () => {
    expect(razorpayReferenceId(PHONE, "owner")[0]).toBe("o");
    expect(razorpayReferenceId(PHONE, "tenant")[0]).toBe("t");
    expect(razorpayReferenceId(PHONE, "broker")[0]).toBe("b");
  });

  it("normalizes phone to last 10 digits", () => {
    const id = razorpayReferenceId("+91-8860-826-738", "owner");
    expect(id.slice(1, 11)).toBe(PHONE);
    expect(id).toHaveLength(20);
  });

  it("is unique per call (non-deterministic)", () => {
    const a = razorpayReferenceId(PHONE, "owner");
    const b = razorpayReferenceId(PHONE, "owner");
    expect(a).not.toBe(b);
  });

  it("throws when phone does not normalize to 10 digits", () => {
    expect(() => razorpayReferenceId("12345", "owner")).toThrow(
      /exactly 10 digits/,
    );
    expect(() => razorpayReferenceId("", "owner")).toThrow(/exactly 10 digits/);
  });

  it("throws for unsupported roles", () => {
    expect(() => razorpayReferenceId(PHONE, "admin")).toThrow(/Unsupported role/);
  });

  it("never returns the legacy tk-{phone}-{role} format", () => {
    const id = razorpayReferenceId(PHONE, "owner");
    expect(id).not.toMatch(/^tk-/);
    expect(id).not.toBe(`tk-${PHONE}-owner`);
  });
});

describe("bankAccountLast4", () => {
  it("returns the last four digits", () => {
    expect(bankAccountLast4("12340251")).toBe("0251");
    expect(bankAccountLast4("0000251")).toBe("0251");
  });

  it("strips non-digits", () => {
    expect(bankAccountLast4("1234-0251")).toBe("0251");
  });

  it("returns null when fewer than four digits", () => {
    expect(bankAccountLast4(null)).toBeNull();
    expect(bankAccountLast4("")).toBeNull();
    expect(bankAccountLast4("12")).toBeNull();
  });
});

describe("buildRazorpayAccountPayload", () => {
  it("sends every required registered address field", () => {
    const payload = buildRazorpayAccountPayload(
      {
        phone: "9000000030",
        role: "broker",
        legalName: "Ajeeth Test Broker",
        email: "broker@example.com",
        registeredAddress: {
          street1: "12 Residency Road",
          street2: "Indiranagar",
          city: "Bengaluru",
          state: "KARNATAKA",
          postalCode: "560025",
          country: "IN",
        },
      },
      "b9000000030abcdefghi",
    );

    expect(payload.profile.addresses.registered).toEqual({
      street1: "12 Residency Road",
      street2: "Indiranagar",
      city: "Bengaluru",
      state: "KARNATAKA",
      postal_code: "560025",
      country: "IN",
    });
  });
});
