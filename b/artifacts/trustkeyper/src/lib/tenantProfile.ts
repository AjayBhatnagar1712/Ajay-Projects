import type {
  ExtendedDocumentId,
  StoredBankDetails,
  TenantDocumentUploadStatus,
  UploadDocumentStatus,
} from "@workspace/tenant-document-upload";
import { queueCloudSync, queueCloudSyncForAccount } from "./cloudSync";
import type { DocumentUploadInvitePayload } from "./publicAgreementDocumentUpload";
import {
  getActiveSession,
  getItem,
  getSessionItem,
  setItem,
  setSessionItem,
  storageKey,
  writeLocalForAccount,
} from "./storageKeys";
import {
  formatTenantKycStatusLabel,
  normalizeTenantKycStatus,
  type TenantKycVerificationStatus,
} from "./tenantKycStatus";
import { getActiveTenantWorkspace } from "./tenantWorkspace";

export { TENANT_KYC_STATUSES, TENANT_KYC_STATUS_LABELS, TENANT_KYC_STATUS_STYLES } from "./tenantKycStatus";
export type { TenantKycVerificationStatus } from "./tenantKycStatus";
export { formatTenantKycStatusLabel };

export const TENANT_PROFILE_UPDATED_EVENT = "tk-tenant-profile-updated";

export interface TenantDocumentMeta {
  documentId?: ExtendedDocumentId;
  sourceToken?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: number;
  dataUrl?: string;
  previewAvailable?: boolean;
  verificationStatus: TenantKycVerificationStatus;
}

export interface TenantRentalPreferences {
  propertyId?: string;
  propertyLabel?: string;
  occupancyType?: string;
  occupancyOther?: string;
  moveInTimeline?: string;
  foodPreference?: string;
  sharingPreference?: string;
  roommatePreference?: string;
  propertyType?: string;
  city?: string;
  localities?: string[];
  updatedAt?: number;
}

export interface TenantAccountProfile {
  name: string;
  phone: string;
  email: string;
  gender?: string;
  profilePhotoUrl?: string;
  createdAt: number;
  aadhaar?: TenantDocumentMeta;
  pan?: TenantDocumentMeta;
  governmentId?: TenantDocumentMeta;
  bankDetails?: StoredBankDetails;
  bankVerificationStatus: TenantKycVerificationStatus;
  overallKycStatus: TenantKycVerificationStatus;
  rental?: TenantRentalPreferences;
  documentUploadToken?: string;
  propertyId?: string;
  propertyLabel?: string;
  kycSyncedAt?: number;
}

const defaults: TenantAccountProfile = {
  name: "",
  phone: "",
  email: "",
  createdAt: Date.now(),
  bankVerificationStatus: "pending_upload",
  overallKycStatus: "pending_upload",
};

function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

/** Legacy cache key — migrated into cloud-synced profile on read. */
function legacyRentalPrefsStorageKey(digits: string): string {
  return `tk_${digits}_tenant_rental_prefs`;
}

export function broadcastTenantProfileUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TENANT_PROFILE_UPDATED_EVENT));
}

export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `****${digits.slice(-4)}`;
}

export function mapUploadStatusToVerification(
  status: UploadDocumentStatus | undefined,
  tenantDocumentStatus?: TenantDocumentUploadStatus,
): TenantKycVerificationStatus {
  if (status === "rejected") return "rejected";
  if (status === "reupload_required") return "requires_reupload";
  if (status === "uploaded") {
    return "under_review";
  }
  if (tenantDocumentStatus === "documents_submitted" || tenantDocumentStatus === "agreement_ready") {
    return "under_review";
  }
  return "pending_upload";
}

export function resolveOverallKycStatus(profile: TenantAccountProfile): TenantKycVerificationStatus {
  const docStatuses = [
    profile.aadhaar?.verificationStatus,
    profile.pan?.verificationStatus,
    profile.governmentId?.verificationStatus,
  ]
    .filter((status): status is TenantKycVerificationStatus => !!status)
    .map((status) => normalizeTenantKycStatus(status));

  if (docStatuses.some((status) => status === "rejected")) return "rejected";
  if (docStatuses.some((status) => status === "requires_reupload")) return "requires_reupload";
  if (docStatuses.length === 0) return "pending_upload";
  if (docStatuses.every((status) => status === "verified")) return "verified";
  if (docStatuses.some((status) => status === "under_review")) return "under_review";
  return normalizeTenantKycStatus(profile.overallKycStatus);
}

