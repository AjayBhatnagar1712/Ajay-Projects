import { describe, expect, it } from "vitest";
import {
  buildActiveTenantDashboardSnapshot,
  isActiveTenantDashboardStage,
} from "./tenantActiveDashboard";
import type { TenantWorkspaceRecord } from "./tenantWorkspace";

const baseWorkspace: TenantWorkspaceRecord = {
  phone: "9876543210",
  tenantName: "Meena",
  propertyId: "prop-1",
  propertyLabel: "Flat 401, Ayyappa Society",
  propertyAddress: "Flat 401, Ayyappa Society, Madhapur, Hyderabad",
  propertyType: "Single Room in 3 BHK Apartment",
  monthlyRent: "13000",
  securityDeposit: "39000",
  preSigningEscrowType: "security_deposit",
  escrowPaymentStatus: "paid",
  agreementSnapshot: {
    ownerName: "Anita Owner",
    tenantName: "Meena",
    propertyAddress: "Flat 401, Ayyappa Society, Madhapur, Hyderabad",
    leaseStartDate: "2025-09-05",
    leaseEndDate: "2026-08-05",
    monthlyRent: "13000",
    securityDeposit: "39000",
    rentDueDay: "1",
    lockInPeriod: "11 months",
    noticePeriod: "2 months",
  },
  updatedAt: Date.now(),
};

describe("tenantActiveDashboard", () => {
  it("detects post-move-in dashboard stages", () => {
    expect(isActiveTenantDashboardStage("active_tenant")).toBe(true);
    expect(isActiveTenantDashboardStage("move_in_scheduled")).toBe(true);
    expect(isActiveTenantDashboardStage("rent_payment_due")).toBe(false);
  });

  it("builds figma-aligned active tenant snapshot from workspace", () => {
    const snapshot = buildActiveTenantDashboardSnapshot(baseWorkspace);
    expect(snapshot.paymentSuccessMessage).toContain("rent and security deposit");
    expect(snapshot.propertyTitle).toContain("Flat 401");
    expect(snapshot.propertySubtitle).toBe("Single Room in 3 BHK Apartment");
    expect(snapshot.leaseMonthLabel).toContain("Month");
    expect(snapshot.leaseMonthLabel).toContain("of 11");
    expect(snapshot.nextRentAmountLabel).toBe("₹13,000");
    expect(snapshot.nextRentDueLabel).toContain("Due on");
  });
});
