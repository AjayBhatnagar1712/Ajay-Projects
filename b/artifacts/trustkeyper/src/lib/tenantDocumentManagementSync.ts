import type { DocumentUploadInvitePayload } from "./publicAgreementDocumentUpload";
import { fetchDocumentUploadInvite } from "./publicAgreementDocumentUpload";
import { mergeTenantProfileFromInvitePayload } from "./tenantProfile";
import { TENANT_PROFILE_UPDATED_EVENT } from "./tenantProfile";
import { saveTenantWorkspaceFromInvite } from "./tenantWorkspace";
import { syncTenantDocumentUploadStatus } from "./tenantDocumentUploadStatus";

export const TENANT_DOCUMENT_MANAGEMENT_UPDATED_EVENT = "tk-tenant-document-management-updated";

function broadcastUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TENANT_DOCUMENT_MANAGEMENT_UPDATED_EVENT));
  window.dispatchEvent(new CustomEvent(TENANT_PROFILE_UPDATED_EVENT));
}

export async function refreshTenantDocumentInvite(
  token: string,
): Promise<DocumentUploadInvitePayload | null> {
  const { payload } = await fetchDocumentUploadInvite(token);
  if (!payload) return null;

  mergeTenantProfileFromInvitePayload(payload);
  saveTenantWorkspaceFromInvite(payload, {
    documentUploadStatus: payload.tenantDocumentStatus,
    documentUploadSubmittedAt: payload.submittedAt,
  });
  syncTenantDocumentUploadStatus(payload.tenantPhone, payload.tenantDocumentStatus, {
    token,
    submittedAt: payload.submittedAt,
  });
  broadcastUpdated();
  return payload;
}
