import { describe, expect, it } from "vitest";
import type { LeaseAgreement, LeaseAgreementDetail } from "@/lib/api/client";
import {
  agreementsNeedingPartyDetail,
  buildDerivedAlerts,
  buildPayoutVerifiedAlert,
  formatAlertDateTime,
  greetingFirstName,
} from "./derivedAlerts";

function agreement(partial: Partial<LeaseAgreement> & Pick<LeaseAgreement, "id">): LeaseAgreement {
  return {
    createdByUserId: "u1",
    status: "in_review",
    executionDate: null,
    effectiveDate: null,
    endDate: null,
    executionCity: null,
    durationMonths: null,
    minStayMonths: null,
    noticePeriodLicenseeMonths: null,
    noticePeriodLicensorMonths: null,
    monthlyRentPaise: null,
    securityDepositPaise: null,
    rentDueDay: null,
    maintenanceIncluded: false,
    monthlyMaintenancePaise: null,
    propertyAddress: "12 MG Road",
    areaSqft: null,
    facing: null,
    carParkingCount: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    partyCount: 2,
    approvedCount: 0,
    changesRequestedCount: 0,
    withdrawnCount: 0,
    ...partial,
  };
}

function party(
  partial: Partial<LeaseAgreementDetail["parties"][number]> &
    Pick<LeaseAgreementDetail["parties"][number], "id" | "name" | "approvalStatus">,
): LeaseAgreementDetail["parties"][number] {
  return {
    role: "tenant",
    phone: "9876543210",
    title: null,
    age: null,
    address: null,
    aadhaar: null,
    pan: null,
    email: null,
    isPrimary: true,
    sortOrder: 0,
    reviewComment: null,
    reviewedAt: null,
    hasReviewToken: true,
    reviewLinkStatus: "active",
    reviewSharedAt: "2026-07-01T09:00:00.000Z",
    hasBeenShared: true,
    ...partial,
  };
}

