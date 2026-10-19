import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  Loader2,
  MapPin,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BankDetailsModal,
  type BankDetailsData,
} from "@/components/agreement/BankDetailsModal";
import { TenantKycStatusBadge } from "@/components/tenant/TenantKycStatusBadge";
import {
  documentLabel,
  isFileDocumentId,
  type ExtendedDocumentId,
  type UploadDocumentStatus,
} from "@workspace/tenant-document-upload";
import { getFileTypeError } from "@/lib/fileValidation";
import {
  readFileAsDataUrl,
  submitDocumentUploadInvite,
  type DocumentUploadInvitePayload,
} from "@/lib/publicAgreementDocumentUpload";
import { refreshTenantDocumentInvite } from "@/lib/tenantDocumentManagementSync";
import {
  getTenantAccountProfile,
  mapUploadStatusToVerification,
  mergeTenantProfileFromDocumentUpload,
  type TenantDocumentMeta,
} from "@/lib/tenantProfile";
import {
  formatDocumentMimeLabel,
  formatDocumentUploadedAt,
  openTenantDocumentPreview,
  resolveTenantDocumentDataUrl,
} from "@/lib/tenantProfileDocument";
import type { TenantDocumentUploadSession } from "@/lib/tenantDocumentUploadSession";
import { cn } from "@/lib/utils";

type LocalDocState = {
  status: UploadDocumentStatus;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  dataUrl?: string;
  uploadedAt?: number;
  error?: string;
  progress?: number;
};

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadStatusLabel(status: UploadDocumentStatus): string {
  if (status === "uploaded") return "Uploaded";
  if (status === "uploading") return "Uploading";
  if (status === "rejected") return "Rejected";
  if (status === "reupload_required") return "Requires Re-upload";
  return "Not Uploaded";
}

