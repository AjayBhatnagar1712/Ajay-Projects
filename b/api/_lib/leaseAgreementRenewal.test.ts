import { describe, expect, it } from "vitest";
import { calculateRenewalDates } from "./leaseAgreementRenewal.js";

describe("calculateRenewalDates", () => {
  it("renews Aman's eleven-month agreement from August 11", () => {
    expect(calculateRenewalDates({
      effectiveDate: "2026-09-10", endDate: "2027-08-10", durationMonths: 11,
    }, "2027-08-01")).toEqual({
      executionDate: "2027-08-01", effectiveDate: "2027-08-11",
      endDate: "2028-07-11", durationMonths: 11,
    });
  });
  it("starts the renewal the day after the original end when that date is future", () => {
    expect(
      calculateRenewalDates(
        {
          effectiveDate: "2026-08-01",
          endDate: "2027-07-31",
          durationMonths: 11,
        },
        "2027-07-20",
      ),
    ).toEqual({
      executionDate: "2027-07-20",
      effectiveDate: "2027-08-01",
      endDate: "2028-07-31",
      durationMonths: 11,
    });
  });

  it("uses today as the start when the prior agreement already expired", () => {
    expect(
      calculateRenewalDates(
        {
          effectiveDate: "2025-08-15",
          endDate: "2026-08-14",
          durationMonths: 11,
        },
        "2026-09-01",
      ),
    ).toEqual({
      executionDate: "2026-09-01",
      effectiveDate: "2026-09-01",
      endDate: "2027-08-31",
      durationMonths: 11,
    });
  });

  it("preserves exact-anniversary calendar duration", () => {
    expect(
      calculateRenewalDates(
        {
          effectiveDate: "2027-03-01",
          endDate: "2028-03-01",
          durationMonths: 12,
        },
        "2028-02-20",
      ),
    ).toEqual({
      executionDate: "2028-02-20",
      effectiveDate: "2028-03-02",
      endDate: "2029-03-02",
      durationMonths: 12,
    });
  });

  it("leaves dates blank when the source range is invalid", () => {
    expect(
      calculateRenewalDates(
        {
          effectiveDate: "2026-08-15",
          endDate: "2026-08-15",
          durationMonths: 12,
        },
        "2026-08-17",
      ),
    ).toEqual({
      executionDate: "2026-08-17",
      effectiveDate: null,
      endDate: null,
      durationMonths: 12,
    });
  });
});
