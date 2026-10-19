import type {
  BrokerProfile,
  BrokerProfilePatch,
  LeaseAgreementPatch,
  LeaseInventoryReplace,
  LeasePartiesReplace,
  LeasePartyRole,
} from "@workspace/api-schemas";
import { getAccessToken } from "../auth/secureSession";
import { ApiError } from "./errors";
import { formatApiErrorMessage } from "./formatApiErrorMessage";
import {
  NETWORK_TIMEOUT_MESSAGE,
  NETWORK_TIMEOUT_MS,
  withTimeout,
} from "../network/withTimeout";

export { ApiError } from "./errors";

function apiBaseUrl(): string {
  const base = process.env.EXPO_PUBLIC_API_URL;
  if (!base) {
    throw new Error("Missing EXPO_PUBLIC_API_URL. Copy apps/mobile/.env.example to .env");
  }
  return base.replace(/\/$/, "");
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
  searchParams?: Record<string, string | undefined>;
};

/**
 * Typed fetch client for existing Vercel `/api/*` routes.
 * Auth uses Bearer access token from SecureStore (same JWT as web after Supabase OTP).
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${apiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`);
  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (options.auth !== false) {
    const token = await getAccessToken();
    if (!token) {
      throw new ApiError(401, "Not authenticated", null);
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await withTimeout(
    fetch(url.toString(), {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
    NETWORK_TIMEOUT_MS,
    NETWORK_TIMEOUT_MESSAGE,
  );

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      formatApiErrorMessage(response.status, parsed),
      parsed,
    );
  }

  return parsed as T;
}

/** Public discovery — no JWT (same as web). */
export function getAccountRoles(phone: string) {
  return apiRequest<{ phone: string; roles: string[] }>(`/sync/accounts/${phone}/roles`, {
    auth: false,
  });
}

export function getAccountSummaries(phone: string) {
  return apiRequest<{
    phone: string;
    accounts: Array<{ role: string; displayName: string }>;
  }>(`/sync/accounts/${phone}/summaries`, { auth: false });
}

export function getAccountExists(phone: string, role: string) {
  return apiRequest<{ phone: string; role: string; exists: boolean }>(
    `/sync/accounts/${phone}/${role}/exists`,
    { auth: false },
  );
}

/** Protected sync — Bearer JWT required. */
export function getAccountData(phone: string, role: string) {
  return apiRequest<{ phone: string; role: string; data: Record<string, string> }>(
    `/sync/accounts/${phone}/${role}`,
  );
}

export function putAccountData(phone: string, role: string, entries: Record<string, string>) {
  return apiRequest<{ ok: true }>(`/sync/accounts/${phone}/${role}`, {
    method: "PUT",
    body: { entries },
  });
}

export function putAccountKey(phone: string, role: string, dataKey: string, value: string) {
  return apiRequest<{ ok: true }>(`/sync/accounts/${phone}/${role}/${dataKey}`, {
    method: "PUT",
    body: { value },
  });
}

