import { describe, expect, it } from "vitest";
import type { Agreement } from "./agreements";
import {
  buildAgreementSigningStatus,
  ownerPhonesFromAgreement,
  resolveAgreementSigningPresentation,
  resolveOwnerSignerPhone,
} from "./ownerAgreementSigning";

const baseAgreement: Agreement = {
  id: "agr-1",
  propertyId: "prop-1",
  propertyTitle: "Prestige Unit",
  ownerName: "Rajesh",
  ownerContact: "+919876543210",
  tenantName: "Meena",
  tenantContact: "+919111111111",
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
  createdAt: Date.now(),
};

describe("ownerAgreementSigning", () => {
  it("parses owner phones from agreement contact", () => {
    expect(ownerPhonesFromAgreement(baseAgreement)).toEqual(["9876543210"]);
  });

  it("detects when owner upload is required after tenant signed", () => {
    const status = buildAgreementSigningStatus({
      agreementId: "agr-1",
      tenantPhone: "9111111111",
      ownerContact: "+919876543210",
      lifecycleStage: "awaiting_esign_signatures",
      esignSignedPartyPhones: ["9111111111"],
    });

    expect(status.tenantSigned).toBe(true);
    expect(status.ownerSigned).toBe(false);
    expect(status.ownerUploadRequired).toBe(true);
  });

  it("shows upload CTA for owner when tenant has signed", () => {
    const status = buildAgreementSigningStatus({
      agreementId: "agr-1",
      tenantPhone: "9111111111",
      ownerContact: "+919876543210",
      lifecycleStage: "awaiting_esign_signatures",
      esignSignedPartyPhones: ["9111111111"],
    });

    const presentation = resolveAgreementSigningPresentation(status, baseAgreement);
    expect(presentation?.uploadLabel).toBe("Upload signed copy");
    expect(presentation?.tone).toBe("action");
  });

  it("shows rent-only path label when both parties signed", () => {
    const status = buildAgreementSigningStatus({
      agreementId: "agr-1",
      tenantPhone: "9111111111",
      ownerContact: "+919876543210",
      lifecycleStage: "rent_payment_due",
      esignSignedPartyPhones: ["9111111111", "9876543210"],
    });

    const presentation = resolveAgreementSigningPresentation(status, baseAgreement);
    expect(presentation?.label).toBe("Fully signed");
    expect(presentation?.tone).toBe("complete");
  });

  it("matches logged-in owner phone to agreement owner contact", () => {
    expect(resolveOwnerSignerPhone(baseAgreement, "9876543210")).toBe("9876543210");
  });
});
