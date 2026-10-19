import { API_BASE } from "@/lib/apiBase";
import type {
  ExtendedDocumentId,
  StoredBankDetails,
  TenantDocumentUploadStatus,
  UploadDocumentStatus,
} from "@workspace/tenant-document-upload";

export type DocumentUploadInvitePayload = {
  token: string;
  tenantName: string;
  tenantPhone: string;
  requesterName: string;
  requesterRole: "owner" | "broker";
  propertyId?: string;
  propertyLabel?: string;
  propertyImage?: string;
  propertyAddress?: string;
  monthlyRent?: string;
  securityDeposit?: string;
  requestedDocumentIds: ExtendedDocumentId[];
  status: string;
  tenantDocumentStatus: TenantDocumentUploadStatus;
  documentStatuses: Partial<Record<ExtendedDocumentId, UploadDocumentStatus>>;
  documents: Partial<
    Record<ExtendedDocumentId, { fileName: string; fileSize: number; mimeType: string; uploadedAt: number }>
  >;
  bankDetails?: StoredBankDetails;
  expiresAt: number;
  submittedAt?: number;
  hasTenantAccount: boolean;
};

export async function fetchDocumentUploadInvite(
  token: string,
): Promise<{ payload: DocumentUploadInvitePayload | null; error?: string; status?: number }> {
  try {
    const res = await fetch(`${API_BASE}/tenant-document-upload/${encodeURIComponent(token)}`);
    const json = (await res.json()) as DocumentUploadInvitePayload & { error?: string };
    if (!res.ok) {
      return { payload: null, error: json.error ?? "Could not load document upload link", status: res.status };
    }
    return { payload: json, status: res.status };
  } catch {
    return { payload: null, error: "Network error. Check your connection and try again.", status: 0 };
  }
}

export async function markDocumentUploadStarted(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/tenant-document-upload/${encodeURIComponent(token)}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type SubmitDocumentUploadPayload = {
  documents?: Partial<
    Record<ExtendedDocumentId, { fileName: string; fileSize: number; mimeType: string; dataUrl: string }>
  >;
  bankDetails?: StoredBankDetails;
  draft?: boolean;
  removeDocumentIds?: ExtendedDocumentId[];
};

export async function submitDocumentUploadInvite(
  token: string,
  body: SubmitDocumentUploadPayload,
): Promise<
  | { ok: true; requesterName: string; requesterRole: "owner" | "broker"; submittedAt?: number }
  | { ok: false; error: string; code?: string; status?: number }
> {
  try {
    const res = await fetch(`${API_BASE}/tenant-document-upload/${encodeURIComponent(token)}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      error?: string;
      code?: string;
      requesterName?: string;
      requesterRole?: "owner" | "broker";
      submittedAt?: number;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: json.error ?? "Failed to submit documents",
        code: json.code,
        status: res.status,
      };
    }
    return {
      ok: true,
      requesterName: json.requesterName ?? "Your property manager",
      requesterRole: json.requesterRole ?? "owner",
      submittedAt: json.submittedAt,
    };
  } catch {
    return { ok: false, error: "Network error. Please try again.", code: "network" };
  }
}

export async function fetchTenantUploadedDocumentFile(
  token: string,
  documentId: ExtendedDocumentId,
): Promise<
  | {
      ok: true;
      file: {
        documentId: ExtendedDocumentId;
        fileName: string;
        fileSize: number;
        mimeType: string;
        uploadedAt: number;
        dataUrl: string;
      };
    }
  | { ok: false; error: string; code?: string; status?: number }
> {
  try {
    const res = await fetch(
      `${API_BASE}/tenant-document-upload/${encodeURIComponent(token)}/file/${encodeURIComponent(documentId)}`,
    );
    const json = (await res.json()) as {
      documentId?: ExtendedDocumentId;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      uploadedAt?: number;
      dataUrl?: string;
      error?: string;
      code?: string;
    };
    if (!res.ok || !json.dataUrl || !json.fileName) {
      return {
        ok: false,
        error: json.error ?? "Document file not available",
        code: json.code,
        status: res.status,
      };
    }
    return {
      ok: true,
      file: {
        documentId: json.documentId ?? documentId,
        fileName: json.fileName,
        fileSize: json.fileSize ?? 0,
        mimeType: json.mimeType ?? "application/octet-stream",
        uploadedAt: json.uploadedAt ?? Date.now(),
        dataUrl: json.dataUrl,
      },
    };
  } catch {
    return { ok: false, error: "Network error. Please try again.", code: "network" };
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
