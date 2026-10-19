import { describe, expect, it } from "vitest";
import { buildLeaseAgreementPdfInput } from "./leaseAgreementPdf.js";

function agreement(overrides: Partial<Parameters<typeof buildLeaseAgreementPdfInput>[0]> = {}) {
  return {
    execution_date: "2026-06-27",
    effective_date: "2026-07-01",
    end_date: "2027-06-01",
    execution_city: "HYDERABAD",
    duration_months: 11,
    min_stay_months: 6,
    notice_period_licensee_months: 2,
    notice_period_licensor_months: 2,
    monthly_rent_paise: 6_000_000,
    security_deposit_paise: 12_000_000,
    rent_due_day: 5,
    property_address: "1 Main Road, Hyderabad",
    area_sqft: "1200",
    facing: "East",
    car_parking_count: 1,
    ...overrides,
  };
}

function party(
  overrides: Partial<Parameters<typeof buildLeaseAgreementPdfInput>[1][number]> = {},
) {
  return {
    role: "owner",
    name: "Aman Rao",
    title: "Mr.",
    age: 42,
    address: "1 Main Road, Hyderabad",
    aadhaar: "123412341234",
    pan: "ABCDE1234F",
    email: "aman@example.com",
    is_primary: true,
    sort_order: 0,
    ...overrides,
  };
}

describe("buildLeaseAgreementPdfInput", () => {
  it("maps a complete draft into the generator DTO", () => {
    const result = buildLeaseAgreementPdfInput(
      agreement(),
      [
        party(),
        party({
          role: "tenant",
          name: "Priya Shah",
          email: "priya@example.com",
          pan: null,
          is_primary: true,
          sort_order: 1,
        }),
      ],
      [{ description: "Fan - good condition", quantity: 3, sort_order: 0 }],
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful PDF DTO build");
    }

    expect(result.input.propertyAddress).toBe("1 Main Road, Hyderabad");
    expect(result.input.areaSqft).toBe(1200);
    expect(result.input.parties).toHaveLength(2);
    expect(result.input.inventoryItems[0]?.description).toContain("Fan");
    expect(result.input.inventoryItems[0]?.quantity).toBe(3);
  });

  it("returns a helpful validation error when owner/tenant set is incomplete", () => {
    const result = buildLeaseAgreementPdfInput(agreement(), [party()], []);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected missing-party validation");
    }

    expect(result.error).toContain("Add at least one owner and one tenant before previewing");
  });

  it("returns a helpful validation error when commercial terms are missing", () => {
    const result = buildLeaseAgreementPdfInput(
      agreement({
        monthly_rent_paise: null,
        security_deposit_paise: null,
        execution_city: null,
      }),
      [
        party(),
        party({
          role: "tenant",
          name: "Priya Shah",
          email: "priya@example.com",
          pan: null,
          is_primary: true,
          sort_order: 1,
        }),
      ],
      [],
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected missing-term validation");
    }

    expect(result.error).toContain("Add execution city");
    expect(result.error).toContain("Add monthly rent");
    expect(result.error).toContain("Add security deposit");
  });

  it("returns a helpful validation error when signer identity fields are missing", () => {
    const result = buildLeaseAgreementPdfInput(
      agreement(),
      [
        party({ title: null, aadhaar: null }),
        party({
          role: "tenant",
          name: "Priya Shah",
          title: null,
          age: null,
          address: null,
          aadhaar: null,
          email: null,
          pan: null,
          is_primary: true,
          sort_order: 1,
        }),
      ],
      [],
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected missing-signer-details validation");
    }

    expect(result.error).toContain("Add title and Aadhaar for Aman Rao (owner)");
    expect(result.error).toContain("Add title, age, address, Aadhaar, and email for Priya Shah (tenant)");
  });
});
