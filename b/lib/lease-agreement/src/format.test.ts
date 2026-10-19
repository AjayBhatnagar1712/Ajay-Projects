import { describe, expect, it } from "vitest";
import { toWinAnsiSafe } from "./format.js";
import { generateLeaseAgreementPdf } from "./generatePdf.js";
import type { LeaseAgreementPdfInput } from "./types.js";

describe("toWinAnsiSafe", () => {
  it("keeps ASCII and common currency/quote replacements", () => {
    expect(toWinAnsiSafe("Rent ₹1,000 — “ok”")).toBe('Rent Rs.1,000 - "ok"');
  });

  it("strips emoji that previously 500'd PDF preview (WinAnsi encode)", () => {
    // Staging logs: WinAnsi cannot encode "😛" (0x1f61b) on GET …/pdf
    expect(toWinAnsiSafe("Sofa 😛 set")).toBe("Sofa set");
    expect(toWinAnsiSafe("Hello \u{1F61B}")).toBe("Hello");
  });
});

const pdfFixture: LeaseAgreementPdfInput = {
  executionDate: "2026-06-27",
  effectiveDate: "2026-07-01",
  endDate: "2027-06-01",
  executionCity: "Hyderabad",
  durationMonths: 11,
  minStayMonths: 3,
  noticePeriodLicenseeMonths: 2,
  noticePeriodLicensorMonths: 2,
  monthlyRentPaise: 7_789_600,
  securityDepositPaise: 14_000_000,
  rentDueDay: 5,
  propertyAddress: "1 Main Road, Hyderabad",
  areaSqft: 1742,
  facing: "West",
  carParkingCount: 1,
  parties: [
    {
      role: "owner",
      title: "Mr.",
      name: "Owner \u{1F61B} Name",
      age: 36,
      address: "Owner address",
      aadhaar: "9671 3280 7649",
      pan: "ANZPJ9269Q",
      email: "owner@example.com",
      isPrimary: true,
      sortOrder: 0,
    },
    {
      role: "tenant",
      title: "Mr.",
      name: "Tenant Name",
      age: 25,
      address: "Tenant address",
      aadhaar: "5843 5053 8806",
      pan: null,
      email: "tenant@example.com",
      isPrimary: true,
      sortOrder: 1,
    },
  ],
  inventoryItems: [
    {
      description: "Sofa set \u{1F61B} living room",
      quantity: 2,
      sortOrder: 0,
    },
  ],
};

describe("generateLeaseAgreementPdf", () => {
  it("does not throw when party/inventory text contains emoji", async () => {
    const result = await generateLeaseAgreementPdf(pdfFixture);
    expect(result.bytes.byteLength).toBeGreaterThan(1000);
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
  });
});
