import { describe, expect, it } from "vitest";
import {
  isTenantWorkflowPastDocuments,
  mergeInviteIntoTenantWorkspace,
  shouldSyncInviteWorkspaceToServer,
} from "./tenantWorkspaceInviteMerge";
import type { TenantWorkspaceRecord } from "./tenantWorkspace";

const baseWorkspace: TenantWorkspaceRecord = {
  phone: "9876543210",
  tenantName: "Meena",
  propertyLabel: "Prestige Unit 1806",
  lifecycleStage: "agreement_ready",
  agreementId: "agr_123",
  updatedAt: Date.now(),
};

const inviteSnapshot: TenantWorkspaceRecord = {
  phone: "9876543210",
  tenantName: "Meena",
  propertyLabel: "Prestige Unit 1806",
  documentUploadToken: "adu_new",
  documentUploadStatus: "documents_submitted",
  documentUploadSubmittedAt: Date.now(),
  updatedAt: Date.now(),
};

describe("tenantWorkspaceInviteMerge", () => {
  it("detects workflow stages past document collection", () => {
    expect(isTenantWorkflowPastDocuments("documents_submitted")).toBe(false);
    expect(isTenantWorkflowPastDocuments("agreement_being_prepared")).toBe(true);
    expect(isTenantWorkflowPastDocuments("agreement_ready")).toBe(true);
  });

  it("preserves agreement workflow fields when merging invite updates", () => {
    const merged = mergeInviteIntoTenantWorkspace(baseWorkspace, inviteSnapshot);
    expect(merged.lifecycleStage).toBe("agreement_ready");
    expect(merged.agreementId).toBe("agr_123");
    expect(merged.documentUploadToken).toBe("adu_new");
    expect(merged.documentUploadStatus).toBe("documents_submitted");
  });

  it("skips server sync when invite would overwrite agreement workflow", () => {
    expect(shouldSyncInviteWorkspaceToServer(null)).toBe(true);
    expect(shouldSyncInviteWorkspaceToServer(baseWorkspace)).toBe(false);
    expect(
      shouldSyncInviteWorkspaceToServer({
        ...baseWorkspace,
        lifecycleStage: "documents_in_progress",
      }),
    ).toBe(true);
  });
});
