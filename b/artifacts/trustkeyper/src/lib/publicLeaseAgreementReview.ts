import { API_BASE } from "@/lib/apiBase";
import type { LeaseAgreementPdfInput } from "@workspace/lease-agreement/text";

export type LeaseReviewPartyRole = "owner" | "tenant";

export type LeaseReviewApprovalStatus =
  | "pending"
  | "approved"
  | "changes_requested"
  | "withdrawn";

/** Public party shape for review UI — never includes Aadhaar/PAN. */
export type LeaseReviewParty = {
  role: LeaseReviewPartyRole;
  title: string | null;
  name: string;
  age: number | null;
  address: string | null;
  email: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

export type LeaseReviewInventoryItem = {
  description: string;
  quantity: number;
  sortOrder: number;
};

export type LeaseReviewViewer = {
  role: LeaseReviewPartyRole;
  name: string;
  approvalStatus: LeaseReviewApprovalStatus;
  reviewComment: string | null;
  reviewedAt: string | null;
};

export type LeaseReviewBroker = {
  name: string;
  /** Digits only as returned by the API (e.g. 918860826738). */
  phone: string;
};

export type LeaseReviewPayload = {
  agreementId: string;
  status: string;
  executionDate: string;
  effectiveDate: string;
  endDate: string;
  executionCity: string;
  durationMonths: number;
  minStayMonths: number;
  noticePeriodLicenseeMonths: number;
  noticePeriodLicensorMonths: number;
  monthlyRentPaise: number;
  securityDepositPaise: number;
  rentDueDay: number;
  propertyAddress: string;
  areaSqft: number | null;
  facing: string | null;
  carParkingCount: number | null;
  parties: LeaseReviewParty[];
  inventoryItems: LeaseReviewInventoryItem[];
  viewer: LeaseReviewViewer;
  broker: LeaseReviewBroker | null;
};

export type LeaseReviewDecision = "approved" | "changes_requested" | "withdrawn";

export type LeaseReviewSubmitResult = {
  decision: LeaseReviewDecision;
  comment: string | null;
  reviewedAt: string | null;
  party: {
    name: string;
    role: LeaseReviewPartyRole;
    approvalStatus: LeaseReviewApprovalStatus;
  };
};

export type LeaseReviewFetchErrorKind = "not_found" | "expired" | "network" | "server" | "invalid";

export type LeaseReviewFetchResult =
  | { ok: true; payload: LeaseReviewPayload }
  | { ok: false; kind: LeaseReviewFetchErrorKind; message: string; status?: number };

export type LeaseReviewSubmitResponse =
  | { ok: true; result: LeaseReviewSubmitResult }
  | { ok: false; kind: LeaseReviewFetchErrorKind; message: string; status?: number };

/** Matches the public review API 400 when the agreement is no longer in_review. */
export const AGREEMENT_MOVED_FORWARD_MESSAGE =
  "This agreement has moved forward — contact your broker";

/** Human copy for token failures — parties should never see raw HTTP codes. */
export function reviewLinkErrorMessage(kind: LeaseReviewFetchErrorKind): string {
  switch (kind) {
    case "not_found":
      return "Please ask your broker to send you a new one.";
    case "expired":
      return "Please ask your broker to send you a new one.";
    case "network":
      return "We could not reach TrustKeyper. Check your connection and try again.";
    case "invalid":
      return "Please open the full link your broker sent.";
    case "server":
    default:
      return "Please try again in a moment.";
  }
}

/** Title + supporting text for the centered unavailable state (matches mobile StateScreen language). */
export function reviewUnavailableCopy(kind: LeaseReviewFetchErrorKind): {
  title: string;
  description: string;
} {
  switch (kind) {
    case "expired":
      return {
        title: "This review link has expired",
        description: reviewLinkErrorMessage("expired"),
      };
    case "not_found":
      return {
        title: "This review link is no longer valid",
        description: reviewLinkErrorMessage("not_found"),
      };
    case "invalid":
      return {
        title: "This review link looks incomplete",
        description: reviewLinkErrorMessage("invalid"),
      };
    case "network":
      return {
        title: "Couldn't connect",
        description: reviewLinkErrorMessage("network"),
      };
    case "server":
    default:
      return {
        title: "Something went wrong",
        description: reviewLinkErrorMessage("server"),
      };
  }
}

export function classifyReviewHttpStatus(status: number): LeaseReviewFetchErrorKind {
  if (status === 404) return "not_found";
  if (status === 410) return "expired";
  return "server";
}

async function readReviewErrorMessage(res: Response): Promise<string | null> {
  try {
    const body: unknown = await res.json();
    if (!body || typeof body !== "object") return null;
    const error = (body as Record<string, unknown>).error;
    if (typeof error === "string" && error.trim().length > 0) return error.trim();
    return null;
  } catch {
    return null;
  }
}

export function formatPartyRoleLabel(role: LeaseReviewPartyRole): string {
  return role === "owner" ? "Owner (Licensor)" : "Tenant (Licensee)";
}

export function formatApprovalStatusLabel(status: LeaseReviewApprovalStatus): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "changes_requested":
      return "Changes requested";
    case "withdrawn":
      return "Withdrawn";
    case "pending":
    default:
      return "Awaiting your response";
  }
}

