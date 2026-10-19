import { describe, expect, it } from "vitest";
import {
  buildTenantRentPaymentReceipt,
  buildTenantRentPaymentsSnapshot,
  findRentPaymentHistoryRow,
  formatPaiseToInr,
  formatPaymentMethodLabel,
  formatRentPeriodLabel,
  mapTenantPaymentRowToHistoryRow,
} from "./tenantRentPayments";
import type { TenantWorkspaceRecord } from "./tenantWorkspace";

const workspace: TenantWorkspaceRecord = {
  phone: "9876543210",
  tenantName: "Meena",
  propertyLabel: "Flat 401",
  monthlyRent: "13000",
  agreementSnapshot: {
    ownerName: "Anita",
    tenantName: "Meena",
    propertyAddress: "Madhapur",
    leaseStartDate: "2025-09-05",
    monthlyRent: "13000",
    securityDeposit: "39000",
    rentDueDay: "5",
    lockInPeriod: "11 months",
    noticePeriod: "2 months",
  },
  updatedAt: Date.now(),
};

describe("tenantRentPayments", () => {
  it("builds monthly statement from workspace rent without mock history", () => {
    const snapshot = buildTenantRentPaymentsSnapshot(workspace);
    expect(snapshot.monthlyRentAmountLabel).toBe("₹13,000");
    expect(snapshot.statusLabel).toMatch(/^Pending \(/);
    expect(snapshot.dueByLabel).toContain("Due by");
    expect(snapshot.currentDueDateLabel).toMatch(/[A-Za-z]+ \d{1,2}, \d{4}/);
    expect(snapshot.minimumExtensionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(snapshot).not.toHaveProperty("history");
    expect(snapshot).not.toHaveProperty("breakdown");
  });

  it("maps API payment rows into history labels", () => {
    const row = mapTenantPaymentRowToHistoryRow({
      id: "rp_1",
      rentPeriod: "2026-07",
      amountPaise: "500",
      status: "paid",
      paymentMethod: "upi",
      paidAt: "2026-07-13T05:26:33.000Z",
      createdAt: "2026-07-13T05:23:43.000Z",
    });

    expect(formatRentPeriodLabel("2026-07")).toBe("Jul 2026");
    expect(formatPaiseToInr("500")).toBe("₹5");
    expect(formatPaiseToInr("123450")).toBe("₹1,234.50");
    expect(formatPaiseToInr("not-a-number")).toBe("—");
    expect(formatPaymentMethodLabel("upi")).toBe("UPI");
    expect(formatPaymentMethodLabel(null)).toBe("—");
    expect(row.monthLabel).toBe("Jul 2026");
    expect(row.amountLabel).toBe("₹5");
    expect(row.paymentMode).toBe("UPI");
    expect(row.statusLabel).toBe("Paid");
    expect(row.paidOnLabel).toContain("2026");
  });

  it("builds receipt detail from a history row", () => {
    const rows = [
      mapTenantPaymentRowToHistoryRow({
        id: "rp_1",
        rentPeriod: "2026-07",
        amountPaise: "1300000",
        status: "paid",
        paymentMethod: "netbanking",
        paidAt: "2026-07-01T10:00:00.000Z",
        createdAt: "2026-07-01T09:00:00.000Z",
      }),
    ];
    const row = findRentPaymentHistoryRow(rows, "rp_1");
    expect(row).toBeDefined();
    if (!row) return;

    const receipt = buildTenantRentPaymentReceipt(workspace, row);
    expect(receipt.amountPaidLabel).toBe("₹13,000");
    expect(receipt.monthLabel).toBe("Jul 2026");
    expect(receipt.paymentMode).toBe("Net Banking");
    expect(receipt.transactionId).toMatch(/^TXN22026/);
    expect(receipt.fromLabel).toBe("Meena");
    expect(receipt.toLabel).toBe("Anita");
    expect(receipt.propertyLabel).toBe("Flat 401");
  });
});
