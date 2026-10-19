import React from "react";
import { X, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DocumentUploadInviteForUi } from "@/lib/agreementDocumentUploadSanitize";
import {
  documentLabel,
  isFileDocumentId,
  type ExtendedDocumentId,
  type RequesterDocumentUploadInviteView,
} from "@workspace/tenant-document-upload";

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function openDataUrl(dataUrl: string, fileName: string): void {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.download = fileName;
  anchor.click();
}

export function TenantSubmittedDocumentsModal({
  invite,
  onClose,
}: {
  invite: DocumentUploadInviteForUi;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
        role="dialog"
        aria-labelledby="tenant-docs-title"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h2 id="tenant-docs-title" className="text-lg font-semibold text-gray-900 truncate">
              {invite.tenantName}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{invite.tenantPhone}</p>
            {invite.propertyLabel ? (
              <p className="text-xs text-gray-400 mt-1">{invite.propertyLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {invite.requestedDocumentIds.map((id) => {
            if (id === "bank") {
              const bank = invite.bankDetails;
              if (!bank) {
                return (
                  <div key={id} className="rounded-xl border border-gray-200 px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{documentLabel(id)}</p>
                    <p className="text-xs text-gray-500 mt-1">Not provided</p>
                  </div>
                );
              }
              return (
                <div key={id} className="rounded-xl border border-gray-200 px-4 py-3 space-y-1">
                  <p className="text-sm font-medium text-gray-900">{documentLabel(id)}</p>
                  {bank.mode === "upi" ? (
                    <>
                      {bank.upiId ? <p className="text-xs text-gray-600">UPI: {bank.upiId}</p> : null}
                      {bank.upiQrFileName ? (
                        <p className="text-xs text-gray-600">QR: {bank.upiQrFileName}</p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-gray-600">Account holder: {bank.holderName}</p>
                      <p className="text-xs text-gray-600">Bank: {bank.bankName}</p>
                      <p className="text-xs text-gray-600">Account: {bank.accountNumber}</p>
                      <p className="text-xs text-gray-600">IFSC: {bank.ifscCode}</p>
                    </>
                  )}
                </div>
              );
            }

            const file = invite.documents[id];
            const uploaded = invite.documentStatuses[id] === "uploaded" && file;
            return (
              <div
                key={id}
                className="rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex items-start gap-3">
                  <FileText size={18} className="text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{documentLabel(id)}</p>
                    {uploaded ? (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {file.fileName} · {fmtFileSize(file.fileSize)}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700 mt-0.5">Not uploaded</p>
                    )}
                  </div>
                </div>
                {uploaded && "dataUrl" in file && file.dataUrl ? (
                  <button
                    type="button"
                    onClick={() => openDataUrl(file.dataUrl, file.fileName)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary border border-primary/30 rounded-lg px-2.5 py-1.5 hover:bg-primary/5 shrink-0"
                  >
                    <Download size={12} /> View
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-gray-100">
          <Button type="button" variant="outline" className="w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export function hasReceivedTenantDocuments(invite: RequesterDocumentUploadInviteView): boolean {
  const hasFile = invite.requestedDocumentIds.some((id) => {
    if (!isFileDocumentId(id)) return false;
    return invite.documentStatuses[id] === "uploaded";
  });
  const hasBank =
    invite.requestedDocumentIds.includes("bank") &&
    (invite.documentStatuses.bank === "uploaded" || Boolean(invite.bankDetails));
  return invite.status === "submitted" || hasFile || hasBank;
}

export function countMissingTenantDocuments(invite: RequesterDocumentUploadInviteView): number {
  return invite.requestedDocumentIds.filter((id) => {
    if (id === "bank") return !invite.bankDetails && invite.documentStatuses.bank !== "uploaded";
    return invite.documentStatuses[id] !== "uploaded";
  }).length;
}

export type AgreementDocId = "aadhaar" | "pan" | "bank";

export function applyReceivedInviteToAgreementDocs(
  docs: Array<{
    id: AgreementDocId;
    label: string;
    status: "pending" | "uploaded" | "link_sent";
    fileName?: string;
    fileSize?: number;
    uploadedAt?: number;
    dataUrl?: string;
  }>,
  invite: DocumentUploadInviteForUi,
): typeof docs {
  const docIdMap: Record<AgreementDocId, ExtendedDocumentId> = {
    aadhaar: "aadhaar",
    pan: "pan",
    bank: "bank",
  };

  return docs.map((doc) => {
    const extId = docIdMap[doc.id];
    if (doc.id === "bank") {
      if (!invite.bankDetails && invite.documentStatuses.bank !== "uploaded") {
        return doc;
      }
      return {
        ...doc,
        status: "uploaded" as const,
        fileName: invite.bankDetails?.mode === "upi" ? "UPI Details" : "Bank Account",
        uploadedAt: invite.submittedAt ?? Date.now(),
      };
    }

    if (invite.documentStatuses[extId] !== "uploaded") {
      return doc;
    }

    const file = invite.documents[extId];
    return {
      ...doc,
      status: "uploaded" as const,
      fileName: file?.fileName ?? doc.fileName ?? "Uploaded",
      fileSize: file?.fileSize ?? doc.fileSize,
      uploadedAt: file?.uploadedAt ?? invite.submittedAt ?? doc.uploadedAt ?? Date.now(),
      dataUrl: file && "dataUrl" in file ? file.dataUrl : doc.dataUrl,
    };
  });
}
