import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Landmark,
  Loader2,
  Upload,
  User,
} from "lucide-react";
import TenantLayout from "@/components/TenantLayout";
import { ProfileSectionHeader } from "@/components/profile/ProfileSectionHeader";
import { TenantKycStatusBadge } from "@/components/tenant/TenantKycStatusBadge";
import { toast } from "@/hooks/use-toast";
import { getFileTypeError } from "@/lib/fileValidation";
import {
  fetchDocumentUploadInvite,
  readFileAsDataUrl,
  submitDocumentUploadInvite,
} from "@/lib/publicAgreementDocumentUpload";
import { getActiveSession } from "@/lib/storageKeys";
import {
  getTenantAccountProfile,
  maskAccountNumber,
  mergeTenantProfileFromDocumentUpload,
  mergeTenantProfileFromInvitePayload,
  saveTenantAccountProfile,
  TENANT_PROFILE_UPDATED_EVENT,
  type TenantAccountProfile,
  type TenantDocumentMeta,
  type TenantKycVerificationStatus,
} from "@/lib/tenantProfile";
import {
  formatDocumentMimeLabel,
  formatDocumentUploadedAt,
  openTenantDocumentPreview,
  resolveTenantDocumentDataUrl,
  tenantDocumentCanPreview,
  tenantDocumentHasPersistedRecord,
} from "@/lib/tenantProfileDocument";
import { getActiveTenantWorkspace } from "@/lib/tenantWorkspace";
import { cn } from "@/lib/utils";
import type { ExtendedDocumentId } from "@workspace/tenant-document-upload";

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium text-gray-500 mb-1">{children}</p>;
}

function ReadOnlyValue({ children }: { children: ReactNode }) {
  return <p className="text-sm font-medium text-gray-900 break-words">{children}</p>;
}

function formatDate(ts?: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-10);
  return digits.length === 10 ? `+91 ${digits}` : phone || "—";
}

