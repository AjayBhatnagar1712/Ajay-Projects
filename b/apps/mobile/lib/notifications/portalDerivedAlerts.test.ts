import { describe, expect, it } from "vitest";
import type { PortalAgreementListItem } from "../api/client";
import {
  buildPortalDerivedAlerts,
  consultancyPaymentStatusLabel,
} from "./portalDerivedAlerts";

const agreement: PortalAgreementListItem = {
  id: "lease",
  status: "signed",
  propertyAddress: "Test home",
  partyRole: "tenant",
  partyName: "Tenant",
  partyApprovalStatus: "approved",
  monthlyRentPaise: 3_000_000,
  securityDepositPaise: null,
  rentDueDay: 5,
  brokerageFeePaise: null,
  brokeragePaid: false,
  effectiveDate: "2026-09-10",
  endDate: "2027-08-10",
  signedAt: null,
  rentPeriod: "2026-09",
  rentPaymentState: "due_soon",
  rentDueDate: "2026-09-15",
  ownerPayout: null,
};

describe("calendar rent alerts", () => {
  it("uses the first partial month's deadline", () => {
    expect(buildPortalDerivedAlerts([agreement])[0]?.message).toContain(
      "2026-09-15",
    );
  });
  it("identifies the overdue billing month even after the calendar rolls over", () => {
    const alert = buildPortalDerivedAlerts([
      { ...agreement, partyRole: "owner", rentPaymentState: "late" },
    ])[0];
    expect(alert?.id).toBe("rent_late:lease:2026-09");
    expect(alert?.message).toContain("2026-09");
  });
  it.each(["paid", "settled", "needs_review", "none"] as const)(
    "does not issue a due reminder for %s",
    (state) => {
      expect(
        buildPortalDerivedAlerts([{ ...agreement, rentPaymentState: state }]),
      ).toEqual([]);
    },
  );
});

describe("consultancyPaymentStatusLabel", () => {
  it.each([
    [null, "Due"],
    ["created", "Payment started"],
    ["paid", "Paid"],
    ["settled", "Settled"],
    ["failed", "Failed — try again"],
  ])("maps %s to %s", (status, expected) => {
    expect(consultancyPaymentStatusLabel(status)).toBe(expected);
  });
});