function readLegacyRentalPreferences(digits: string): TenantRentalPreferences | undefined {
  if (typeof window === "undefined" || !digits) return undefined;
  const raw = localStorage.getItem(legacyRentalPrefsStorageKey(digits));
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as TenantRentalPreferences;
  } catch {
    return undefined;
  }
}

function clearLegacyRentalPreferences(digits: string): void {
  if (typeof window === "undefined" || !digits) return;
  localStorage.removeItem(legacyRentalPrefsStorageKey(digits));
}

function normalizeDocumentMeta(
  meta: TenantDocumentMeta | undefined,
): TenantDocumentMeta | undefined {
  if (!meta) return undefined;
  return {
    ...meta,
    verificationStatus: normalizeTenantKycStatus(meta.verificationStatus),
    previewAvailable: Boolean(meta.previewAvailable ?? meta.dataUrl),
  };
}

function normalizeProfile(stored: Partial<TenantAccountProfile>, digits: string): TenantAccountProfile {
  const workspace = getActiveTenantWorkspace();
  const name =
    stored.name?.trim() ||
    getSessionItem("name")?.replace(/!$/, "") ||
    workspace?.tenantName ||
    "";

  const rental =
    stored.rental ??
    readLegacyRentalPreferences(digits);

  const profile: TenantAccountProfile = {
    ...defaults,
    ...stored,
    name,
    phone: digits,
    email: stored.email ?? "",
    createdAt: stored.createdAt ?? Date.now(),
    rental,
    propertyId: stored.propertyId ?? workspace?.propertyId ?? rental?.propertyId,
    propertyLabel: stored.propertyLabel ?? workspace?.propertyLabel ?? rental?.propertyLabel,
    documentUploadToken: stored.documentUploadToken ?? workspace?.documentUploadToken,
    bankVerificationStatus: normalizeTenantKycStatus(stored.bankVerificationStatus, "pending_upload"),
    overallKycStatus: normalizeTenantKycStatus(stored.overallKycStatus, "pending_upload"),
    aadhaar: normalizeDocumentMeta(stored.aadhaar),
    pan: normalizeDocumentMeta(stored.pan),
    governmentId: normalizeDocumentMeta(stored.governmentId),
  };
  profile.overallKycStatus = resolveOverallKycStatus(profile);

  if (rental && !stored.rental && digits) {
    clearLegacyRentalPreferences(digits);
  }

  return profile;
}

function readStoredForPhone(digits: string): TenantAccountProfile {
  if (typeof window === "undefined") return { ...defaults };
  try {
    const raw = localStorage.getItem(storageKey(digits, "tenant", "profile"));
    const stored = raw ? (JSON.parse(raw) as Partial<TenantAccountProfile>) : {};
    return normalizeProfile(stored, digits);
  } catch {
    return normalizeProfile({}, digits);
  }
}

function readStored(): TenantAccountProfile {
  if (typeof window === "undefined") return { ...defaults };
  const session = getActiveSession();
  if (session?.role === "tenant") {
    return readStoredForPhone(phoneDigits(session.phone));
  }
  try {
    const raw = getItem("profile");
    const stored = raw ? (JSON.parse(raw) as Partial<TenantAccountProfile>) : {};
    const digits = phoneDigits(
      stored.phone || getSessionItem("phone") || "",
    );
    if (digits.length === 10) return normalizeProfile(stored, digits);
    return normalizeProfile(stored, digits);
  } catch {
    const digits = phoneDigits(getSessionItem("phone") || "");
    return normalizeProfile({}, digits);
  }
}

export function getTenantAccountProfileForPhone(phone: string): TenantAccountProfile {
  return readStoredForPhone(phoneDigits(phone));
}

export function getTenantAccountProfile(): TenantAccountProfile {
  return readStored();
}