describe("buildDerivedAlerts", () => {
  it("emits ready-to-send with max approved reviewedAt when detail present", () => {
    const row = agreement({
      id: "a1",
      approvedCount: 2,
      partyCount: 2,
      changesRequestedCount: 0,
    });
    const detail = {
      ...row,
      parties: [
        party({
          id: "p1",
          name: "A",
          approvalStatus: "approved",
          reviewedAt: "2026-07-01T10:00:00.000Z",
        }),
        party({
          id: "p2",
          name: "B",
          approvalStatus: "approved",
          reviewedAt: "2026-07-02T15:30:00.000Z",
        }),
      ],
      inventory: [],
    } satisfies LeaseAgreementDetail;

    const alerts = buildDerivedAlerts([row], new Map([["a1", detail]]));
    expect(alerts).toEqual([
      {
        id: "ready:a1",
        kind: "ready_to_send",
        agreementId: "a1",
        message: "Agreement is ready to send for signing",
        propertyAddress: "12 MG Road",
        occurredAt: "2026-07-02T15:30:00.000Z",
      },
    ]);
  });

  it("uses generic ready-to-send copy when address is missing", () => {
    const row = agreement({
      id: "a1b",
      propertyAddress: null,
      approvedCount: 1,
      partyCount: 1,
      changesRequestedCount: 0,
    });
    const detail = {
      ...row,
      parties: [
        party({
          id: "p1",
          name: "A",
          approvalStatus: "approved",
          reviewedAt: "2026-07-01T10:00:00.000Z",
        }),
      ],
      inventory: [],
    } satisfies LeaseAgreementDetail;

    const alerts = buildDerivedAlerts([row], new Map([["a1b", detail]]));
    expect(alerts).toEqual([
      {
        id: "ready:a1b",
        kind: "ready_to_send",
        agreementId: "a1b",
        message: "Agreement is ready to send for signing",
        propertyAddress: null,
        occurredAt: "2026-07-01T10:00:00.000Z",
      },
    ]);
  });

  it("emits changes-requested with party reviewedAt", () => {
    const row = agreement({
      id: "a2",
      changesRequestedCount: 1,
      approvedCount: 0,
    });
    const detail = {
      ...row,
      parties: [
        party({
          id: "p1",
          name: "Meera",
          approvalStatus: "changes_requested",
          reviewedAt: "2026-07-03T08:00:00.000Z",
        }),
      ],
      inventory: [],
    } satisfies LeaseAgreementDetail;

    const alerts = buildDerivedAlerts([row], new Map([["a2", detail]]));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.message).toBe("Meera requested changes on 12 MG Road");
    expect(alerts[0]?.occurredAt).toBe("2026-07-03T08:00:00.000Z");
  });

  it("emits withdrawn alerts with party reviewedAt", () => {
    const row = agreement({
      id: "a3w",
      withdrawnCount: 1,
      approvedCount: 0,
    });
    const detail = {
      ...row,
      parties: [
        party({
          id: "p1",
          name: "Meera",
          approvalStatus: "withdrawn",
          reviewedAt: "2026-07-04T08:00:00.000Z",
        }),
      ],
      inventory: [],
    } satisfies LeaseAgreementDetail;

    const alerts = buildDerivedAlerts([row], new Map([["a3w", detail]]));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      kind: "withdrawn",
      message: "Meera withdrew approval on 12 MG Road",
      occurredAt: "2026-07-04T08:00:00.000Z",
    });
  });

  it("does not emit ready-to-send when a party has withdrawn", () => {
    const row = agreement({
      id: "a4w",
      partyCount: 2,
      approvedCount: 1,
      withdrawnCount: 1,
    });
    const alerts = buildDerivedAlerts([row], new Map());
    expect(alerts.some((alert) => alert.kind === "ready_to_send")).toBe(false);
    expect(alerts[0]?.kind).toBe("withdrawn");
  });

  it("emits a signed alert with the property address", () => {
    const alerts = buildDerivedAlerts(
      [
        agreement({
          id: "s1",
          status: "signed",
          signedAt: "2026-08-14T10:00:00.000Z",
          propertyAddress: "88 Brigade Road",
        }),
      ],
      new Map(),
    );
    expect(alerts).toEqual([
      {
        id: "signed:s1",
        kind: "signed",
        agreementId: "s1",
        message: "Agreement signed for 88 Brigade Road",
        propertyAddress: "88 Brigade Road",
        occurredAt: "2026-08-14T10:00:00.000Z",
      },
    ]);
  });

  it("ignores draft agreements", () => {
    const alerts = buildDerivedAlerts(
      [agreement({ id: "d1", status: "draft", approvedCount: 2, partyCount: 2 })],
      new Map(),
    );
    expect(alerts).toEqual([]);
  });
});

describe("agreementsNeedingPartyDetail", () => {
  it("includes changes-requested, withdrawn, and ready-to-send in_review rows", () => {
    const rows = [
      agreement({ id: "a1", changesRequestedCount: 2 }),
      agreement({ id: "a2", changesRequestedCount: 0, approvedCount: 2, partyCount: 2 }),
      agreement({ id: "a3", status: "draft", changesRequestedCount: 1 }),
      agreement({ id: "a4", approvedCount: 1, partyCount: 2 }),
      agreement({ id: "a5", withdrawnCount: 1, approvedCount: 1, partyCount: 2 }),
    ];
    expect(agreementsNeedingPartyDetail(rows).map((r) => r.id)).toEqual(["a1", "a2", "a5"]);
  });
});

describe("greetingFirstName", () => {
  it("uses the first token or a fallback", () => {
    expect(greetingFirstName("Krishna Kumar")).toBe("Krishna");
    expect(greetingFirstName("  ")).toBe("there");
    expect(greetingFirstName(null)).toBe("there");
  });
});

describe("formatAlertDateTime", () => {
  it("returns null for missing values", () => {
    expect(formatAlertDateTime(null)).toBeNull();
    expect(formatAlertDateTime("not-a-date")).toBeNull();
  });

  it("formats a valid ISO instant", () => {
    const formatted = formatAlertDateTime("2026-07-02T15:30:00.000Z");
    expect(formatted).toBeTruthy();
    expect(formatted).toMatch(/2026/);
  });
});

describe("buildPayoutVerifiedAlert", () => {
  it("emits the consultancy-fee copy with no agreement id", () => {
    expect(buildPayoutVerifiedAlert()).toEqual({
      id: "payout:verified",
      kind: "payout_verified",
      agreementId: null,
      message:
        "Your payout details are verified — you can now receive consultancy fees.",
      propertyAddress: null,
      occurredAt: null,
    });
  });
});
