import type { TenantWorkflowStage } from "./tenantWorkflowState";
import type { TenantWorkspaceRecord } from "./tenantWorkspace";

const WORKFLOW_STAGE_ORDER: TenantWorkflowStage[] = [
  "no_property",
  "no_workflow",
  "relationship_error",
  "property_removed",
  "agreement_cancelled",
  "invitation_sent",
  "account_created",
  "rental_requirements_submitted",
  "documents_requested",
  "documents_in_progress",
  "documents_submitted",
  "documents_under_review",
  "additional_documents_required",
  "agreement_being_prepared",
  "agreement_ready",
  "esign_document_upload",
  "awaiting_esign_signatures",
  "agreement_signed",
  "rent_payment_due",
  "move_in_scheduled",
  "maintenance_update",
  "lease_renewal",
  "active_tenant",
];

function stageRank(stage: TenantWorkflowStage): number {
  const rank = WORKFLOW_STAGE_ORDER.indexOf(stage);
  return rank === -1 ? 0 : rank;
}

export function isTenantWorkflowPastDocuments(stage?: TenantWorkflowStage): boolean {
  if (!stage) return false;
  return stageRank(stage) >= stageRank("agreement_being_prepared");
}

export function mergeInviteIntoTenantWorkspace(
  existing: TenantWorkspaceRecord | null,
  fromInvite: TenantWorkspaceRecord,
): TenantWorkspaceRecord {
  if (!existing) {
    return fromInvite;
  }

  if (isTenantWorkflowPastDocuments(existing.lifecycleStage)) {
    return {
      ...existing,
      documentUploadToken: fromInvite.documentUploadToken ?? existing.documentUploadToken,
      documentUploadStatus: fromInvite.documentUploadStatus ?? existing.documentUploadStatus,
      documentUploadSubmittedAt:
        fromInvite.documentUploadSubmittedAt ?? existing.documentUploadSubmittedAt,
      propertyLabel: existing.propertyLabel || fromInvite.propertyLabel,
      propertyAddress: existing.propertyAddress ?? fromInvite.propertyAddress,
      propertyImage: existing.propertyImage ?? fromInvite.propertyImage,
      monthlyRent: existing.monthlyRent ?? fromInvite.monthlyRent,
      securityDeposit: existing.securityDeposit ?? fromInvite.securityDeposit,
      tenantName: existing.tenantName || fromInvite.tenantName,
      updatedAt: Date.now(),
    };
  }

  return {
    ...existing,
    ...fromInvite,
    phone: fromInvite.phone,
    updatedAt: Date.now(),
  };
}

export function shouldSyncInviteWorkspaceToServer(
  existing: TenantWorkspaceRecord | null,
): boolean {
  if (!existing) return true;
  return !isTenantWorkflowPastDocuments(existing.lifecycleStage);
}