export function saveTenantAccountProfile(profile: TenantAccountProfile): void {
  const digits = phoneDigits(profile.phone);
  if (digits.length !== 10) return;
  const payload: TenantAccountProfile = {
    ...profile,
    phone: digits,
    overallKycStatus: resolveOverallKycStatus(profile),
    bankVerificationStatus: normalizeTenantKycStatus(profile.bankVerificationStatus),
    aadhaar: normalizeDocumentMeta(profile.aadhaar),
    pan: normalizeDocumentMeta(profile.pan),
    governmentId: normalizeDocumentMeta(profile.governmentId),
  };
  const json = JSON.stringify(payload);
  const session = getActiveSession();
  if (session?.role === "tenant" && phoneDigits(session.phone) === digits) {
    setItem("profile", json);
    if (payload.name) setSessionItem("name", payload.name);
    if (digits) setSessionItem("phone", digits);
  } else {
    writeLocalForAccount(digits, "tenant", "profile", json, false);
  }
  queueCloudSyncForAccount(digits, "tenant", "profile", json);
  if (payload.rental) {
    clearLegacyRentalPreferences(digits);
  }
  broadcastTenantProfileUpdated();
}

export function saveTenantRentalPreferences(
  phone: string,
  rental: TenantRentalPreferences,
  propertyContext?: { propertyId?: string; propertyLabel?: string },
): void {
  const profile = getTenantAccountProfile();
  const digits = phoneDigits(phone);
  const nextRental: TenantRentalPreferences = {
    ...rental,
    propertyId: propertyContext?.propertyId ?? profile.propertyId ?? rental.propertyId,
    propertyLabel: propertyContext?.propertyLabel ?? profile.propertyLabel ?? rental.propertyLabel,
    updatedAt: Date.now(),
  };
  saveTenantAccountProfile({
    ...profile,
    phone: digits || profile.phone,
    rental: nextRental,
    propertyId: nextRental.propertyId,
    propertyLabel: nextRental.propertyLabel,
  });
}

type UploadDocInput = {
  fileName: string;
  fileSize: number;
  mimeType: string;
  dataUrl?: string;
  uploadedAt?: number;
};

function mergeDocumentMeta(
  existing: TenantDocumentMeta | undefined,
  file: UploadDocInput | undefined,
  uploadStatus: UploadDocumentStatus | undefined,
  tenantDocumentStatus: TenantDocumentUploadStatus | undefined,
  source: { token: string; documentId: ExtendedDocumentId },
): TenantDocumentMeta | undefined {
  if (!file?.fileName && !existing?.fileName) return undefined;

  const dataUrl = file?.dataUrl ?? existing?.dataUrl;
  const verificationStatus = existing?.verificationStatus === "verified"
    ? "verified"
    : mapUploadStatusToVerification(uploadStatus ?? (dataUrl ? "uploaded" : "not_uploaded"), tenantDocumentStatus);

  return {
    documentId: source.documentId,
    sourceToken: source.token,
    fileName: file?.fileName ?? existing?.fileName,
    fileSize: file?.fileSize ?? existing?.fileSize,
    mimeType: file?.mimeType ?? existing?.mimeType,
    dataUrl,
    uploadedAt: file?.uploadedAt ?? existing?.uploadedAt ?? Date.now(),
    previewAvailable: Boolean(dataUrl),
    verificationStatus,
  };
}

