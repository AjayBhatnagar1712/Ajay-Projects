import { describe, expect, it } from "vitest";
import type { LeaseAgreement } from "@/lib/api/client";
import {
  draftAgreementLabel,
  countDraftAgreements,
  selectMostRecentDraft,
  unfinishedDraftHeading,
} from "./draftResume";

function draft(overrides: Partial<LeaseAgreement>): LeaseAgreement {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    createdByUserId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    status: "draft",
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
    propertyAddress: null,
    areaSqft: null,
    facing: null,
    carParkingCount: null,
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("draftAgreementLabel", () => {
  it("uses the property address when set", () => {
    expect(draftAgreementLabel("  12 MG Road  ")).toBe("12 MG Road");
  });

  it("falls back to Untitled draft when address is missing", () => {
    expect(draftAgreementLabel(null)).toBe("Untitled draft");
    expect(draftAgreementLabel("   ")).toBe("Untitled draft");
  });
});

describe("unfinishedDraftHeading", () => {
  it("uses the property address when set", () => {
    expect(unfinishedDraftHeading("  12 MG Road  ")).toBe("12 MG Road");
  });

  it("falls back to unfinished copy when address is missing", () => {
    expect(unfinishedDraftHeading(null)).toBe(
      "You have an unfinished agreement",
    );
    expect(unfinishedDraftHeading("   ")).toBe(
      "You have an unfinished agreement",
    );
  });
});

describe("selectMostRecentDraft", () => {
  it("returns null when there are no drafts", () => {
    expect(
      selectMostRecentDraft([
        draft({ id: "1", status: "in_review", propertyAddress: "A" }),
      ]),
    ).toBeNull();
  });

  it("picks the draft with the latest updatedAt", () => {
    const older = draft({
      id: "old",
      propertyAddress: "Older",
      updatedAt: "2026-08-01T10:00:00.000Z",
    });
    const newer = draft({
      id: "new",
      propertyAddress: "Newer",
      updatedAt: "2026-08-03T14:00:00.000Z",
    });
    expect(selectMostRecentDraft([older, newer])?.id).toBe("new");
  });
});

describe("countDraftAgreements", () => {
  it("counts only draft status rows", () => {
    expect(
      countDraftAgreements([
        draft({ id: "1", status: "draft" }),
        draft({ id: "2", status: "in_review" }),
        draft({ id: "3", status: "draft" }),
      ]),
    ).toBe(2);
  });

  it("returns 0 for an empty list", () => {
    expect(countDraftAgreements([])).toBe(0);
  });
});
