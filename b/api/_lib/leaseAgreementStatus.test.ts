import { describe, expect, it } from "vitest";
import {
  BROKER_MARK_SIGNED_ERROR,
  SEND_FOR_SIGNING_NOT_ALL_APPROVED_ERROR,
  validateLeaseAgreementStatusTransition,
} from "./leaseAgreementStatus.js";

function completeAgreement() {
  return {
    executionDate: "2026-07-27",
    effectiveDate: "2026-08-01",
    endDate: "2027-07-31",
    executionCity: "Hyderabad",
    durationMonths: 12,
    minStayMonths: 6,
    noticePeriodLicenseeMonths: 2,
    noticePeriodLicensorMonths: 2,
    monthlyRentPaise: 6_000_000,
    securityDepositPaise: 12_000_000,
    rentDueDay: 5,
    propertyAddress: "1 Main Road",
    areaSqft: 1200,
    facing: "East",
    carParkingCount: 1,
  };
}

function completeParties() {
  return [
    {
      role: "owner" as const,
      name: "Owner One",
      phone: "9876543210",
      title: "Mr.",
      age: 42,
      address: "1 Main Road",
      aadhaar: "967132807649",
      pan: "ABCDE1234F",
      email: "owner@example.com",
      isPrimary: true,
      sortOrder: 0,
      approvalStatus: "pending" as const,
    },
    {
      role: "tenant" as const,
      name: "Tenant One",
      phone: "9876543211",
      title: "Ms.",
      age: 31,
      address: "1 Main Road",
      aadhaar: "234123412346",
      pan: null,
      email: "tenant@example.com",
      isPrimary: true,
      sortOrder: 1,
      approvalStatus: "pending" as const,
    },
  ];
}

function approvedParties() {
  return completeParties().map((party) => ({
    ...party,
    approvalStatus: "approved" as const,
  }));
}

describe("validateLeaseAgreementStatusTransition", () => {
  it("allows draft to move to in_review when the draft is complete", () => {
    const result = validateLeaseAgreementStatusTransition({
      currentStatus: "draft",
      nextStatus: "in_review",
      agreement: completeAgreement(),
      parties: completeParties(),
    });

    expect(result).toEqual({ ok: true, placeholderGate: false });
  });

  it("rejects draft to in_review when required agreement fields are missing", () => {
    const result = validateLeaseAgreementStatusTransition({
      currentStatus: "draft",
      nextStatus: "in_review",
      agreement: {
        ...completeAgreement(),
        executionDate: null,
        propertyAddress: null,
      },
      parties: completeParties(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Cannot move draft to in_review");
      expect(result.error).toContain("Execution Date");
      expect(result.error).toContain("Property Address");
    }
  });

  it("rejects draft to in_review when party requirements are incomplete", () => {
    const result = validateLeaseAgreementStatusTransition({
      currentStatus: "draft",
      nextStatus: "in_review",
      agreement: completeAgreement(),
      parties: [
        {
          ...completeParties()[0],
          email: null,
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("At least one tenant is required");
    }
  });

  it("allows in_review to move to esign_sent when every party is approved", () => {
    const result = validateLeaseAgreementStatusTransition({
      currentStatus: "in_review",
      nextStatus: "esign_sent",
      agreement: completeAgreement(),
      parties: approvedParties(),
    });

    expect(result).toEqual({ ok: true, placeholderGate: false });
  });

  it("rejects send-for-signing when a party is still pending", () => {
    const result = validateLeaseAgreementStatusTransition({
      currentStatus: "in_review",
      nextStatus: "esign_sent",
      agreement: completeAgreement(),
      parties: completeParties(),
    });

    expect(result).toEqual({
      ok: false,
      error: SEND_FOR_SIGNING_NOT_ALL_APPROVED_ERROR,
    });
  });

  it("rejects send-for-signing when a party requested changes", () => {
    const [owner, tenant] = completeParties();
    const result = validateLeaseAgreementStatusTransition({
      currentStatus: "in_review",
      nextStatus: "esign_sent",
      agreement: completeAgreement(),
      parties: [
        { ...owner, approvalStatus: "approved" },
        { ...tenant, approvalStatus: "changes_requested" },
      ],
    });

    expect(result).toEqual({
      ok: false,
      error: SEND_FOR_SIGNING_NOT_ALL_APPROVED_ERROR,
    });
  });

  it("rejects send-for-signing when a party has withdrawn", () => {
    const [owner, tenant] = completeParties();
    const result = validateLeaseAgreementStatusTransition({
      currentStatus: "in_review",
      nextStatus: "esign_sent",
      agreement: completeAgreement(),
      parties: [
        { ...owner, approvalStatus: "approved" },
        { ...tenant, approvalStatus: "withdrawn" },
      ],
    });

    expect(result).toEqual({
      ok: false,
      error: SEND_FOR_SIGNING_NOT_ALL_APPROVED_ERROR,
    });
  });

  it("rejects send-for-signing when there are no parties", () => {
    const result = validateLeaseAgreementStatusTransition({
      currentStatus: "in_review",
      nextStatus: "esign_sent",
      agreement: completeAgreement(),
      parties: [],
    });

    expect(result).toEqual({
      ok: false,
      error: SEND_FOR_SIGNING_NOT_ALL_APPROVED_ERROR,
    });
  });

  it("rejects broker self-serve mark-as-signed", () => {
    const result = validateLeaseAgreementStatusTransition({
      currentStatus: "esign_sent",
      nextStatus: "signed",
      agreement: completeAgreement(),
      parties: approvedParties(),
    });

    expect(result).toEqual({
      ok: false,
      error: BROKER_MARK_SIGNED_ERROR,
    });
  });

  it("rejects invalid direct transitions", () => {
    const result = validateLeaseAgreementStatusTransition({
      currentStatus: "draft",
      nextStatus: "esign_sent",
      agreement: completeAgreement(),
      parties: approvedParties(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(
        "Invalid lease agreement status transition: draft -> esign_sent",
      );
    }
  });
});
