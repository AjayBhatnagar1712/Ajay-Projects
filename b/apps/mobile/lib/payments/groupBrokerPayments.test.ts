import { describe, expect, it } from "vitest";
import type { BrokerPaymentHistoryItem } from "@/lib/api/client";
import {
  formatConsultancyRupees,
  formatPaymentMonthTitle,
  groupBrokerPaymentsByMonth,
  paymentPropertyLabel,
  thisMonthTotalPaise,
} from "./groupBrokerPayments";

function payment(
  overrides: Partial<BrokerPaymentHistoryItem> & Pick<BrokerPaymentHistoryItem, "id">,
): BrokerPaymentHistoryItem {
  return {
    agreementId: "agr_1",
    amountPaise: 100_00,
    status: "paid",
    paidAt: "2026-08-13T10:00:00.000Z",
    createdAt: "2026-08-13T09:00:00.000Z",
    propertyAddress: "12 MG Road",
    ...overrides,
  };
}

describe("formatConsultancyRupees", () => {
  it("formats whole rupees with Indian grouping", () => {
    expect(formatConsultancyRupees(2_500_000)).toBe("₹25,000");
    expect(formatConsultancyRupees(100)).toBe("₹1");
  });

  it("keeps paise when not a whole rupee", () => {
    expect(formatConsultancyRupees(12_345)).toBe("₹123.45");
  });
});

describe("formatPaymentMonthTitle", () => {
  it("formats YYYY-MM as a long month heading", () => {
    expect(formatPaymentMonthTitle("2026-08")).toBe("August 2026");
  });
});

describe("groupBrokerPaymentsByMonth", () => {
  it("groups newest month first", () => {
    const groups = groupBrokerPaymentsByMonth([
      payment({ id: "a", paidAt: "2026-07-02T00:00:00.000Z" }),
      payment({ id: "b", paidAt: "2026-08-13T00:00:00.000Z" }),
      payment({ id: "c", paidAt: "2026-08-01T00:00:00.000Z" }),
    ]);
    expect(groups.map((g) => g.monthKey)).toEqual(["2026-08", "2026-07"]);
    expect(groups[0]?.payments.map((p) => p.id)).toEqual(["b", "c"]);
    expect(groups[0]?.title).toBe("August 2026");
  });
});

describe("thisMonthTotalPaise", () => {
  it("sums only the current calendar month", () => {
    const now = new Date("2026-08-19T12:00:00.000Z");
    const total = thisMonthTotalPaise(
      [
        payment({ id: "a", amountPaise: 100_00, paidAt: "2026-08-01T00:00:00.000Z" }),
        payment({ id: "b", amountPaise: 50_00, paidAt: "2026-08-18T00:00:00.000Z" }),
        payment({ id: "c", amountPaise: 999_00, paidAt: "2026-07-31T00:00:00.000Z" }),
      ],
      now,
    );
    expect(total).toBe(150_00);
  });
});

describe("paymentPropertyLabel", () => {
  it("prefers the property address, then a short agreement id", () => {
    expect(paymentPropertyLabel(payment({ id: "a" }))).toBe("12 MG Road");
    expect(
      paymentPropertyLabel(
        payment({
          id: "b",
          propertyAddress: "  ",
          agreementId: "abcdef12-3333-4444-5555-666666666666",
        }),
      ),
    ).toBe("Agreement abcdef12");
    expect(
      paymentPropertyLabel(
        payment({ id: "c", propertyAddress: null, agreementId: null }),
      ),
    ).toBe("Consultancy fee");
  });
});
