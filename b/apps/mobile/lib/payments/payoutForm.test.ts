import { describe, expect, it } from "vitest";
import {
  ADDRESS_LINE_1_REQUIRED_ERROR,
  ADDRESS_LINE_2_REQUIRED_ERROR,
  ACCOUNT_FORMAT_ERROR,
  ACCOUNT_REQUIRED_ERROR,
  bankAccountBlurError,
  BENEFICIARY_NAME_REQUIRED_ERROR,
  brokerPayoutFormSchema,
  CITY_REQUIRED_ERROR,
  EMAIL_FORMAT_ERROR,
  EMAIL_REQUIRED_ERROR,
  IFSC_FORMAT_ERROR,
  IFSC_REQUIRED_ERROR,
  ifscBlurError,
  LEGAL_NAME_MIN_ERROR,
  LEGAL_NAME_REQUIRED_ERROR,
  legalNameBlurError,
  PAN_FORMAT_ERROR,
  PAN_REQUIRED_ERROR,
  panBlurError,
  POSTAL_CODE_FORMAT_ERROR,
  POSTAL_CODE_REQUIRED_ERROR,
  payoutEmailBlurError,
  STATE_REQUIRED_ERROR,
} from "./payoutForm";

describe("brokerPayoutFormSchema", () => {
  const valid = {
    legalName: "Aman Rao",
    pan: "ABCPE1234F",
    bankBeneficiaryName: "Aman Rao",
    bankAccountNumber: "12340251",
    bankIfsc: "HDFC0001234",
    email: "aman@example.com",
    addressLine1: "12 Residency Road",
    addressLine2: "Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    postalCode: "560025",
  };

  it("accepts a complete valid payload and uppercases PAN/IFSC", () => {
    const parsed = brokerPayoutFormSchema.parse({
      ...valid,
      pan: "abcpe1234f",
      bankIfsc: "hdfc0001234",
    });
    expect(parsed.pan).toBe("ABCPE1234F");
    expect(parsed.bankIfsc).toBe("HDFC0001234");
    expect(parsed.state).toBe("KARNATAKA");
  });

  it("rejects blank mandatory fields", () => {
    const result = brokerPayoutFormSchema.safeParse({
      legalName: "  ",
      pan: "",
      bankBeneficiaryName: "",
      bankAccountNumber: "",
      bankIfsc: "",
      email: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const messages = result.error.issues.map((issue) => issue.message);
    expect(messages).toContain(LEGAL_NAME_REQUIRED_ERROR);
    expect(messages).toContain(PAN_REQUIRED_ERROR);
    expect(messages).toContain(BENEFICIARY_NAME_REQUIRED_ERROR);
    expect(messages).toContain(ACCOUNT_REQUIRED_ERROR);
    expect(messages).toContain(IFSC_REQUIRED_ERROR);
    expect(messages).toContain(EMAIL_REQUIRED_ERROR);
    expect(messages).toContain(ADDRESS_LINE_1_REQUIRED_ERROR);
    expect(messages).toContain(ADDRESS_LINE_2_REQUIRED_ERROR);
    expect(messages).toContain(CITY_REQUIRED_ERROR);
    expect(messages).toContain(STATE_REQUIRED_ERROR);
    expect(messages).toContain(POSTAL_CODE_REQUIRED_ERROR);
  });

  it("rejects a company PAN (4th character not P)", () => {
    const result = brokerPayoutFormSchema.safeParse({
      ...valid,
      pan: "ABCDE1234F",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe(PAN_FORMAT_ERROR);
  });

  it("rejects an invalid IFSC", () => {
    const result = brokerPayoutFormSchema.safeParse({
      ...valid,
      bankIfsc: "HDFC1234567",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe(IFSC_FORMAT_ERROR);
  });

  it("requires a valid PIN", () => {
    expect(brokerPayoutFormSchema.parse(valid).postalCode).toBe("560025");
    const result = brokerPayoutFormSchema.safeParse({
      ...valid,
      postalCode: "56002",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe(POSTAL_CODE_FORMAT_ERROR);
  });
});

describe("blur validators", () => {
  it("legal name: blank then min length", () => {
    expect(legalNameBlurError("")).toBe(LEGAL_NAME_REQUIRED_ERROR);
    expect(legalNameBlurError("Ama")).toBe(LEGAL_NAME_MIN_ERROR);
    expect(legalNameBlurError("Aman")).toBeNull();
  });

  it("PAN: blank then format", () => {
    expect(panBlurError("")).toBe(PAN_REQUIRED_ERROR);
    expect(panBlurError("ABCDE1234F")).toBe(PAN_FORMAT_ERROR);
    expect(panBlurError("abcpe1234f")).toBeNull();
  });

  it("account: blank then length", () => {
    expect(bankAccountBlurError("")).toBe(ACCOUNT_REQUIRED_ERROR);
    expect(bankAccountBlurError("1234")).toBe(ACCOUNT_FORMAT_ERROR);
    expect(bankAccountBlurError("12345")).toBeNull();
  });

  it("IFSC: blank then format", () => {
    expect(ifscBlurError("")).toBe(IFSC_REQUIRED_ERROR);
    expect(ifscBlurError("HDFC")).toBe(IFSC_FORMAT_ERROR);
    expect(ifscBlurError("hdfc0001234")).toBeNull();
  });

  it("email: blank then format", () => {
    expect(payoutEmailBlurError("")).toBe(EMAIL_REQUIRED_ERROR);
    expect(payoutEmailBlurError("not-an-email")).toBe(EMAIL_FORMAT_ERROR);
    expect(payoutEmailBlurError("aman@example.com")).toBeNull();
  });
});
