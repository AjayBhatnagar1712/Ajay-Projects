/** Canonical tenant KYC verification states — used across profile, dashboard, and upload flows. */

export const TENANT_KYC_STATUSES = [
  "pending_upload",
  "under_review",
  "verified",
  "rejected",
  "requires_reupload",
] as const;

export type TenantKycVerificationStatus = (typeof TENANT_KYC_STATUSES)[number];

export const TENANT_KYC_STATUS_LABELS: Record<TenantKycVerificationStatus, string> = {
  pending_upload: "Pending Upload",
  under_review: "Under Review",
  verified: "Verified",
  rejected: "Rejected",
  requires_reupload: "Requires Re-upload",
};

export const TENANT_KYC_STATUS_STYLES: Record<TenantKycVerificationStatus, string> = {
  pending_upload: "bg-amber-50 text-amber-700 border-amber-200",
  under_review: "bg-blue-50 text-blue-700 border-blue-200",
  verified: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  requires_reupload: "bg-orange-50 text-orange-700 border-orange-200",
};

export function isTenantKycVerificationStatus(value: string): value is TenantKycVerificationStatus {
  return (TENANT_KYC_STATUSES as readonly string[]).includes(value);
}

/** Normalizes legacy persisted values (e.g. `pending`) to the current model. */
export function normalizeTenantKycStatus(
  value: string | undefined,
  fallback: TenantKycVerificationStatus = "pending_upload",
): TenantKycVerificationStatus {
  if (!value) return fallback;
  if (value === "pending") return "pending_upload";
  if (isTenantKycVerificationStatus(value)) return value;
  return fallback;
}

export function formatTenantKycStatusLabel(status: TenantKycVerificationStatus): string {
  return TENANT_KYC_STATUS_LABELS[status];
}
