import { describe, expect, it } from "vitest";
import { rentPeriodOverlapsAgreement } from "./leaseAgreementPayability.js";

describe("rentPeriodOverlapsAgreement", () => {
  it("matches a rent period that overlaps the lease range", () => {
    expect(rentPeriodOverlapsAgreement("2026-08", "2026-08-01", "2027-07-31")).toBe(true);
  });

  it("rejects a rent period after the lease range ended", () => {
    expect(rentPeriodOverlapsAgreement("2026-08", "2025-08-01", "2026-07-31")).toBe(false);
  });

  it("rejects a rent period before the lease range starts", () => {
    expect(rentPeriodOverlapsAgreement("2026-07", "2026-08-01", "2027-07-31")).toBe(false);
  });

  it("rejects missing or invalid agreement dates", () => {
    expect(rentPeriodOverlapsAgreement("2026-08", null, "2027-07-31")).toBe(false);
    expect(rentPeriodOverlapsAgreement("2026-08", "2026-08-01", null)).toBe(false);
    expect(rentPeriodOverlapsAgreement("2026-08", "2026-08-01", "bad-date")).toBe(false);
  });
});