export function mergeTenantProfileFromDocumentUpload(input: {
  token: string;
  tenantName?: string;
  tenantPhone?: string;
  propertyId?: string;
  propertyLabel?: string;
  documentStatuses: Partial<Record<ExtendedDocumentId, UploadDocumentStatus>>;
  documents: Partial<Record<ExtendedDocumentId, UploadDocInput>>;
  bankDetails?: StoredBankDetails;
  tenantDocumentStatus?: TenantDocumentUploadStatus;
  submitted?: boolean;
}): TenantAccountProfile {
  const digits = phoneDigits(input.tenantPhone ?? "");
  const current =
    digits.length === 10
      ? getTenantAccountProfileForPhone(digits)
      : getTenantAccountProfile();
  const tenantDocumentStatus = input.tenantDocumentStatus;

  const aadhaar = mergeDocumentMeta(
    current.aadhaar,
    input.documents.aadhaar,
    input.documentStatuses.aadhaar,
    tenantDocumentStatus,
    { token: input.token, documentId: "aadhaar" },
  );
  const pan = mergeDocumentMeta(
    current.pan,
    input.documents.pan,
    input.documentStatuses.pan,
    tenantDocumentStatus,
    { token: input.token, documentId: "pan" },
  );
  const passport = mergeDocumentMeta(
    current.governmentId,
    input.documents.passport,
    input.documentStatuses.passport,
    tenantDocumentStatus,
    { token: input.token, documentId: "passport" },
  );
  const drivingLicense = mergeDocumentMeta(
    current.governmentId,
    input.documents.driving_license,
    input.documentStatuses.driving_license,
    tenantDocumentStatus,
    { token: input.token, documentId: "driving_license" },
  );
  const governmentId = passport ?? drivingLicense ?? aadhaar;

  const bankVerificationStatus: TenantKycVerificationStatus = input.bankDetails
    ? mapUploadStatusToVerification(
        input.documentStatuses.bank ?? "uploaded",
        tenantDocumentStatus,
      )
    : current.bankVerificationStatus;

  const next: TenantAccountProfile = {
    ...current,
    name: input.tenantName?.trim() || current.name,
    phone: digits || current.phone,
    documentUploadToken: input.token,
    propertyId: input.propertyId ?? current.propertyId,
    propertyLabel: input.propertyLabel ?? current.propertyLabel,
    aadhaar: aadhaar ?? current.aadhaar,
    pan: pan ?? current.pan,
    governmentId: governmentId ?? current.governmentId,
    bankDetails: input.bankDetails ?? current.bankDetails,
    bankVerificationStatus,
    kycSyncedAt: Date.now(),
    createdAt: current.createdAt || Date.now(),
  };

  next.overallKycStatus = resolveOverallKycStatus(next);
  saveTenantAccountProfile(next);
  return next;
}

export function mergeTenantProfileFromInvitePayload(
  invite: DocumentUploadInvitePayload,
  documentsWithData?: Partial<Record<ExtendedDocumentId, UploadDocInput>>,
): TenantAccountProfile {
  const current = getTenantAccountProfile();
  const mergedDocuments: Partial<Record<ExtendedDocumentId, UploadDocInput>> = {};

  for (const [id, file] of Object.entries(invite.documents ?? {})) {
    const docId = id as ExtendedDocumentId;
    if (invite.documentStatuses[docId] !== "uploaded") continue;
    const withData = documentsWithData?.[docId];
    const existing =
      docId === "aadhaar"
        ? current.aadhaar
        : docId === "pan"
          ? current.pan
          : current.governmentId;

    mergedDocuments[docId] = {
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      uploadedAt: file.uploadedAt,
      dataUrl: withData?.dataUrl ?? existing?.dataUrl,
    };
  }
  for (const [id, file] of Object.entries(documentsWithData ?? {})) {
    if (!file) continue;
    mergedDocuments[id as ExtendedDocumentId] = file;
  }

  return mergeTenantProfileFromDocumentUpload({
    token: invite.token,
    tenantName: invite.tenantName,
    tenantPhone: invite.tenantPhone,
    propertyId: invite.propertyId,
    propertyLabel: invite.propertyLabel,
    documentStatuses: invite.documentStatuses,
    documents: mergedDocuments,
    bankDetails:
      invite.documentStatuses.bank === "uploaded" ? invite.bankDetails : undefined,
    tenantDocumentStatus: invite.tenantDocumentStatus,
    submitted: invite.status === "submitted",
  });
}

export function tenantProfileCompletionPercent(profile: TenantAccountProfile): number {
  let complete = 0;
  const total = 5;
  if (profile.name.trim()) complete += 1;
  if (profile.phone.length === 10) complete += 1;
  if (profile.aadhaar?.fileName) complete += 1;
  if (profile.pan?.fileName) complete += 1;
  if (profile.bankDetails?.holderName || profile.bankDetails?.upiId) complete += 1;
  return Math.round((complete / total) * 100);
}