function ProfileDocumentRow({
  label,
  meta,
  status,
  documentId,
  onView,
  onReplace,
  replacing,
}: {
  label: string;
  meta?: TenantDocumentMeta;
  status: TenantKycVerificationStatus;
  documentId: ExtendedDocumentId;
  onView: (documentId: ExtendedDocumentId, meta?: TenantDocumentMeta) => void;
  onReplace: (file: File) => void;
  replacing: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploaded = tenantDocumentHasPersistedRecord(meta);
  const canPreview = tenantDocumentCanPreview(meta);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center rounded-xl border px-4 py-3",
        uploaded ? "bg-white border-gray-200" : "bg-amber-50/40 border-amber-100",
      )}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <FileText size={18} className={uploaded ? "text-green-500" : "text-amber-500"} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-sm font-medium text-gray-900">{label}</p>
            <TenantKycStatusBadge status={status} />
          </div>
          {uploaded ? (
            <div className="space-y-0.5">
              <p className="text-xs text-gray-500 truncate">{meta?.fileName}</p>
              <p className="text-xs text-gray-400">
                {formatDocumentMimeLabel(meta?.mimeType)}
                {meta?.uploadedAt ? ` · ${formatDocumentUploadedAt(meta.uploadedAt)}` : ""}
              </p>
              {!canPreview ? (
                <p className="text-xs text-gray-400">Saved on server — view will fetch the file when online.</p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-amber-700">Not uploaded yet</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          disabled={!uploaded}
          onClick={() => onView(documentId, meta)}
          className="flex items-center gap-1 text-xs text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 disabled:opacity-40"
        >
          <Eye size={12} /> View
        </button>
        {uploaded && canPreview && meta?.dataUrl ? (
          <a
            href={meta.dataUrl}
            download={meta.fileName}
            className="flex items-center gap-1 text-xs text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50"
          >
            <Download size={12} /> Download
          </a>
        ) : null}
        <button
          type="button"
          disabled={replacing}
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 text-xs bg-primary text-white rounded-lg px-3 py-1.5 font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {replacing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          {uploaded ? "Replace" : "Upload"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onReplace(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

export default function TenantProfile() {
  const [profile, setProfile] = useState<TenantAccountProfile>(() => getTenantAccountProfile());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingBasic, setEditingBasic] = useState(false);
  const [draftBasic, setDraftBasic] = useState({ name: profile.name, email: profile.email });
  const [replacingDoc, setReplacingDoc] = useState<ExtendedDocumentId | null>(null);
  const [viewingDoc, setViewingDoc] = useState<ExtendedDocumentId | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const workspace = getActiveTenantWorkspace();

  const refreshProfile = () => {
    setProfile(getTenantAccountProfile());
  };

  useEffect(() => {
    const hydrate = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        let next = getTenantAccountProfile();
        const token = next.documentUploadToken ?? workspace?.documentUploadToken;
        if (token) {
          const { payload, error } = await fetchDocumentUploadInvite(token);
          if (payload) {
            next = mergeTenantProfileFromInvitePayload(payload);
          } else if (error) {
            setLoadError(error);
          }
        }
        setProfile(next);
        setDraftBasic({ name: next.name, email: next.email });
      } finally {
        setLoading(false);
      }
    };
    void hydrate();
    const onUpdate = () => refreshProfile();
    window.addEventListener(TENANT_PROFILE_UPDATED_EVENT, onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.removeEventListener(TENANT_PROFILE_UPDATED_EVENT, onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, [workspace?.documentUploadToken]);

  const persistProfile = (next: TenantAccountProfile) => {
    saveTenantAccountProfile(next);
    setProfile(next);
  };

  const saveBasic = () => {
    if (!draftBasic.name.trim()) {
      toast({
        title: "Name required",
        description: "Enter your full name to save your profile.",
        variant: "destructive",
      });
      return;
    }
    persistProfile({
      ...profile,
      name: draftBasic.name.trim(),
      email: draftBasic.email.trim(),
    });
    setEditingBasic(false);
    toast({ title: "Profile updated", description: "Your basic details have been saved." });
  };

  const cancelBasic = () => {
    setDraftBasic({ name: profile.name, email: profile.email });
    setEditingBasic(false);
  };

  const handlePhotoUpload = async (file: File) => {
    const error = getFileTypeError(file);
    if (error) {
      toast({ title: "Invalid file", description: error, variant: "destructive" });
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      persistProfile({ ...profile, profilePhotoUrl: dataUrl });
      toast({ title: "Photo updated", description: "Your profile photo has been saved." });
    } catch {
      toast({
        title: "Upload failed",
        description: "Could not read the image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReplaceDocument = async (docId: ExtendedDocumentId, file: File) => {
    const token = profile.documentUploadToken ?? workspace?.documentUploadToken;
    if (!token) {
      toast({
        title: "Upload link unavailable",
        description: "Use the document collection link shared by your owner or broker.",
        variant: "destructive",
      });
      return;
    }
    const error = getFileTypeError(file);
    if (error) {
      toast({ title: "Invalid file", description: error, variant: "destructive" });
      return;
    }
    setReplacingDoc(docId);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const result = await submitDocumentUploadInvite(token, {
        draft: true,
        documents: {
          [docId]: {
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            dataUrl,
          },
        },
      });
      if (!result.ok) {
        toast({ title: "Upload failed", description: result.error, variant: "destructive" });
        return;
      }
      const { payload } = await fetchDocumentUploadInvite(token);
      if (payload) {
        const next = mergeTenantProfileFromInvitePayload(payload, {
          [docId]: {
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            dataUrl,
          },
        });
        setProfile(next);
      } else {
        mergeTenantProfileFromDocumentUpload({
          token,
          documentStatuses: { [docId]: "uploaded" },
          documents: {
            [docId]: {
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
              dataUrl,
            },
          },
        });
        refreshProfile();
      }
      toast({ title: "Document updated", description: "Your document has been saved to your profile." });
    } finally {
      setReplacingDoc(null);
    }
  };

  const viewDocument = async (documentId: ExtendedDocumentId, meta?: TenantDocumentMeta) => {
    if (!tenantDocumentHasPersistedRecord(meta)) {
      toast({
        title: "No document on file",
        description: "Upload this document to add it to your profile.",
        variant: "destructive",
      });
      return;
    }

    const token = meta?.sourceToken ?? profile.documentUploadToken ?? workspace?.documentUploadToken;
    setViewingDoc(documentId);
    try {
      const dataUrl = await resolveTenantDocumentDataUrl(meta, token, documentId);
      if (!dataUrl) {
        toast({
          title: "Preview unavailable offline",
          description: `${meta?.fileName ?? "Document"} is saved. Connect to the internet to view or download it.`,
        });
        return;
      }
      if (meta && !meta.dataUrl && dataUrl) {
        if (documentId === "aadhaar") {
          persistProfile({ ...profile, aadhaar: { ...meta, dataUrl, previewAvailable: true } });
        } else if (documentId === "pan") {
          persistProfile({ ...profile, pan: { ...meta, dataUrl, previewAvailable: true } });
        } else if (profile.governmentId) {
          persistProfile({ ...profile, governmentId: { ...meta, dataUrl, previewAvailable: true } });
        }
      }
      openTenantDocumentPreview(dataUrl, meta?.fileName ?? "document");
    } finally {
      setViewingDoc(null);
    }
  };

  const session = getActiveSession();
  const avatarUrl =
    profile.profilePhotoUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || "Tenant")}&background=EBF4FF&color=1E40AF&size=128`;

  const bank = profile.bankDetails;
  const rental = profile.rental;
  const hasRentalData = Boolean(
    rental?.occupancyType ||
      rental?.moveInTimeline ||
      rental?.foodPreference ||
      rental?.sharingPreference,
  );

  return (
    <TenantLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-[28px] font-semibold text-primary leading-tight">My Profile</h1>
            <p className="text-sm text-gray-500 mt-1">
              Your KYC and rental details from onboarding and document collection.
            </p>
          </div>
          <Link
            href="/tenant/dashboard"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Back to Dashboard <ChevronRight size={14} />
          </Link>
        </div>

        {loadError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{loadError}. Showing saved profile details.</span>
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 flex items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 size={18} className="animate-spin text-primary" />
            Loading your profile…
          </div>
        ) : null}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-6 sm:px-6 flex flex-col sm:flex-row items-center sm:items-start gap-4 border-b border-gray-100">
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              className="relative w-20 h-20 rounded-full overflow-hidden bg-gray-100 shrink-0 ring-2 ring-white shadow"
            >
              <img src={avatarUrl} alt={profile.name || "Tenant"} className="w-full h-full object-cover" />
            </button>
            <input
              ref={photoRef}
              type="file"
              accept=".jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handlePhotoUpload(file);
                e.target.value = "";
              }}
            />
            <div className="text-center sm:text-left">
              <p className="text-lg font-semibold text-gray-900">{profile.name || "Tenant"}</p>
              <p className="text-sm text-gray-500">{formatPhone(profile.phone || session?.phone || "")}</p>
              <div className="mt-2">
                <TenantKycStatusBadge status={profile.overallKycStatus} />
              </div>
            </div>
          </div>

          <ProfileSectionHeader
            icon={User}
            title="Basic Information"
            editing={editingBasic}
            saved={!!profile.name}
            onEdit={() => setEditingBasic(true)}
            onSave={saveBasic}
            onCancel={cancelBasic}
          />
          <div className="px-5 py-5 sm:px-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Full Name</FieldLabel>
              {editingBasic ? (
                <input
                  value={draftBasic.name}
                  onChange={(e) => setDraftBasic((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              ) : (
                <ReadOnlyValue>{profile.name || "—"}</ReadOnlyValue>
              )}
            </div>
            <div>
              <FieldLabel>Mobile Number</FieldLabel>
              <ReadOnlyValue>{formatPhone(profile.phone)}</ReadOnlyValue>
            </div>
            <div>
              <FieldLabel>Email Address</FieldLabel>
              {editingBasic ? (
                <input
                  type="email"
                  value={draftBasic.email}
                  onChange={(e) => setDraftBasic((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              ) : (
                <ReadOnlyValue>{profile.email || "—"}</ReadOnlyValue>
              )}
            </div>
            <div>
              <FieldLabel>Gender</FieldLabel>
              <ReadOnlyValue>{profile.gender || "—"}</ReadOnlyValue>
            </div>
            <div>
              <FieldLabel>Date Created</FieldLabel>
              <ReadOnlyValue>{formatDate(profile.createdAt)}</ReadOnlyValue>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <ProfileSectionHeader
            icon={FileText}
            title="KYC Information"
            editing={false}
            saved={!!profile.aadhaar?.fileName || !!profile.pan?.fileName}
          />
          <div className="px-5 py-5 sm:px-6 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <FieldLabel>Overall Verification</FieldLabel>
                <TenantKycStatusBadge status={profile.overallKycStatus} />
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <FieldLabel>Government ID Status</FieldLabel>
                <TenantKycStatusBadge
                  status={profile.governmentId?.verificationStatus ?? profile.aadhaar?.verificationStatus ?? "pending_upload"}
                />
              </div>
            </div>
            <ProfileDocumentRow
              label="Aadhaar Card"
              meta={profile.aadhaar}
              documentId="aadhaar"
              status={profile.aadhaar?.verificationStatus ?? "pending_upload"}
              onView={(documentId, meta) => void viewDocument(documentId, meta)}
              onReplace={(file) => void handleReplaceDocument("aadhaar", file)}
              replacing={replacingDoc === "aadhaar" || viewingDoc === "aadhaar"}
            />
            <ProfileDocumentRow
              label="PAN Card"
              meta={profile.pan}
              documentId="pan"
              status={profile.pan?.verificationStatus ?? "pending_upload"}
              onView={(documentId, meta) => void viewDocument(documentId, meta)}
              onReplace={(file) => void handleReplaceDocument("pan", file)}
              replacing={replacingDoc === "pan" || viewingDoc === "pan"}
            />
            {!profile.aadhaar?.fileName && !profile.pan?.fileName ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center">
                <p className="text-sm text-gray-600 mb-3">No KYC documents on your profile yet.</p>
                {profile.documentUploadToken || workspace?.documentUploadToken ? (
                  <Link
                    href={`/upload/documents/${profile.documentUploadToken ?? workspace?.documentUploadToken}`}
                    className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90"
                  >
                    Continue Document Collection
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <ProfileSectionHeader
            icon={Landmark}
            title="Bank Details"
            editing={false}
            saved={!!bank?.holderName || !!bank?.upiId}
          />
          <div className="px-5 py-5 sm:px-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bank?.mode === "upi" ? (
              <>
                <div>
                  <FieldLabel>Payment Method</FieldLabel>
                  <ReadOnlyValue>UPI</ReadOnlyValue>
                </div>
                <div>
                  <FieldLabel>UPI ID</FieldLabel>
                  <ReadOnlyValue>{bank.upiId || "—"}</ReadOnlyValue>
                </div>
              </>
            ) : bank?.holderName ? (
              <>
                <div>
                  <FieldLabel>Account Holder Name</FieldLabel>
                  <ReadOnlyValue>{bank.holderName}</ReadOnlyValue>
                </div>
                <div>
                  <FieldLabel>Bank Name</FieldLabel>
                  <ReadOnlyValue>{bank.bankName || "—"}</ReadOnlyValue>
                </div>
                <div>
                  <FieldLabel>Account Number</FieldLabel>
                  <ReadOnlyValue>
                    {bank.accountNumber ? maskAccountNumber(bank.accountNumber) : "—"}
                  </ReadOnlyValue>
                </div>
                <div>
                  <FieldLabel>IFSC</FieldLabel>
                  <ReadOnlyValue>{bank.ifscCode || "—"}</ReadOnlyValue>
                </div>
                <div>
                  <FieldLabel>Verification Status</FieldLabel>
                  <TenantKycStatusBadge status={profile.bankVerificationStatus} />
                </div>
              </>
            ) : (
              <div className="sm:col-span-2 rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
                Bank details will appear here after you submit them in document collection.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <ProfileSectionHeader icon={Building2} title="Rental Information" editing={false} saved={hasRentalData} />
          <div className="px-5 py-5 sm:px-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FieldLabel>Current Property</FieldLabel>
              <ReadOnlyValue>{workspace?.propertyLabel || "No property assigned yet"}</ReadOnlyValue>
            </div>
            <div>
              <FieldLabel>Occupancy Type</FieldLabel>
              <ReadOnlyValue>
                {rental?.occupancyType
                  ? rental.occupancyOther
                    ? `${rental.occupancyType} (${rental.occupancyOther})`
                    : rental.occupancyType
                  : "—"}
              </ReadOnlyValue>
            </div>
            <div>
              <FieldLabel>Move-in Timeline</FieldLabel>
              <ReadOnlyValue>{rental?.moveInTimeline || "—"}</ReadOnlyValue>
            </div>
            <div>
              <FieldLabel>Food Preference</FieldLabel>
              <ReadOnlyValue>{rental?.foodPreference || "—"}</ReadOnlyValue>
            </div>
            <div>
              <FieldLabel>Sharing Preference</FieldLabel>
              <ReadOnlyValue>{rental?.sharingPreference || "—"}</ReadOnlyValue>
            </div>
            {!hasRentalData && !workspace?.propertyLabel ? (
              <div className="sm:col-span-2 rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
                Rental preferences from onboarding will appear here once shared with your broker.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </TenantLayout>
  );
}