export function TenantDocumentManagementFlow({
  invite: initialInvite,
  session,
}: {
  invite: DocumentUploadInvitePayload;
  session: TenantDocumentUploadSession;
}) {
  const [, setLocation] = useLocation();
  const [invite, setInvite] = useState(initialInvite);
  const [docs, setDocs] = useState<Partial<Record<ExtendedDocumentId, LocalDocState>>>({});
  const [bankDetails, setBankDetails] = useState<BankDetailsData | null>(null);
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<ExtendedDocumentId | null>(null);
  const [viewingDoc, setViewingDoc] = useState<ExtendedDocumentId | null>(null);
  const fileRefs = useRef<Partial<Record<ExtendedDocumentId, HTMLInputElement | null>>>({});

  const canModify = invite.tenantDocumentStatus !== "agreement_ready";

  const hydrateFromInvite = useCallback((payload: DocumentUploadInvitePayload) => {
    const initial: Partial<Record<ExtendedDocumentId, LocalDocState>> = {};
    const profile = getTenantAccountProfile();

    for (const id of payload.requestedDocumentIds) {
      const serverStatus = payload.documentStatuses[id] ?? "not_uploaded";
      const serverFile = payload.documents[id];
      const profileDoc =
        id === "aadhaar" ? profile.aadhaar : id === "pan" ? profile.pan : undefined;

      if (id === "bank") {
        initial.bank = {
          status: serverStatus === "uploaded" || payload.bankDetails ? "uploaded" : "not_uploaded",
          fileName: payload.bankDetails ? "Bank Account Details" : undefined,
          uploadedAt: payload.submittedAt,
        };
        if (payload.bankDetails) {
          setBankDetails(payload.bankDetails as BankDetailsData);
        }
        continue;
      }

      const hasUploaded = serverStatus === "uploaded" || Boolean(serverFile?.fileName);
      initial[id] = {
        status: hasUploaded ? serverStatus : "not_uploaded",
        fileName: serverFile?.fileName ?? profileDoc?.fileName,
        fileSize: serverFile?.fileSize ?? profileDoc?.fileSize,
        mimeType: serverFile?.mimeType ?? profileDoc?.mimeType,
        uploadedAt: serverFile?.uploadedAt ?? profileDoc?.uploadedAt,
      };
    }

    setDocs(initial);
  }, []);

  const loadInvite = useCallback(async () => {
    setRefreshing(true);
    setActionError(null);
    try {
      const payload = await refreshTenantDocumentInvite(session.token);
      if (!payload) {
        setActionError("Could not refresh your documents. Please try again.");
        return;
      }
      setInvite(payload);
      hydrateFromInvite(payload);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [hydrateFromInvite, session.token]);

  useEffect(() => {
    hydrateFromInvite(initialInvite);
    setLoading(false);
    void loadInvite();
  }, [hydrateFromInvite, initialInvite, loadInvite]);

  const syncProfile = useCallback(
    (nextDocs: Partial<Record<ExtendedDocumentId, LocalDocState>>, nextBank: BankDetailsData | null) => {
      const documents: NonNullable<Parameters<typeof mergeTenantProfileFromDocumentUpload>[0]["documents"]> = {};
      const documentStatuses: Partial<Record<ExtendedDocumentId, UploadDocumentStatus>> = {};

      for (const id of invite.requestedDocumentIds) {
        const doc = nextDocs[id];
        if (id === "bank") {
          documentStatuses.bank = doc?.status === "uploaded" || nextBank ? "uploaded" : "not_uploaded";
          continue;
        }
        if (!doc) continue;
        documentStatuses[id] = doc.status ?? "not_uploaded";
        if (doc.fileName && doc.mimeType && typeof doc.fileSize === "number") {
          documents[id] = {
            fileName: doc.fileName,
            fileSize: doc.fileSize,
            mimeType: doc.mimeType,
            dataUrl: doc.dataUrl,
            uploadedAt: doc.uploadedAt ?? Date.now(),
          };
        }
      }

      mergeTenantProfileFromDocumentUpload({
        token: session.token,
        tenantName: invite.tenantName,
        tenantPhone: invite.tenantPhone,
        propertyId: invite.propertyId,
        propertyLabel: invite.propertyLabel,
        documentStatuses,
        documents,
        bankDetails: nextBank ?? undefined,
        tenantDocumentStatus: invite.tenantDocumentStatus,
        submitted: invite.status === "submitted",
      });
    },
    [invite, session.token],
  );

  const showSuccess = (message: string) => {
    setActionSuccess(message);
    window.setTimeout(() => setActionSuccess(null), 4000);
  };

  const handleUpload = async (id: ExtendedDocumentId, file: File) => {
    const typeError = getFileTypeError(file);
    if (typeError) {
      setDocs((prev) => ({
        ...prev,
        [id]: { ...prev[id], status: "reupload_required", error: typeError },
      }));
      return;
    }

    setReplacingId(id);
    setActionError(null);
    setDocs((prev) => ({
      ...prev,
      [id]: { status: "uploading", progress: 30, fileName: file.name, fileSize: file.size },
    }));

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const uploadedAt = Date.now();
      const result = await submitDocumentUploadInvite(session.token, {
        draft: true,
        documents: {
          [id]: {
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            dataUrl,
          },
        },
      });

      if (!result.ok) {
        setActionError(result.error);
        setDocs((prev) => ({
          ...prev,
          [id]: { status: "reupload_required", error: result.error },
        }));
        return;
      }

      const nextDocs: Partial<Record<ExtendedDocumentId, LocalDocState>> = {
        ...docs,
        [id]: {
          status: "uploaded",
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          dataUrl,
          uploadedAt,
        },
      };
      setDocs(nextDocs);
      syncProfile(nextDocs, bankDetails);
      const refreshed = await refreshTenantDocumentInvite(session.token);
      if (refreshed) {
        setInvite(refreshed);
        hydrateFromInvite(refreshed);
      }
      showSuccess(`${documentLabel(id)} updated successfully.`);
    } catch {
      setActionError("Upload failed. Check your connection and try again.");
      setDocs((prev) => ({
        ...prev,
        [id]: { status: "reupload_required", error: "Upload failed. Please try again." },
      }));
    } finally {
      setReplacingId(null);
    }
  };

  const handleBankSave = async (data: BankDetailsData) => {
    setActionError(null);
    const result = await submitDocumentUploadInvite(session.token, { draft: true, bankDetails: data });
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setBankDetails(data);
    const nextDocs = {
      ...docs,
      bank: { status: "uploaded" as UploadDocumentStatus, fileName: "Bank Account Details", uploadedAt: Date.now() },
    };
    setDocs(nextDocs);
    syncProfile(nextDocs, data);
    setBankModalOpen(false);
    const refreshed = await refreshTenantDocumentInvite(session.token);
    if (refreshed) {
      setInvite(refreshed);
      hydrateFromInvite(refreshed);
    }
    showSuccess("Bank details updated successfully.");
  };

  const handleRemoveDoc = async (id: ExtendedDocumentId) => {
    if (!canModify) return;
    setActionError(null);
    const result = await submitDocumentUploadInvite(session.token, {
      draft: true,
      removeDocumentIds: [id],
    });
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    const nextDocs = { ...docs, [id]: { status: "not_uploaded" as UploadDocumentStatus } };
    if (id === "bank") {
      setBankDetails(null);
    }
    setDocs(nextDocs);
    syncProfile(nextDocs, id === "bank" ? null : bankDetails);
    const refreshed = await refreshTenantDocumentInvite(session.token);
    if (refreshed) {
      setInvite(refreshed);
      hydrateFromInvite(refreshed);
    }
    showSuccess(`${documentLabel(id)} removed.`);
  };

  const handleViewDoc = async (id: ExtendedDocumentId) => {
    if (id === "bank") {
      setBankModalOpen(true);
      return;
    }
    const doc = docs[id];
    const profile = getTenantAccountProfile();
    const profileMeta = id === "aadhaar" ? profile.aadhaar : id === "pan" ? profile.pan : undefined;
    const fileName = doc?.fileName ?? profileMeta?.fileName;
    if (!fileName) return;

    const meta: TenantDocumentMeta = {
      documentId: id,
      sourceToken: session.token,
      fileName,
      fileSize: doc?.fileSize ?? profileMeta?.fileSize,
      mimeType: doc?.mimeType ?? profileMeta?.mimeType,
      uploadedAt: doc?.uploadedAt ?? profileMeta?.uploadedAt,
      dataUrl: doc?.dataUrl ?? profileMeta?.dataUrl,
      previewAvailable: Boolean(doc?.dataUrl ?? profileMeta?.dataUrl),
      verificationStatus: mapUploadStatusToVerification(
        doc?.status,
        invite.tenantDocumentStatus,
      ),
    };

    setViewingDoc(id);
    try {
      const dataUrl = await resolveTenantDocumentDataUrl(meta, session.token, id);
      if (!dataUrl) {
        setActionError("Could not load document preview.");
        return;
      }
      openTenantDocumentPreview(dataUrl, fileName);
    } finally {
      setViewingDoc(null);
    }
  };

  const verificationForDoc = useCallback(
    (id: ExtendedDocumentId, status: UploadDocumentStatus) =>
      mapUploadStatusToVerification(status, invite.tenantDocumentStatus),
    [invite.tenantDocumentStatus],
  );

  const fileDocIds = useMemo(
    () => invite.requestedDocumentIds.filter((id) => isFileDocumentId(id)),
    [invite.requestedDocumentIds],
  );

  const renderDocRow = (id: ExtendedDocumentId) => {
    const doc = docs[id] ?? { status: "not_uploaded" as UploadDocumentStatus };
    const label = documentLabel(id);
    const verification = verificationForDoc(id, doc.status);
    const isReplacing = replacingId === id || doc.status === "uploading";

    if (id === "bank") {
      return (
        <div key={id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">{label}</p>
              <p className="text-xs text-gray-500 mt-1">
                Upload status: {uploadStatusLabel(doc.status)}
              </p>
              {doc.uploadedAt ? (
                <p className="text-xs text-gray-400 mt-0.5">
                  Updated {formatDocumentUploadedAt(doc.uploadedAt)}
                </p>
              ) : null}
            </div>
            <TenantKycStatusBadge status={verification} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void handleViewDoc(id)}>
              View
            </Button>
            {canModify ? (
              <>
                <Button type="button" size="sm" variant="outline" onClick={() => setBankModalOpen(true)}>
                  Replace
                </Button>
                {doc.status === "uploaded" ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => void handleRemoveDoc(id)}>
                    Delete
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      );
    }

    return (
      <div key={id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex gap-3">
            <div className="mt-0.5 shrink-0">
              {doc.status === "uploaded" ? (
                <CheckCircle2 size={18} className="text-green-500" />
              ) : (
                <AlertTriangle size={18} className="text-amber-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">{label}</p>
              {doc.fileName ? (
                <p className="text-xs text-gray-500 mt-1 break-words">
                  {doc.fileName}
                  {doc.fileSize ? ` · ${fmtFileSize(doc.fileSize)}` : ""}
                  {doc.mimeType ? ` · ${formatDocumentMimeLabel(doc.mimeType)}` : ""}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">No file uploaded yet</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Upload status: {uploadStatusLabel(doc.status)}
              </p>
              {doc.uploadedAt ? (
                <p className="text-xs text-gray-400 mt-0.5">
                  Uploaded {formatDocumentUploadedAt(doc.uploadedAt)}
                </p>
              ) : null}
              {doc.error ? <p className="text-xs text-destructive mt-1">{doc.error}</p> : null}
            </div>
          </div>
          <TenantKycStatusBadge status={verification} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={doc.status !== "uploaded" || viewingDoc === id}
            onClick={() => void handleViewDoc(id)}
          >
            {viewingDoc === id ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
            View
          </Button>
          {canModify ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isReplacing}
                onClick={() => fileRefs.current[id]?.click()}
              >
                {isReplacing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                {doc.status === "uploaded" ? "Replace" : "Upload"}
              </Button>
              {doc.status === "uploaded" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleRemoveDoc(id)}
                >
                  <Trash2 size={14} />
                  Delete
                </Button>
              ) : null}
              <input
                ref={(el) => {
                  fileRefs.current[id] = el;
                }}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUpload(id, file);
                  e.target.value = "";
                }}
              />
            </>
          ) : null}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-6">
        <Loader2 size={32} className="animate-spin text-primary mb-4" />
        <p className="text-sm text-gray-500">Loading your documents…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7FA]">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setLocation("/tenant/dashboard")}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Dashboard
        </button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={refreshing}
          onClick={() => void loadInvite()}
        >
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh
        </Button>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-6 max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Document Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            View, replace, or update documents shared with {invite.requesterName}.
          </p>
        </div>

        {invite.propertyLabel ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6 flex gap-3 items-center">
            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <MapPin size={18} className="text-gray-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{invite.propertyLabel}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {invite.status === "submitted" ? "Documents submitted" : "In progress"}
              </p>
            </div>
          </div>
        ) : null}

        {actionError ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        ) : null}

        {actionSuccess ? (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {actionSuccess}
          </div>
        ) : null}

        {!canModify ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your agreement is being prepared. Document changes are locked until review is complete.
          </div>
        ) : null}

        <div className="space-y-3">
          {invite.requestedDocumentIds.map((id) => renderDocRow(id))}
        </div>

        {fileDocIds.every((id) => docs[id]?.status === "uploaded") &&
        (!invite.requestedDocumentIds.includes("bank") || docs.bank?.status === "uploaded") ? (
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            All requested documents are on file. {invite.requesterName} can continue the agreement process.
          </div>
        ) : null}
      </main>

      {bankModalOpen ? (
        <BankDetailsModal onSave={(data) => void handleBankSave(data)} onClose={() => setBankModalOpen(false)} />
      ) : null}
    </div>
  );
}
