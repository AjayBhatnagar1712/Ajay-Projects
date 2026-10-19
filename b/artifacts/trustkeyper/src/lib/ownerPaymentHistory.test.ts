import { describe, expect, it } from "vitest";
import { formatPaiseToInr } from "./formatMoney";
import {
  computeCurrentRentPeriod,
  summarizeOwnerSettlements,
  type OwnerPaymentRow,
} from "./ownerPaymentHistory";

function row(partial: Partial<OwnerPaymentRow> & Pick<OwnerPaymentRow, "id">): OwnerPaymentRow {
  return {
    rentPeriod: "2026-07",
    amountPaise: "500",
    ownerSettlementPaise: "500",
    commissionPaise: "0",
    status: "paid",
    paymentMethod: "upi",
    paidAt: "2026-07-13T05:26:33.000Z",
    createdAt: "2026-07-13T05:23:43.000Z",
    transferFailedAt: null,
    ...partial,
  };
}

describe("formatPaiseToInr", () => {
  it("formats whole rupees and paise without float drift", () => {
    expect(formatPaiseToInr("500")).toBe("₹5");
    expect(formatPaiseToInr("123450")).toBe("₹1,234.50");
    expect(formatPaiseToInr("not-a-number")).toBe("—");
  });
});

describe("summarizeOwnerSettlements", () => {
  it("sums paid/settled settlements for this month and all-time", () => {
    const now = new Date(2026, 6, 13); // Jul 2026
    const summary = summarizeOwnerSettlements(
      [
        row({ id: "a", rentPeriod: "2026-07", ownerSettlementPaise: "500", status: "paid" }),
        row({ id: "b", rentPeriod: "2026-07", ownerSettlementPaise: "450", status: "settled" }),
        row({ id: "c", rentPeriod: "2026-06", ownerSettlementPaise: "1300000", status: "paid" }),
        row({ id: "d", rentPeriod: "2026-07", ownerSettlementPaise: "999", status: "created" }),
      ],
      now,
    );

    expect(computeCurrentRentPeriod(now)).toBe("2026-07");
    expect(summary.thisMonthPaise).toBe(950);
    expect(summary.allTimePaise).toBe(1_300_950);
  });
});
