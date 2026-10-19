import type {
  ExtendedDocumentId,
  RequesterDocumentUploadInviteView,
  StoredBankDetails,
} from "@workspace/tenant-document-upload";

/** Local cache stores metadata only — file bytes stay on the server. */
export type StoredDocumentUploadInvite = Omit<RequesterDocumentUploadInviteView, "documents"> & {
  documents: Partial<
    Record<
      ExtendedDocumentId,
      { fileName: string; fileSize: number; mimeType: string; uploadedAt: number }
    >
  >;
  bankDetails?: StoredBankDetails;
};

export type DocumentUploadInviteForUi = StoredDocumentUploadInvite | RequesterDocumentUploadInviteView;

/** Strip base64 payloads before writing to localStorage or cloud sync. */
export function sanitizeDocumentUploadInviteForLocalStorage(
  invite: RequesterDocumentUploadInviteView,
): StoredDocumentUploadInvite {
  const documents: StoredDocumentUploadInvite["documents"] = {};
  for (const [id, file] of Object.entries(invite.documents ?? {})) {
    if (!file) continue;
    documents[id as ExtendedDocumentId] = {
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      uploadedAt: file.uploadedAt,
    };
  }

  return {
    token: invite.token,
    id: invite.id,
    tenantName: invite.tenantName,
    tenantPhone: invite.tenantPhone,
    propertyId: invite.propertyId,
    propertyLabel: invite.propertyLabel,
    status: invite.status,
    tenantDocumentStatus: invite.tenantDocumentStatus,
    requestedDocumentIds: invite.requestedDocumentIds,
    documentStatuses: invite.documentStatuses,
    documents,
    bankDetails: invite.bankDetails,
    submittedAt: invite.submittedAt,
    linkSentAt: invite.linkSentAt,
    startedAt: invite.startedAt,
    expiresAt: invite.expiresAt,
    inviteLink: invite.inviteLink,
  };
}