/**
 * Build a dialable `tel:` href from Supabase auth.users phone storage.
 * Typical staging/prod values are digits only, e.g. `918860826738` (no `+`).
 */
export function normalizeBrokerTelHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `tel:+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `tel:+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `tel:+${digits}`;
  return null;
}

/** Human-readable Indian mobile display for the call CTA. */
export function formatBrokerPhoneDisplay(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length >= 8) return `+${digits}`;
  return null;
}

function partyWithoutKyc(raw: Record<string, unknown>): LeaseReviewParty {
  return {
    role: raw.role === "tenant" ? "tenant" : "owner",
    title: typeof raw.title === "string" ? raw.title : null,
    name: typeof raw.name === "string" ? raw.name : "",
    age: typeof raw.age === "number" ? raw.age : null,
    address: typeof raw.address === "string" ? raw.address : null,
    email: typeof raw.email === "string" ? raw.email : null,
    isPrimary: Boolean(raw.isPrimary),
    sortOrder: typeof raw.sortOrder === "number" ? raw.sortOrder : 0,
  };
}

function normalizeBroker(raw: unknown): LeaseReviewBroker | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  if (typeof body.phone !== "string") return null;
  const phone = body.phone.replace(/\D/g, "");
  if (phone.length < 10) return null;
  const name =
    typeof body.name === "string" && body.name.trim().length > 0
      ? body.name.trim()
      : "Your broker";
  return { name, phone };
}

/**
 * Maps API JSON into the UI payload and strips any accidental Aadhaar/PAN fields.
 */
export function normalizeLeaseReviewPayload(raw: unknown): LeaseReviewPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  if (typeof body.agreementId !== "string" || typeof body.propertyAddress !== "string") {
    return null;
  }
  if (!body.viewer || typeof body.viewer !== "object") return null;
  if (!Array.isArray(body.parties) || !Array.isArray(body.inventoryItems)) return null;

  const viewerRaw = body.viewer as Record<string, unknown>;
  const approvalStatus = viewerRaw.approvalStatus;
  if (
    approvalStatus !== "pending" &&
    approvalStatus !== "approved" &&
    approvalStatus !== "changes_requested" &&
    approvalStatus !== "withdrawn"
  ) {
    return null;
  }

  return {
    agreementId: body.agreementId,
    status: typeof body.status === "string" ? body.status : "in_review",
    executionDate: String(body.executionDate ?? ""),
    effectiveDate: String(body.effectiveDate ?? ""),
    endDate: String(body.endDate ?? ""),
    executionCity: String(body.executionCity ?? ""),
    durationMonths: Number(body.durationMonths) || 0,
    minStayMonths: Number(body.minStayMonths) || 0,
    noticePeriodLicenseeMonths: Number(body.noticePeriodLicenseeMonths) || 0,
    noticePeriodLicensorMonths: Number(body.noticePeriodLicensorMonths) || 0,
    monthlyRentPaise: Number(body.monthlyRentPaise) || 0,
    securityDepositPaise: Number(body.securityDepositPaise) || 0,
    rentDueDay: Number(body.rentDueDay) || 0,
    propertyAddress: body.propertyAddress,
    areaSqft: typeof body.areaSqft === "number" ? body.areaSqft : null,
    facing: typeof body.facing === "string" ? body.facing : null,
    carParkingCount: typeof body.carParkingCount === "number" ? body.carParkingCount : null,
    parties: body.parties.map((party) =>
      partyWithoutKyc(party && typeof party === "object" ? (party as Record<string, unknown>) : {}),
    ),
    inventoryItems: body.inventoryItems.map((item, index) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const quantity =
        typeof row.quantity === "number" &&
        Number.isInteger(row.quantity) &&
        row.quantity >= 1
          ? row.quantity
          : 1;
      return {
        description: typeof row.description === "string" ? row.description : "",
        quantity,
        sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : index,
      };
    }),
    viewer: {
      role: viewerRaw.role === "tenant" ? "tenant" : "owner",
      name: typeof viewerRaw.name === "string" ? viewerRaw.name : "",
      approvalStatus,
      reviewComment: typeof viewerRaw.reviewComment === "string" ? viewerRaw.reviewComment : null,
      reviewedAt: typeof viewerRaw.reviewedAt === "string" ? viewerRaw.reviewedAt : null,
    },
    broker: normalizeBroker(body.broker),
  };
}

