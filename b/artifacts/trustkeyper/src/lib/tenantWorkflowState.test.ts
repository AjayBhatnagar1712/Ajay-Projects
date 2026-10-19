import { describe, expect, it } from "vitest";
import {
  buildProgressStepsFromStage,
  resolveTenantWorkflowState,
  shouldShowBrokerForStage,
} from "./tenantWorkflowState";
import type { TenantWorkspaceRecord } from "./tenantWorkspace";

const baseWorkspace: TenantWorkspaceRecord = {
  phone: "9876543210",
  tenantName: "Meena",
  propertyId: "prop-1",
  propertyLabel: "Prestige Unit 1806",
  propertyAddress: "Financial District, Hyderabad",
  monthlyRent: "13000",
  securityDeposit: "39000",
  propertyType: "Apartment",
  propertyStatus: "Available",
  ownerName: "Anita Owner",
  brokerName: "Demo Broker",
  requesterName: "Demo Broker",
  requesterRole: "broker",
  updatedAt: Date.now(),
};

describe("tenantWorkflowState", () => {
  it("matches design state after documents submitted", () => {
    const snapshot = resolveTenantWorkflowState({
      ...baseWorkspace,
      documentUploadStatus: "documents_submitted",
      documentUploadSubmittedAt: Date.now(),
    });

    expect(snapshot.stage).toBe("documents_under_review");
    expect(snapshot.progressSteps[0]?.state).toBe("complete");
    expect(snapshot.progressSteps[1]?.state).toBe("current");
    expect(snapshot.progressSteps[2]?.state).toBe("upcoming");
    expect(snapshot.notification.title).toBe("Documents Under Review");
    expect(snapshot.notification.description).toContain("currently being reviewed");
    expect(snapshot.showBroker).toBe(true);
  });

  it("shows broker until rent payment for broker-initiated flows", () => {
    const brokerWorkspace = { ...baseWorkspace, requesterRole: "broker" as const };
    expect(shouldShowBrokerForStage("documents_under_review", brokerWorkspace)).toBe(true);
    expect(shouldShowBrokerForStage("agreement_ready", brokerWorkspace)).toBe(true);
    expect(shouldShowBrokerForStage("rent_payment_due", brokerWorkspace)).toBe(false);
    expect(shouldShowBrokerForStage("agreement_ready", { ...baseWorkspace, requesterRole: "owner" })).toBe(
      false,
    );
  });

  it("keeps progress and notification in sync for in-progress uploads", () => {
    const snapshot = resolveTenantWorkflowState({
      ...baseWorkspace,
      documentUploadStatus: "documents_in_progress",
      documentUploadToken: "adu_token",
    });

    expect(snapshot.stage).toBe("documents_in_progress");
    expect(snapshot.progressSteps[0]?.state).toBe("current");
    expect(snapshot.notification.actionHref).toBe("/upload/documents/adu_token");
  });

  it("builds completed document step for agreement ready", () => {
    const steps = buildProgressStepsFromStage("agreement_ready");
    expect(steps[0]?.state).toBe("complete");
    expect(steps[1]?.state).toBe("complete");
    expect(steps[2]?.state).toBe("current");
  });

  it("matches approve agreement dashboard when agreement is ready", () => {
    const snapshot = resolveTenantWorkflowState({
      ...baseWorkspace,
      documentUploadStatus: "agreement_ready",
      documentUploadSubmittedAt: Date.now(),
      agreementId: "agr-123",
    });

    expect(snapshot.stage).toBe("agreement_ready");
    expect(snapshot.progressSteps[0]?.state).toBe("complete");
    expect(snapshot.progressSteps[1]?.state).toBe("complete");
    expect(snapshot.progressSteps[2]?.state).toBe("current");
    expect(snapshot.notification.title).toBe("Approve Agreement");
    expect(snapshot.notification.description).toContain("final lease agreement");
    expect(snapshot.notification.actionLabel).toBe("Review and Approve Agreement");
    expect(snapshot.notification.actionHref).toBe("/tenant/agreement?agreementId=agr-123");
    expect(snapshot.showBroker).toBe(true);
  });

  it("uses rent-only CTA after owner-path deposit was paid", () => {
    const snapshot = resolveTenantWorkflowState({
      ...baseWorkspace,
      requesterRole: "owner",
      lifecycleStage: "rent_payment_due",
      preSigningEscrowType: "security_deposit",
    });

    expect(snapshot.notification.actionLabel).toBe("Pay rent");
    expect(snapshot.notification.title).toBe("Rent payment due");
  });

  it("uses rent plus deposit CTA after broker-path brokerage was paid", () => {
    const snapshot = resolveTenantWorkflowState({
      ...baseWorkspace,
      lifecycleStage: "rent_payment_due",
      preSigningEscrowType: "brokerage_tenant",
    });

    expect(snapshot.notification.actionLabel).toBe("Pay rent and security deposit");
    expect(snapshot.notification.title).toBe("Rent and deposit due");
  });

  it("matches upload signed agreement dashboard after e-sign", () => {
    const snapshot = resolveTenantWorkflowState({
      ...baseWorkspace,
      lifecycleStage: "esign_document_upload",
      agreementId: "agr-123",
    });

    expect(snapshot.stage).toBe("esign_document_upload");
    expect(snapshot.progressSteps[0]?.state).toBe("complete");
    expect(snapshot.progressSteps[1]?.state).toBe("complete");
    expect(snapshot.progressSteps[2]?.state).toBe("current");
    expect(snapshot.notification.kind).toBe("esign_document_upload");
    expect(snapshot.notification.title).toBe("Upload Signed Agreement");
    expect(snapshot.notification.actionLabel).toBe("Upload Signed Agreement");
    expect(snapshot.notification.actionHref).toBe("/tenant/agreement/upload-signed");
    expect(snapshot.showBroker).toBe(true);
  });

  it("matches waiting for signatures dashboard after tenant e-sign", () => {
    const snapshot = resolveTenantWorkflowState({
      ...baseWorkspace,
      lifecycleStage: "awaiting_esign_signatures",
      esignSignedPartyPhones: ["9876543210"],
    });

    expect(snapshot.stage).toBe("awaiting_esign_signatures");
    expect(snapshot.progressSteps.every((step) => step.state === "complete")).toBe(true);
    expect(snapshot.notification.kind).toBe("awaiting_esign_signatures");
    expect(snapshot.signatureStatus?.title).toBe("Waiting for signatures");
    expect(snapshot.showBroker).toBe(true);
  });

  it("returns empty-state notification when no property assigned", () => {
    const snapshot = resolveTenantWorkflowState({
      ...baseWorkspace,
      propertyId: undefined,
      propertyLabel: "",
    });
    expect(snapshot.stage).toBe("no_property");
    expect(snapshot.notification.kind).toBe("no_property");
  });

  it("flags missing property relationships", () => {
    const snapshot = resolveTenantWorkflowState({
      ...baseWorkspace,
      propertyMissing: true,
    });
    expect(snapshot.stage).toBe("property_removed");
    expect(snapshot.error?.code).toBe("missing_property");
  });
});
