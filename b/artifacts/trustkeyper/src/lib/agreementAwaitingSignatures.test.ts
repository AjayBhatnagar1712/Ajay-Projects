import { describe, expect, it } from "vitest";
import type { Agreement } from "./agreements";
import {
  buildAgreementAwaitingSignaturesView,
  formatAgreementSentTimestamp,
  isAgreementAwaitingSignatures,
  type AgreementSigningStatusSnapshot,
} from "./agreementAwaitingSignatures";

const baseAgreement: Agreement = {
  id: "agr-1",
  propertyId: "prop-1",
  propertyTitle: "Prestige Lakeside unit 1204",
  ownerName: "Rajesh",
  ownerContact: "rajesh123@gmail.com, kumar@gmail.com",
  tenantName: "Abdul",
  tenantContact: "Abdul@gmail.com",
  startDate: "2026-04-01",
  monthlyRent: "28000",
  securityDeposit: "56000",
  lockInPeriod: "11 months",
  noticePeriod: "2 months",
  rentDueDay: "5",
  brokerageAmount: "0",
  brokeragePaidBy: "Owner",
  brokerageMode: "Bank Transfer",
  status: "Sent",
  createdAt: Date.UTC(2026, 5, 2, 17, 9),
};

const baseStatus: AgreementSigningStatusSnapshot = {
  agreementId: "agr-1",
  lifecycleStage: "awaiting_esign_signatures",
  esignSignedPartyPhones: ["9876543210"],
  allSigned: false,
};

describe("agreementAwaitingSignatures", () => {
  it("builds owner and tenant groups for sent agreements", () => {
    const view = buildAgreementAwaitingSignaturesView(baseAgreement, baseStatus);
    expect(view?.title).toBe("Waiting for Signatures");
    expect(view?.groups).toHaveLength(2);
    expect(view?.groups[0]?.label).toBe("Owner");
    expect(view?.groups[0]?.parties).toHaveLength(2);
    expect(view?.groups[1]?.label).toBe("Tenant");
  });

  it("returns null when workflow status is missing", () => {
    expect(buildAgreementAwaitingSignaturesView(baseAgreement, null)).toBeNull();
  });

  it("detects agreements still awaiting signatures", () => {
    expect(isAgreementAwaitingSignatures(baseAgreement, baseStatus)).toBe(true);
    expect(
      isAgreementAwaitingSignatures(baseAgreement, { ...baseStatus, allSigned: true }),
    ).toBe(false);
  });

  it("formats same-day sent timestamps", () => {
    const sentAt = new Date(2026, 5, 2, 22, 39).getTime();
    const now = new Date(2026, 5, 2, 23, 0).getTime();
    const label = formatAgreementSentTimestamp(sentAt, now);
    expect(label).toBe("Today 22:39");
  });
});
