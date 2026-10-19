import { API_BASE } from "@/lib/apiBase";
import type { LeadStatus } from "./tenants";
import { syncAuthHeaders } from "./syncSession";
import { normalizePhoneDigits } from "./storageKeys";
import type { BrokerTenantOnboardingInvite } from "./brokerTenantOnboarding";

type RegisterInviteError =
  | "invalid_name"
  | "invalid_phone"
  | "duplicate_tenant"
  | "duplicate_tenant_account"
  | "duplicate_invite"
  | "unauthorized"
  | "server_error"
  | "network";

export type BrokerOnboardInviteStatus =
  | "pending"
  | "onboarding_pending"
  | "onboarding_started"
  | "submitted"
  | "requirements_submitted"
  | "converted"
  | "expired";

export type BrokerOnboardInvitePayload = {
  tenantName: string;
  tenantPhone: string;
  brokerName: string;
  status: BrokerOnboardInviteStatus;
  expiresAt: number;
};

export type TenantOnboardSubmitPayload = {
  name: string;
  phone: string;
  linkedinUrl: string;
  occupancyFrom: string;
  who: string;
  whoOther?: string;
  identify?: string[];
  food: string;
  city: string;
  localities: string[];
  propertyType: string;
  propertyTypeOther?: string;
  sharing: string;
  roommate?: string[];
  detailsComplete: boolean;
};

export type TenantOnboardSubmitResult =
  | { ok: true; brokerName: string; duplicate: boolean }
  | { ok: false; error: string; status?: number };

export async function fetchBrokerOnboardInvite(
  token: string,
): Promise<{ payload: BrokerOnboardInvitePayload | null; error: string | null; status?: number }> {
  try {
    const res = await fetch(`${API_BASE}/broker-tenant-onboard/${encodeURIComponent(token)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
      const message =
        json.error ??
        (res.status === 404
          ? "This onboarding link is not available yet. Ask your broker to resend the invite."
          : "Could not load onboarding link");
      return {
        payload: null,
        error: json.detail ? `${message} (${json.detail})` : message,
        status: res.status,
      };
    }
    const json = (await res.json()) as BrokerOnboardInvitePayload;
    return { payload: json, error: null };
  } catch {
    return { payload: null, error: "Network error. Please check your connection and try again." };
  }
}

export async function submitTenantOnboardRequirements(
  token: string,
  body: TenantOnboardSubmitPayload,
): Promise<TenantOnboardSubmitResult> {
  try {
    const res = await fetch(
      `${API_BASE}/broker-tenant-onboard/${encodeURIComponent(token)}/submit`,
      {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      brokerName?: string;
      duplicate?: boolean;
    };
    if (!res.ok) {
      return { ok: false, error: json.error ?? "Failed to submit requirements", status: res.status };
    }
    return {
      ok: true,
      brokerName: json.brokerName ?? "your broker",
      duplicate: json.duplicate === true,
    };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  "New Lead": "New Lead",
  Contacted: "Contacted",
  "Property Shared": "Property Shared",
  "Site Visit Scheduled": "Site Visit Scheduled",
  Converted: "Converted",
  Closed: "Closed",
};

const REGISTER_ERROR_CODES: Record<string, RegisterInviteError> = {
  invalid_name: "invalid_name",
  invalid_phone: "invalid_phone",
  duplicate_tenant: "duplicate_tenant",
  duplicate_tenant_account: "duplicate_tenant_account",
  duplicate_invite: "duplicate_invite",
};

export async function registerBrokerOnboardingInviteOnServer(
  brokerPhone: string,
  tenantName: string,
  tenantPhone: string,
  brokerName: string,
): Promise<
  | { ok: true; invite: BrokerTenantOnboardingInvite }
  | { ok: false; error: RegisterInviteError; detail?: string }
> {
  try {
    const headers = await syncAuthHeaders("application/json");
    if (!headers) return { ok: false, error: "network" };

    const phone = normalizePhoneDigits(brokerPhone);
    const res = await fetch(
      `${API_BASE}/broker-tenant-onboard/create/${encodeURIComponent(phone)}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ tenantName, tenantPhone, brokerName }),
      },
    );

    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      invite?: BrokerTenantOnboardingInvite;
      error?: string;
      code?: string;
      detail?: string;
    };

    if (!res.ok) {
      const code = json.code && REGISTER_ERROR_CODES[json.code] ? REGISTER_ERROR_CODES[json.code] : null;
      const detail = typeof json.detail === "string" ? json.detail : undefined;
      if (code) return { ok: false, error: code, detail };
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: "unauthorized", detail };
      }
      if (res.status >= 500) return { ok: false, error: "server_error", detail };
      return { ok: false, error: "network", detail };
    }

    if (!json.invite) return { ok: false, error: "network" };
    return { ok: true, invite: json.invite };
  } catch {
    return { ok: false, error: "network" };
  }
}
