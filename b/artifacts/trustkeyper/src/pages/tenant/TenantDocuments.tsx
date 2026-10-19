import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import TenantLayout from "@/components/TenantLayout";
import { TenantDocumentsEmptyState } from "@/components/tenant/TenantDocumentsEmptyState";
import { TenantDocumentsPropertyCard } from "@/components/tenant/TenantDocumentsPropertyCard";
import { TenantDocumentsTableCard } from "@/components/tenant/TenantDocumentsTableCard";
import { TenantRentBackLink } from "@/components/tenant/TenantRentBackLink";
import {
  fetchDocumentUploadInvite,
  type DocumentUploadInvitePayload,
} from "@/lib/publicAgreementDocumentUpload";
import { TENANT_DOCUMENT_MANAGEMENT_UPDATED_EVENT } from "@/lib/tenantDocumentManagementSync";
import {
  buildTenantDocumentTableRows,
  countUploadedTenantDocuments,
  type TenantDocumentTableRow,
} from "@/lib/tenantDocuments";
import {
  openTenantDocumentPreview,
  resolveTenantDocumentDataUrl,
} from "@/lib/tenantProfileDocument";
import { getTenantAccountProfile } from "@/lib/tenantProfile";
import { getActiveTenantWorkspace } from "@/lib/tenantWorkspace";
import { documentsAlreadySubmittedForInvite } from "@/lib/tenantReturningAccess";

export default function TenantDocuments() {
  const workspace = getActiveTenantWorkspace();
  const profile = getTenantAccountProfile();
  const [invite, setInvite] = useState<DocumentUploadInvitePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const token = workspace?.documentUploadToken ?? profile.documentUploadToken;

  const loadDocuments = useCallback(async () => {
    if (!token) {
      setInvite(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { payload, error: fetchError } = await fetchDocumentUploadInvite(token);
    if (!payload) {
      setError(fetchError ?? "Could not load your documents.");
      setInvite(null);
    } else {
      setInvite(payload);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void loadDocuments();
    const onRefresh = () => void loadDocuments();
    window.addEventListener(TENANT_DOCUMENT_MANAGEMENT_UPDATED_EVENT, onRefresh);
    return () => window.removeEventListener(TENANT_DOCUMENT_MANAGEMENT_UPDATED_EVENT, onRefresh);
  }, [loadDocuments]);

  const rows = useMemo(
    () => buildTenantDocumentTableRows({ invite, profile, token }),
    [invite, profile, token],
  );

  const documentsSubmitted =
    invite &&
    documentsAlreadySubmittedForInvite({
      status: invite.status,
      tenantDocumentStatus: invite.tenantDocumentStatus,
    });
  const manageHref = documentsSubmitted ? undefined : token ? `/upload/documents/${token}` : undefined;

  const propertyTitle =
    workspace?.propertyAddress?.trim() ||
    workspace?.propertyLabel?.trim() ||
    invite?.propertyLabel?.trim() ||
    "Assigned Property";
  const propertySubtitle = invite?.requesterName
    ? `Requested by ${invite.requesterName}`
    : workspace?.ownerName
      ? `Managed by ${workspace.ownerName}`
      : undefined;

  const handleView = async (row: TenantDocumentTableRow) => {
    if (!token || !row.meta || (row.id !== "aadhaar" && row.id !== "pan")) return;
    setViewingId(row.id);
    setError(null);
    try {
      const dataUrl = await resolveTenantDocumentDataUrl(row.meta, token, row.id);
      if (!dataUrl) {
        setError("Could not open document preview.");
        return;
      }
      openTenantDocumentPreview(dataUrl, row.meta.fileName ?? row.id);
    } finally {
      setViewingId(null);
    }
  };

  const showEmptyState = !loading && !token;
  const uploadedCount = countUploadedTenantDocuments(rows);

  return (
    <TenantLayout>
      <div className="max-w-6xl mx-auto space-y-7">
        <TenantRentBackLink />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl text-[#192839]">Documents</h1>
            <p className="text-sm text-[#40566d] mt-1 tracking-wide">
              {loading
                ? "Loading your document status…"
                : `${uploadedCount} of ${rows.length} documents uploaded`}
            </p>
          </div>
          {manageHref ? (
            <Link href={manageHref}>
              <Button type="button" className="h-12 px-5 rounded text-base font-normal gap-2 w-full sm:w-auto">
                <ExternalLink size={16} />
                Manage Documents
              </Button>
            </Link>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex gap-3 items-start">
            <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-700">{error}</p>
              {token ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 h-9"
                  onClick={() => void loadDocuments()}
                >
                  Try again
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {showEmptyState ? (
          <TenantDocumentsEmptyState
            title="No documents yet"
            description="When your property owner or broker requests documents, they will appear here for review and management."
          />
        ) : (
          <>
            <TenantDocumentsPropertyCard
              propertyTitle={propertyTitle}
              propertySubtitle={propertySubtitle}
              loading={loading}
            />

            <TenantDocumentsTableCard
              rows={rows}
              loading={loading}
              viewingId={viewingId}
              onView={(row) => void handleView(row)}
            />
          </>
        )}
      </div>
    </TenantLayout>
  );
}