/** Shape accepted by `@workspace/lease-agreement/text` — KYC already stripped. */
export function toLeaseAgreementPdfInput(payload: LeaseReviewPayload): LeaseAgreementPdfInput {
  return {
    executionDate: payload.executionDate,
    effectiveDate: payload.effectiveDate,
    endDate: payload.endDate,
    executionCity: payload.executionCity,
    durationMonths: payload.durationMonths,
    minStayMonths: payload.minStayMonths,
    noticePeriodLicenseeMonths: payload.noticePeriodLicenseeMonths,
    noticePeriodLicensorMonths: payload.noticePeriodLicensorMonths,
    monthlyRentPaise: payload.monthlyRentPaise,
    securityDepositPaise: payload.securityDepositPaise,
    rentDueDay: payload.rentDueDay,
    propertyAddress: payload.propertyAddress,
    areaSqft: payload.areaSqft,
    facing: payload.facing,
    carParkingCount: payload.carParkingCount,
    parties: payload.parties.map((party) => ({
      role: party.role,
      title: party.title,
      name: party.name,
      age: party.age,
      address: party.address,
      aadhaar: null,
      pan: null,
      email: party.email,
      isPrimary: party.isPrimary,
      sortOrder: party.sortOrder,
    })),
    inventoryItems: payload.inventoryItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      sortOrder: item.sortOrder,
    })),
  };
}

export async function fetchLeaseAgreementReview(token: string): Promise<LeaseReviewFetchResult> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { ok: false, kind: "invalid", message: reviewLinkErrorMessage("invalid") };
  }

  try {
    const res = await fetch(`${API_BASE}/v1/review/${encodeURIComponent(trimmed)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      const kind = classifyReviewHttpStatus(res.status);
      return { ok: false, kind, message: reviewLinkErrorMessage(kind), status: res.status };
    }
    const json: unknown = await res.json();
    const payload = normalizeLeaseReviewPayload(json);
    if (!payload) {
      return {
        ok: false,
        kind: "server",
        message: reviewLinkErrorMessage("server"),
        status: res.status,
      };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, kind: "network", message: reviewLinkErrorMessage("network") };
  }
}

export async function submitLeaseAgreementReview(
  token: string,
  decision: LeaseReviewDecision,
  comment?: string,
): Promise<LeaseReviewSubmitResponse> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { ok: false, kind: "invalid", message: reviewLinkErrorMessage("invalid") };
  }

  try {
    const body: { decision: LeaseReviewDecision; comment?: string } = { decision };
    if (comment?.trim()) {
      body.comment = comment.trim();
    }

    const res = await fetch(`${API_BASE}/v1/review/${encodeURIComponent(trimmed)}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const kind = classifyReviewHttpStatus(res.status);
      const apiMessage = await readReviewErrorMessage(res);
      return {
        ok: false,
        kind,
        message: apiMessage ?? reviewLinkErrorMessage(kind),
        status: res.status,
      };
    }

    const json = (await res.json()) as LeaseReviewSubmitResult;
    return { ok: true, result: json };
  } catch {
    return { ok: false, kind: "network", message: reviewLinkErrorMessage("network") };
  }
}
