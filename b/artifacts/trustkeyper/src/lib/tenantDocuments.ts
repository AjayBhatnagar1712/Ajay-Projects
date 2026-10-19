import { documentLabel } from "@workspace/tenant-document-upload";
import type { ExtendedDocumentId } from "@workspace/tenant-document-upload";
import type { DocumentUploadInvitePayload } from "@/lib/publicAgreementDocumentUpload";
import {
  mapUploadStatusToVerification,
  type TenantAccountProfile,
  type TenantDocumentMeta,
  type TenantKycVerificationStatus,
} from "@/lib/tenantProfile";
import { formatDocumentUploadedAt } from "@/lib/tenantProfileDocument";

export type TenantDocumentTableRow = {
  id: ExtendedDocumentId;
  documentLabel: string;
  detailsLabel: string;
  uploadedOnLabel: string;
  verification: TenantKycVerificationStatus;
  canView: boolean;
  meta?: TenantDocumentMeta;
};

function formatTableUploadedOn(uploadedAt?: number): string {
  if (!uploadedAt) return "—";
  return new Date(uploadedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function resolveBankDetailsLabel(invite: DocumentUploadInvitePayload | null): string | undefined {
  if (!invite?.bankDetails) return undefined;
  const bank = invite.bankDetails;
  if (bank.mode === "upi") {
    return bank.upiId ? `UPI: ${bank.upiId}` : "UPI details";
  }
  return bank.bankName ? `${bank.bankName} · ${bank.holderName}` : "Bank account details";
}

export function buildTenantDocumentTableRows(input: {
  invite: DocumentUploadInvitePayload | null;
  profile: TenantAccountProfile;
  token?: string;
}): TenantDocumentTableRow[] {
  const { invite, profile, token } = input;
  const requestedIds = invite?.requestedDocumentIds ?? ["aadhaar", "pan", "bank"];

  return requestedIds.map((id) => {
    const serverStatus = invite?.documentStatuses[id] ?? "not_uploaded";
    const serverFile = invite?.documents[id];
    const profileMeta =
      id === "aadhaar" ? profile.aadhaar : id === "pan" ? profile.pan : undefined;
    const verification = mapUploadStatusToVerification(serverStatus, invite?.tenantDocumentStatus);

    if (id === "bank") {
      const bankLabel = resolveBankDetailsLabel(invite);
      return {
        id,
        documentLabel: documentLabel(id),
        detailsLabel: bankLabel ?? "Not uploaded",
        uploadedOnLabel: bankLabel ? formatTableUploadedOn(invite?.submittedAt) : "—",
        verification: bankLabel ? verification : "pending_upload",
        canView: false,
      };
    }

    const fileName = serverFile?.fileName ?? profileMeta?.fileName;
    const uploadedAt = serverFile?.uploadedAt ?? profileMeta?.uploadedAt;
    const meta: TenantDocumentMeta | undefined = fileName
      ? {
          documentId: id,
          sourceToken: token,
          fileName,
          fileSize: serverFile?.fileSize ?? profileMeta?.fileSize,
          mimeType: serverFile?.mimeType ?? profileMeta?.mimeType,
          uploadedAt,
          previewAvailable: true,
          verificationStatus: verification,
        }
      : undefined;

    return {
      id,
      documentLabel: documentLabel(id),
      detailsLabel: fileName ?? "Not uploaded",
      uploadedOnLabel: fileName ? formatTableUploadedOn(uploadedAt) : "—",
      verification,
      canView: Boolean(fileName && token && (id === "aadhaar" || id === "pan")),
      meta,
    };
  });
}

export function countUploadedTenantDocuments(rows: TenantDocumentTableRow[]): number {
  return rows.filter((row) => row.detailsLabel !== "Not uploaded").length;
}

/** Long-form uploaded timestamp for detail views. */
export function formatTenantDocumentUploadedDetail(uploadedAt?: number): string {
  return formatDocumentUploadedAt(uploadedAt);
}