/** Broker profile — JWT scoped to auth user. 404 → null (no row yet). */
export async function getBrokerProfile(): Promise<BrokerProfile | null> {
  try {
    return await apiRequest<BrokerProfile>("/v1/broker/profile");
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export function patchBrokerProfile(body: BrokerProfilePatch) {
  return apiRequest<BrokerProfile>("/v1/broker/profile", {
    method: "PATCH",
    body,
  });
}

export type LocationSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
};

export type LocationAutocompleteResponse = {
  suggestions: LocationSuggestion[];
};

export type LocationDetailsResponse = {
  placeId: string;
  formattedAddress: string;
  region: string;
  pincode: string | null;
  missingPincode: boolean;
};

/** Places Autocomplete (New) via server proxy — never call Google from the app. */
export function postLocationAutocomplete(body: {
  input: string;
  sessionToken: string;
}) {
  return apiRequest<LocationAutocompleteResponse>("/v1/location-autocomplete", {
    method: "POST",
    body,
  });
}

/** Place Details (New) via server proxy — terminates the Autocomplete session. */
export function postLocationDetails(body: {
  placeId: string;
  sessionToken: string;
}) {
  return apiRequest<LocationDetailsResponse>("/v1/location-details", {
    method: "POST",
    body,
  });
}

export type LeaseAgreement = {
  id: string;
  createdByUserId: string;
  renewedFromAgreementId?: string | null;
  status: string;
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
  /** Tenant brokerage fee in paise; null when unset. */
  brokerageFeePaise?: number | null;
  maintenanceIncluded: boolean;
  monthlyMaintenancePaise: number | null;
  propertyAddress: string | null;
  areaSqft: number | null;
  facing: string | null;
  carParkingCount: number | null;
  createdAt: string;
  updatedAt: string;
  /** ISO timestamp when the signed PDF was stored; null until admin upload. */
  signedAt?: string | null;
  /** True when a signed PDF is stored. Pathname is never returned. */
  hasSignedPdf?: boolean;
  /** Present on list responses; omitted/0 on create/patch/status. */
  partyCount?: number;
  approvedCount?: number;
  changesRequestedCount?: number;
  withdrawnCount?: number;
};

export type LeasePartyApprovalStatus =
  | "pending"
  | "approved"
  | "changes_requested"
  | "withdrawn";

export type LeaseAgreementParty = {
  id: string;
  role: LeasePartyRole;
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
  approvalStatus: LeasePartyApprovalStatus;
  reviewComment: string | null;
  reviewedAt: string | null;
  /** True when a live review token exists (token value is never returned). */
  hasReviewToken: boolean;
  /**
   * `none` — never minted or cleared (e.g. after edit).
   * `active` — live unexpired token.
   * `expired` — token still stored but past expiry.
   * Omitted on older API deploys — infer via `resolveReviewLinkStatus`.
   */
  reviewLinkStatus?: "none" | "active" | "expired";
  /** ISO timestamp when the broker confirmed the link was shared; null until then. */
  reviewSharedAt?: string | null;
  /** Derived from reviewSharedAt — omitted on older API deploys. */
  hasBeenShared?: boolean;
};

export type LeaseAgreementStatusUpdate = "in_review" | "esign_sent";

export type LeaseAgreementReviewSendResult = {
  parties: Array<{
    id: string;
    name: string;
    role: string;
    reviewLink: string;
  }>;
};

export type LeaseAgreementPartyReviewResendResult = {
  id: string;
  name: string;
  role: string;
  reviewLink: string;
};

export type LeaseAgreementInventoryItem = {
  id: string;
  description: string;
  quantity: number;
  sortOrder: number;
};

export type LeaseAgreementDetail = LeaseAgreement & {
  parties: LeaseAgreementParty[];
  inventory: LeaseAgreementInventoryItem[];
};

export function createLeaseAgreement() {
  return apiRequest<LeaseAgreement>("/v1/lease-agreements", { method: "POST" });
}

export function renewLeaseAgreement(id: string) {
  return apiRequest<LeaseAgreementDetail>(`/v1/lease-agreements/${id}/renew`, {
    method: "POST",
    body: {},
  });
}

export function listLeaseAgreements() {
  return apiRequest<{ leaseAgreements: LeaseAgreement[] }>("/v1/lease-agreements");
}

export type PartyContactAgreement = {
  agreementId: string;
  propertyAddress: string | null;
  /** lease_agreements.status — e.g. draft, in_review, esign_sent, signed */
  status: string;
};

export type PartyContactSummary = {
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  role: LeasePartyRole;
  alternateNames: string[];
  agreementCount: number;
  agreements: PartyContactAgreement[];
};

/** Records tab Owners/Tenants — phone-deduped contact summaries for the caller's agreements. */
export function listPartyContacts(role: "owner" | "tenant") {
  return apiRequest<{ parties: PartyContactSummary[] }>("/v1/parties", {
    searchParams: { role },
  });
}

export function getLeaseAgreement(id: string) {
  return apiRequest<LeaseAgreementDetail>(`/v1/lease-agreements/${id}`);
}

export function patchLeaseAgreement(id: string, body: LeaseAgreementPatch) {
  return apiRequest<LeaseAgreement>(`/v1/lease-agreements/${id}`, {
    method: "PATCH",
    body,
  });
}

/** Cancel a draft agreement (CASCADE parties + inventory). Non-draft → 400. */
export function deleteLeaseAgreement(id: string) {
  return apiRequest<{ ok: true }>(`/v1/lease-agreements/${id}`, {
    method: "DELETE",
  });
}

export function replaceLeaseAgreementParties(id: string, body: LeasePartiesReplace) {
  return apiRequest<{ parties: LeaseAgreementParty[] }>(
    `/v1/lease-agreements/${id}/parties`,
    {
      method: "PUT",
      body,
    },
  );
}

export function replaceLeaseAgreementInventory(id: string, body: LeaseInventoryReplace) {
  return apiRequest<{ inventory: LeaseAgreementInventoryItem[] }>(
    `/v1/lease-agreements/${id}/inventory`,
    {
      method: "PUT",
      body,
    },
  );
}

export function updateLeaseAgreementStatus(id: string, status: LeaseAgreementStatusUpdate) {
  return apiRequest<LeaseAgreement>(`/v1/lease-agreements/${id}/status`, {
    method: "POST",
    body: { status },
  });
}

export function sendLeaseAgreementReview(id: string) {
  return apiRequest<LeaseAgreementReviewSendResult>(`/v1/lease-agreements/${id}/review/send`, {
    method: "POST",
    body: {},
  });
}

export function resendLeaseAgreementPartyReview(agreementId: string, partyId: string) {
  return apiRequest<LeaseAgreementPartyReviewResendResult>(
    `/v1/lease-agreements/${agreementId}/parties/${partyId}/review/resend`,
    {
      method: "POST",
      body: {},
    },
  );
}

export function confirmLeaseAgreementPartyReviewShared(agreementId: string, partyId: string) {
  return apiRequest<LeaseAgreementParty>(
    `/v1/lease-agreements/${agreementId}/parties/${partyId}/review/shared`,
    {
      method: "POST",
      body: {},
    },
  );
}

/** Portal — agreements where JWT phone is an owner or tenant party. */
export type PortalRentPaymentState =
  | "none"
  | "needs_review"
  | "upcoming"
  | "due_soon"
  | "late"
  | "paid"
  | "settled";

export type PortalOwnerPayout = {
  validationStatus: string | null;
  activated: boolean;
};

export type PortalRentInvoice = {
  rentPeriod: string;
  coverageStart: string;
  coverageEnd: string;
  billedDays: number;
  daysInMonth: number;
  amountPaise: number;
  dueDate: string;
  state: PortalRentPaymentState;
};

export type PortalAgreementListItem = {
  id: string;
  status: string;
  propertyAddress: string | null;
  partyRole: string;
  partyName: string;
  partyApprovalStatus: string;
  monthlyRentPaise: number | null;
  securityDepositPaise: number | null;
  rentDueDay: number | null;
  brokerageFeePaise: number | null;
  brokeragePaid: boolean;
  effectiveDate: string | null;
  endDate: string | null;
  signedAt: string | null;
  rentPeriod: string;
  rentPaymentState: PortalRentPaymentState;
  rentDueDate: string | null;
  rentAmountPaise?: number | null;
  rentCoverageStart?: string | null;
  rentCoverageEnd?: string | null;
  rentInvoices?: PortalRentInvoice[];
  ownerPayout: PortalOwnerPayout | null;
};

export type PortalAgreementParty = {
  id: string;
  role: string;
  name: string;
  phone: string;
  isPrimary: boolean;
  approvalStatus: string;
};

export type PortalPaymentSummary = {
  id: string;
  paymentType: string;
  rentPeriod: string | null;
  status: string;
  amountPaise: number;
  paidAt: string | null;
};

export type PortalAgreementDetail = PortalAgreementListItem & {
  createdByUserId: string;
  brokerPhone: string | null;
  executionDate: string | null;
  executionCity: string | null;
  durationMonths: number | null;
  minStayMonths: number | null;
  noticePeriodLicenseeMonths: number | null;
  noticePeriodLicensorMonths: number | null;
  maintenanceIncluded: boolean;
  monthlyMaintenancePaise: number | null;
  areaSqft: number | null;
  facing: string | null;
  carParkingCount: number | null;
  hasSignedPdf: boolean;
  parties: PortalAgreementParty[];
  brokeragePaymentStatus: string | null;
  payments: PortalPaymentSummary[];
};

export function listPortalAgreements() {
  return apiRequest<{ agreements: PortalAgreementListItem[] }>("/v1/portal");
}

export function getPortalAgreement(id: string) {
  return apiRequest<PortalAgreementDetail>(`/v1/portal/${id}`);
}

export type LeasePaymentOrderResult = {
  orderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
  description?: string;
  rentPaymentId?: string;
  commissionPaise?: number;
  ownerSettlementPaise?: number;
};

export function createLeaseRentOrder(body: {
  phone: string;
  agreementId: string;
  rentPeriod: string;
}) {
  return apiRequest<LeasePaymentOrderResult>("/payments-create-lease-rent-order", {
    method: "POST",
    body,
  });
}

export function createLeaseBrokerageOrder(body: {
  phone: string;
  agreementId: string;
}) {
  return apiRequest<LeasePaymentOrderResult>("/payments-create-lease-brokerage-order", {
    method: "POST",
    body,
  });
}

export type PaymentOnboardRole = "owner" | "broker";

export type PaymentRecipientValidationStatus =
  | "pending"
  | "submitted"
  | "needs_clarification"
  | "cooling"
  | "activated"
  | "failed"
  | string;

export type PaymentOnboardStatus = {
  validationStatus: PaymentRecipientValidationStatus;
  hasLinkedAccount: boolean;
  accountId: string | null;
  /** Last 4 digits of the linked bank account; null when unknown. */
  bankAccountLast4?: string | null;
};

export type BrokerPaymentHistoryItem = {
  id: string;
  agreementId: string | null;
  amountPaise: number | string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  propertyAddress: string | null;
};

export type PaymentOnboardBody = {
  phone: string;
  role: PaymentOnboardRole;
  legalName: string;
  email: string;
  registeredAddress: {
    street1: string;
    street2: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  };
};

export type PaymentOnboardCompleteBody = {
  phone: string;
  role: PaymentOnboardRole;
  stakeholderName: string;
  stakeholderEmail: string;
  pan: string;
  residentialAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  };
  bankAccountNumber: string;
  bankIfsc: string;
  bankBeneficiaryName: string;
  tncAccepted: true;
};

export function getPaymentOnboardStatus(phone: string, role: PaymentOnboardRole) {
  return apiRequest<PaymentOnboardStatus>("/payments-onboard-status", {
    searchParams: { phone, role },
  });
}

export function createPaymentOnboard(body: PaymentOnboardBody) {
  return apiRequest<{
    accountId: string;
    validationStatus: PaymentRecipientValidationStatus;
  }>("/payments-onboard", {
    method: "POST",
    body,
  });
}

export function completePaymentOnboard(body: PaymentOnboardCompleteBody) {
  return apiRequest<{
    accountId: string;
    productId: string | null;
    validationStatus: PaymentRecipientValidationStatus;
  }>("/payments-onboard-complete", {
    method: "POST",
    body,
  });
}

export function listBrokerPayments(phone: string) {
  return apiRequest<{ payments: BrokerPaymentHistoryItem[] }>(
    "/payments-broker-history",
    { searchParams: { phone } },
  );
}
