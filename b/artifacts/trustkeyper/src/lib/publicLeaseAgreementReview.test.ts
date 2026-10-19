import { describe, expect, it } from "vitest";
import {
  classifyReviewHttpStatus,
  formatApprovalStatusLabel,
  formatBrokerPhoneDisplay,
  formatPartyRoleLabel,
  normalizeBrokerTelHref,
  normalizeLeaseReviewPayload,
  reviewLinkErrorMessage,
  reviewUnavailableCopy,
  toLeaseAgreementPdfInput,
} from "./publicLeaseAgreementReview";

describe("reviewLinkErrorMessage", () => {
  it("uses human copy for 404 and 410 cases", () => {
    expect(reviewLinkErrorMessage("not_found")).toContain("ask your broker");
    expect(reviewLinkErrorMessage("expired")).toContain("ask your broker");
    expect(reviewLinkErrorMessage("not_found")).not.toMatch(/404|410|token/i);
    expect(reviewLinkErrorMessage("expired")).not.toMatch(/404|410/);
  });
});

describe("reviewUnavailableCopy", () => {
  it("splits expired and not-found into title + supporting text", () => {
    expect(reviewUnavailableCopy("expired")).toEqual({
      title: "This review link has expired",
      description: "Please ask your broker to send you a new one.",
    });
    expect(reviewUnavailableCopy("not_found").title).toContain("no longer valid");
  });
});

describe("classifyReviewHttpStatus", () => {
  it("maps status codes to error kinds", () => {
    expect(classifyReviewHttpStatus(404)).toBe("not_found");
    expect(classifyReviewHttpStatus(410)).toBe("expired");
    expect(classifyReviewHttpStatus(500)).toBe("server");
  });
});

describe("normalizeBrokerTelHref", () => {
  it("normalises Supabase 91… phone digits to a tel:+91 link", () => {
    expect(normalizeBrokerTelHref("918860826738")).toBe("tel:+918860826738");
    expect(normalizeBrokerTelHref("+91 88608 26738")).toBe("tel:+918860826738");
    expect(normalizeBrokerTelHref("8860826738")).toBe("tel:+918860826738");
  });

  it("returns null for unusable values", () => {
    expect(normalizeBrokerTelHref(null)).toBeNull();
    expect(normalizeBrokerTelHref("123")).toBeNull();
  });
});

describe("formatBrokerPhoneDisplay", () => {
  it("formats Indian mobiles for display", () => {
    expect(formatBrokerPhoneDisplay("918860826738")).toBe("+91 88608 26738");
  });
});

describe("formatPartyRoleLabel", () => {
  it("labels owner and tenant for non-technical readers", () => {
    expect(formatPartyRoleLabel("owner")).toBe("Owner (Licensor)");
    expect(formatPartyRoleLabel("tenant")).toBe("Tenant (Licensee)");
  });
});

describe("normalizeLeaseReviewPayload", () => {
  it("strips Aadhaar and PAN even if present in the API body", () => {
    const payload = normalizeLeaseReviewPayload({
      agreementId: "agr-1",
      status: "in_review",
      executionDate: "2026-07-01",
      effectiveDate: "2026-07-01",
      endDate: "2027-06-01",
      executionCity: "Hyderabad",
      durationMonths: 11,
      minStayMonths: 3,
      noticePeriodLicenseeMonths: 2,
      noticePeriodLicensorMonths: 2,
      monthlyRentPaise: 10000,
      securityDepositPaise: 20000,
      rentDueDay: 5,
      propertyAddress: "Test address",
      areaSqft: null,
      facing: null,
      carParkingCount: null,
      parties: [
        {
          role: "owner",
          title: "Mr.",
          name: "Owner",
          age: 30,
          address: "Addr",
          aadhaar: "1234 5678 9012",
          pan: "ABCDE1234F",
          email: null,
          isPrimary: true,
          sortOrder: 0,
        },
      ],
      inventoryItems: [{ description: "fan", quantity: 1, sortOrder: 0 }],
      viewer: {
        role: "tenant",
        name: "Tenant",
        approvalStatus: "pending",
        reviewComment: null,
        reviewedAt: null,
      },
      broker: { name: "Ravi Broker", phone: "918860826738" },
    });

    expect(payload).not.toBeNull();
    expect(payload?.parties[0]).toEqual({
      role: "owner",
      title: "Mr.",
      name: "Owner",
      age: 30,
      address: "Addr",
      email: null,
      isPrimary: true,
      sortOrder: 0,
    });
    expect(payload?.broker).toEqual({ name: "Ravi Broker", phone: "918860826738" });
    expect(JSON.stringify(payload)).not.toMatch(/aadhaar|pan/i);

    const pdfInput = toLeaseAgreementPdfInput(payload!);
    expect(pdfInput.parties.every((party) => party.aadhaar === null && party.pan === null)).toBe(
      true,
    );
  });

  it("returns null for incomplete payloads", () => {
    expect(normalizeLeaseReviewPayload({})).toBeNull();
    expect(normalizeLeaseReviewPayload(null)).toBeNull();
  });

  it("accepts a withdrawn viewer status", () => {
    const payload = normalizeLeaseReviewPayload({
      agreementId: "agr-1",
      status: "in_review",
      executionDate: "2026-07-01",
      effectiveDate: "2026-07-01",
      endDate: "2027-06-01",
      executionCity: "Hyderabad",
      durationMonths: 11,
      minStayMonths: 3,
      noticePeriodLicenseeMonths: 2,
      noticePeriodLicensorMonths: 2,
      monthlyRentPaise: 10000,
      securityDepositPaise: 20000,
      rentDueDay: 5,
      propertyAddress: "Test address",
      parties: [],
      inventoryItems: [],
      viewer: {
        role: "tenant",
        name: "Tenant",
        approvalStatus: "withdrawn",
        reviewComment: null,
        reviewedAt: "2026-08-14T10:00:00.000Z",
      },
      broker: { name: "Ravi Broker", phone: "918860826738" },
    });
    expect(payload?.viewer.approvalStatus).toBe("withdrawn");
  });
});

describe("formatApprovalStatusLabel", () => {
  it("labels withdrawn separately from pending", () => {
    expect(formatApprovalStatusLabel("withdrawn")).toBe("Withdrawn");
    expect(formatApprovalStatusLabel("pending")).toBe("Awaiting your response");
  });
});
