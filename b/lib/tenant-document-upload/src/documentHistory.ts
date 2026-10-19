import type { ExtendedDocumentId } from "./documentTypes.js";

export type ArchivableUploadFile = {
  fileName: string;
  fileSize: number;
  mimeType: string;
  dataUrl: string;
  uploadedAt: number;
};

export type StoredUploadFileVersion = ArchivableUploadFile & {
  version: number;
  supersededAt: number;
};

export type DocumentVersionHistory = {
  currentVersion: number;
  versions: StoredUploadFileVersion[];
};

export function archiveDocumentFile(
  history: DocumentVersionHistory | undefined,
  current: ArchivableUploadFile | undefined,
): DocumentVersionHistory {
  const base = history ?? { currentVersion: 0, versions: [] };
  if (!current) return base;
  const nextVersion = base.currentVersion + 1;
  return {
    currentVersion: nextVersion,
    versions: [
      ...base.versions,
      {
        ...current,
        version: nextVersion,
        supersededAt: Date.now(),
      },
    ],
  };
}

export function canTenantModifyDocuments(input: {
  tenantDocumentStatus: string;
  status: string;
}): boolean {
  if (input.status === "expired") return false;
  if (input.tenantDocumentStatus === "agreement_ready") return false;
  return true;
}

export type DocumentHistoryMap = Partial<Record<ExtendedDocumentId, DocumentVersionHistory>>;
