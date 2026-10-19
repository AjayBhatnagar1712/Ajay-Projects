import { describe, expect, it, vi } from "vitest";
import * as agreementsModule from "./agreements";
import {
  buildTenantAgreementReviewState,
  formatTenantWhatsAppPhoneDisplay,
  resolveTenantAgreementDownloadModalCopy,
  resolveTenantAgreementReviewPresentation,
  resolveTenantAgreementSender,
  resolveTenantESignWhatsAppPhones,
  resolveTenantTrustLayerPaymentModalCopy,
} from "./tenantAgreementReview";
import type { TenantWorkspaceRecord } from "./tenantWorkspace";

const baseWorkspace: TenantWorkspaceRecord = {
  phone: "9876543210",
  tenantName: "Meena",
  propertyId: "prop-1",
  propertyLabel: "Prestige Unit 1806",
  propertyAddress: "Financial District, Hyderabad",
  monthlyRent: "28000",
  securityDeposit: "56000",
  ownerName: "Rajesh Kumar",
  requesterName: "Demo Broker",
  requesterRole: "broker",
  updatedAt: Date.now(),
};

describe("tenantAgreementReview", () => {
  it("uses broker payment copy when broker sent the agreement", () => {
    const presentation = resolveTenantAgreementReviewPresentation({
      sender: "broker",
      brokerageAmount: 13_000,
    });

    expect(presentation.feeLabel).toBe("Brokerage Fee");
    expect(presentation.ctaLabel).toBe("Proceed to Pay Brokerage");
    expect(presentation.nextStepMessage).toContain("brokerage fee");
  });

  it("uses security deposit copy when owner sent the agreement", () => {
    const presentation = resolveTenantAgreementReviewPresentation({
      sender: "owner",
      securityDepositAmount: 56_000,
    });

    expect(presentation.feeLabel).toBe("Security Deposit");
    expect(presentation.ctaLabel).toBe("Pay the security and esign");
    expect(presentation.nextStepMessage).toContain("security deposit");
  });

  it("resolves sender from workspace requester role", () => {
    expect(resolveTenantAgreementSender({ ...baseWorkspace, requesterRole: "broker" })).toBe(
      "broker",
    );
    expect(resolveTenantAgreementSender({ ...baseWorkspace, requesterRole: "owner" })).toBe(
      "owner",
    );
  });

  it("builds review state from workspace", () => {
    const brokerState = buildTenantAgreementReviewState(baseWorkspace);
    expect(brokerState.presentation.sender).toBe("broker");
    expect(brokerState.preview.tenantName).toBe("Meena");
    expect(brokerState.preview.ownerName).toBe("Rajesh Kumar");

    const ownerState = buildTenantAgreementReviewState({
      ...baseWorkspace,
      requesterRole: "owner",
      requesterName: "Rajesh Kumar",
    });
    expect(ownerState.presentation.sender).toBe("owner");
    expect(ownerState.presentation.feeLabel).toBe("Security Deposit");
  });

  it("uses brokerage trust-layer copy for broker agreements", () => {
    const presentation = resolveTenantAgreementReviewPresentation({
      sender: "broker",
      brokerageAmount: 13_000,
    });
    const copy = resolveTenantTrustLayerPaymentModalCopy(presentation);

    expect(copy.title).toBe("Trustkeyper never takes a cut!");
    expect(copy.description).toContain("brokerage fee of ₹13,000");
    expect(copy.description).not.toContain("security deposit");
    expect(copy.ctaLabel).toBe("Proceed with payment");
  });

  it("uses security deposit trust-layer copy for owner agreements", () => {
    const presentation = resolveTenantAgreementReviewPresentation({
      sender: "owner",
      securityDepositAmount: 56_000,
    });
    const copy = resolveTenantTrustLayerPaymentModalCopy(presentation);

    expect(copy.description).toContain("security deposit of ₹56,000");
    expect(copy.description).not.toContain("brokerage fee");
  });

  it("uses download agreement copy after trust-layer payment", () => {
    const copy = resolveTenantAgreementDownloadModalCopy();
    expect(copy.title).toBe("Download your agreement");
    expect(copy.description).toContain("Download the rental agreement");
    expect(copy.ctaLabel).toBe("Download and go to Dashboard");
  });

  it("formats whatsapp phone numbers for display", () => {
    expect(formatTenantWhatsAppPhoneDisplay("+9196369856040")).toBe("+91 6369856040");
    expect(formatTenantWhatsAppPhoneDisplay("6369856040")).toBe("+91 6369856040");
  });

  it("collects unique tenant phones for e-sign instructions", () => {
    const phones = resolveTenantESignWhatsAppPhones({
      workspace: {
        ...baseWorkspace,
        phone: "9876543210",
        agreementId: "agr_test",
      },
      sessionPhone: "+919876543210",
    });

    expect(phones).toEqual(["+91 9876543210"]);
  });

  it("includes co-tenant phones when agreement has multiple tenants", () => {
    vi.spyOn(agreementsModule, "getAgreements").mockReturnValue([
      {
        id: "agr_multi",
        tenantContact: "+919111111111",
        coTenantContact: "+919222222222, +919333333333",
      } as agreementsModule.Agreement,
    ]);

    const phones = resolveTenantESignWhatsAppPhones({
      workspace: {
        ...baseWorkspace,
        phone: "",
        agreementId: "agr_multi",
      },
    });

    expect(phones).toEqual(["+91 9111111111", "+91 9222222222", "+91 9333333333"]);
    vi.restoreAllMocks();
  });
});
