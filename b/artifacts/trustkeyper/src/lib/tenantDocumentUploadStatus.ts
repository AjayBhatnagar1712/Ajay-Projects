import type { TenantDocumentUploadStatus } from "@workspace/tenant-document-upload";
import { syncOwnerInviteDocumentUploadStatus } from "./ownerTenants";
import { getTenants, updateTenant } from "./tenants";
import { broadcastBrokerPendingFlowsUpdated } from "./brokerPendingFlows";

export const TENANT_DOCUMENT_STATUS_UPDATED_EVENT = "tk-tenant-document-status-updated";

export function documentUploadStatusLabel(status: TenantDocumentUploadStatus): string {
  switch (status) {
    case "document_request_sent":
      return "Document Request Sent";
    case "documents_in_progress":
      return "Documents In Progress";
    case "documents_submitted":
      return "Documents Submitted";
    case "agreement_ready":
      return "Agreement Ready";
    default:
      return status;
  }
}

export function syncTenantDocumentUploadStatus(
  tenantPhone: string,
  status: TenantDocumentUploadStatus,
  options?: { token?: string; submittedAt?: number },
): void {
  const digits = tenantPhone.replace(/\D/g, "").slice(-10);
  const tenant = getTenants().find((t) => t.phone.replace(/\D/g, "").slice(-10) === digits);
  if (tenant) {
    updateTenant(tenant.id, {
      documentUploadStatus: status,
      documentUploadToken: options?.token ?? tenant.documentUploadToken,
      documentUploadSubmittedAt: options?.submittedAt ?? tenant.documentUploadSubmittedAt,
    });
    broadcastBrokerPendingFlowsUpdated();
  }

  syncOwnerInviteDocumentUploadStatus(tenantPhone, status, options);
  window.dispatchEvent(new CustomEvent(TENANT_DOCUMENT_STATUS_UPDATED_EVENT));
}
