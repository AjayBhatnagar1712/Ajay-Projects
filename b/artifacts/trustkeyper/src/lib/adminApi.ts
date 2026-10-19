/**
 * Admin API client — typed fetch wrappers for /api/admin/* routes
 */
import { API_BASE } from "@/lib/apiBase";
import { getSupabaseAccessToken } from "./syncSession";

/** Platform-wide statistics returned by GET /api/admin/stats. */
export interface AdminStats {
  totalUsers: number;
  totalOwners: number;
  totalBrokers: number;
  totalProperties: number;
  newUsersThisWeek: number;
}

/** A user profile returned by GET /api/admin/users. */
export interface AdminUser {
  phone: string;
  role: string;
  name: string;
  updatedAt: string;
}

/** A property record returned by GET /api/admin/properties. */
export interface AdminProperty {
  ownerPhone: string;
  address: string;
  type: string;
  status: string;
  updatedAt: string;
}

/** A feedback submission returned by GET /api/admin/feedback. */
export interface AdminFeedback {
  id: string;
  message: string;
  rating: number;
  category: string;
  userPhone: string | null;
  userRole: string | null;
  pageUrl: string | null;
  createdAt: string;
}

interface AdminUsersResponse {
  users: AdminUser[];
}

interface AdminPropertiesResponse {
  properties: AdminProperty[];
}

interface AdminFeedbackResponse {
  feedback: AdminFeedback[];
}

interface ApiErrorBody {
  error?: string;
  detail?: string;
}

/**
 * Builds authorized headers for admin API requests.
 * @throws When no Supabase session token is available.
 */
async function adminAuthHeaders(): Promise<Record<string, string>> {
  const token = await getSupabaseAccessToken();
  if (!token) {
    throw new Error("Not authenticated. Please sign in to the admin portal again.");
  }
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Parses a failed admin API response into a descriptive Error.
 * @param res - Non-OK fetch response.
 */
async function throwAdminApiError(res: Response): Promise<never> {
  let message = `Admin API request failed (${res.status})`;
  try {
    const body = (await res.json()) as ApiErrorBody;
    if (body.error) {
      message = body.detail ? `${body.error}: ${body.detail}` : body.error;
    }
  } catch {
    /* ignore JSON parse errors */
  }
  throw new Error(message);
}

/**
 * Performs an authenticated GET to an admin API route.
 * @param path - Path segment after `/api/admin/` (e.g. `stats`).
 */
async function adminGet<T>(path: string): Promise<T> {
  const headers = await adminAuthHeaders();
  const res = await fetch(`${API_BASE}/admin/${path}`, { headers });
  if (!res.ok) await throwAdminApiError(res);
  return (await res.json()) as T;
}

/**
 * Fetches aggregate platform statistics for the admin dashboard.
 * @returns Stats including user counts and new signups this week.
 */
export async function fetchAdminStats(): Promise<AdminStats> {
  return adminGet<AdminStats>("stats");
}

/**
 * Fetches all registered user profiles across the platform.
 * @returns Array of user records with phone, role, name, and updatedAt.
 */
export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const json = await adminGet<AdminUsersResponse>("users");
  return json.users;
}

/**
 * Fetches all properties stored across owner and broker accounts.
 * @returns Flattened property records with owner phone and metadata.
 */
export async function fetchAdminProperties(): Promise<AdminProperty[]> {
  const json = await adminGet<AdminPropertiesResponse>("properties");
  return json.properties;
}

/**
 * Fetches all user feedback submissions for the admin feedback view.
 * @returns Array of feedback records ordered by newest first.
 */
export async function fetchAdminFeedback(): Promise<AdminFeedback[]> {
  const json = await adminGet<AdminFeedbackResponse>("feedback");
  return json.feedback;
}

/** Lease agreement row returned by GET /api/admin/lease-agreements. */
export interface AdminLeaseAgreement {
  id: string;
  createdByUserId: string;
  status: string;
  propertyAddress: string | null;
  createdAt: string;
  updatedAt: string;
  signedAt: string | null;
  signingNotifiedAt: string | null;
  signedUploadedByPhone: string | null;
  hasSignedPdf: boolean;
  partyCount: number;
  approvedCount: number;
  changesRequestedCount: number;
  withdrawnCount: number;
}

/** Full party record on admin agreement detail (KYC for Leegality verification). */
export interface AdminLeaseAgreementParty {
  id: string;
  role: string;
  name: string;
  phone: string;
  title: string | null;
  age: number | null;
  address: string | null;
  aadhaar: string | null;
  pan: string | null;
  email: string | null;
  isPrimary: boolean;
  sortOrder: number;
  approvalStatus: string;
  reviewComment: string | null;
  reviewedAt: string | null;
}

export interface AdminLeaseAgreementInventoryItem {
  id: string;
  description: string;
  quantity: number;
  sortOrder: number;
}

export interface AdminLeaseAgreementDetail extends Omit<
  AdminLeaseAgreement,
  "partyCount" | "approvedCount" | "changesRequestedCount" | "withdrawnCount"
> {
  executionDate: string | null;
  effectiveDate: string | null;
  endDate: string | null;
  executionCity: string | null;
  durationMonths: number | null;
  minStayMonths: number | null;
  noticePeriodLicenseeMonths: number | null;
  noticePeriodLicensorMonths: number | null;
  monthlyRentPaise: number | null;
  securityDepositPaise: number | null;
  rentDueDay: number | null;
  maintenanceIncluded: boolean;
  monthlyMaintenancePaise: number | null;
  areaSqft: number | null;
  facing: string | null;
  carParkingCount: number | null;
  parties: AdminLeaseAgreementParty[];
  inventory: AdminLeaseAgreementInventoryItem[];
}

interface AdminLeaseAgreementsResponse {
  leaseAgreements: AdminLeaseAgreement[];
}

/**
 * Fetches every lease agreement for the admin signing queue.
 */
export async function fetchAdminLeaseAgreements(): Promise<AdminLeaseAgreement[]> {
  const json = await adminGet<AdminLeaseAgreementsResponse>("lease-agreements");
  return json.leaseAgreements;
}

/**
 * Fetches one lease agreement for the admin signing detail view.
 */
export async function fetchAdminLeaseAgreement(id: string): Promise<AdminLeaseAgreementDetail> {
  return adminGet<AdminLeaseAgreementDetail>(`lease-agreements/${id}`);
}

async function triggerBrowserDownload(blob: Blob, filename: string): Promise<void> {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

async function adminDownloadPdf(path: string, filename: string): Promise<void> {
  const headers = await adminAuthHeaders();
  const res = await fetch(`${API_BASE}/admin/${path}`, { headers });
  if (!res.ok) await throwAdminApiError(res);
  const blob = await res.blob();
  await triggerBrowserDownload(blob, filename);
}

/**
 * Downloads the unsigned agreement PDF through the authenticated admin route.
 */
export async function downloadAdminUnsignedPdf(id: string): Promise<void> {
  await adminDownloadPdf(`lease-agreements/${id}/pdf`, `lease-agreement-${id}.pdf`);
}

/**
 * Downloads the stored signed PDF through the authenticated admin route.
 */
export async function downloadAdminSignedPdf(id: string): Promise<void> {
  await adminDownloadPdf(`lease-agreements/${id}/signed-pdf`, `lease-agreement-${id}-signed.pdf`);
}

/**
 * Uploads a signed PDF. Never receives or stores a public Blob URL.
 */
export async function uploadAdminSignedPdf(
  id: string,
  file: File,
): Promise<AdminLeaseAgreementDetail> {
  const headers = await adminAuthHeaders();
  const body = new FormData();
  body.append("pdf", file);
  const res = await fetch(`${API_BASE}/admin/lease-agreements/${id}/signed-pdf`, {
    method: "POST",
    headers: {
      Authorization: headers.Authorization,
      Accept: "application/json",
    },
    body,
  });
  if (!res.ok) await throwAdminApiError(res);
  return (await res.json()) as AdminLeaseAgreementDetail;
}

/**
 * Resends the signing-ready email to SIGNING_NOTIFY_EMAIL.
 */
export async function resendAdminSigningNotification(
  id: string,
): Promise<AdminLeaseAgreementDetail> {
  const headers = await adminAuthHeaders();
  const res = await fetch(`${API_BASE}/admin/lease-agreements/${id}/notify-signing`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!res.ok) await throwAdminApiError(res);
  return (await res.json()) as AdminLeaseAgreementDetail;
}
