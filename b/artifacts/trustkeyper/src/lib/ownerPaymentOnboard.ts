import { getActiveSession, normalizePhoneDigits } from "./storageKeys";
import { syncAuthHeaders } from "./syncSession";
import {
  buildOnboardCompleteRequestBody,
  buildOnboardRequestBody,
  type OwnerPaymentSetupFormValues,
  type PaymentRecipientValidationStatus,
} from "./ownerPaymentOnboardSchemas";

import { getApiBase } from "@/lib/apiBase";

export type PaymentRecipientStatus = {
  validationStatus: PaymentRecipientValidationStatus;
  hasLinkedAccount: boolean;
  accountId: string | null;
};

type OwnerPaymentRole = "owner" | "broker";

function resolveOwnerSession(): { phone: string; role: OwnerPaymentRole } | null {
  const session = getActiveSession();
  if (!session || session.role !== "owner") return null;
  const phone = normalizePhoneDigits(session.phone);
  if (phone.length !== 10) return null;
  return { phone, role: "owner" };
}

function formatApiError(json: {
  error?: string;
  detail?: string;
  step?: string;
}): string {
  if (json.detail && json.step) {
    return `${json.error ?? "Request failed"} (${json.step}): ${json.detail}`;
  }
  if (json.detail) return json.detail;
  return json.error ?? "Request failed";
}

export async function fetchPaymentRecipientStatus(): Promise<
  | { ok: true; status: PaymentRecipientStatus }
  | { ok: false; error: string }
> {
  const session = resolveOwnerSession();
  if (!session) return { ok: false, error: "Owner session required" };

  try {
    const headers = await syncAuthHeaders();
    if (!headers) return { ok: false, error: "Not authenticated" };

    const params = new URLSearchParams({
      phone: session.phone,
      role: session.role,
    });
    const res = await fetch(`${getApiBase()}/payments-onboard-status?${params.toString()}`, {
      method: "GET",
      headers,
    });

    const json = (await res.json()) as {
      validationStatus?: PaymentRecipientValidationStatus;
      hasLinkedAccount?: boolean;
      accountId?: string | null;
      error?: string;
    };

    if (!res.ok) {
      return { ok: false, error: json.error ?? "Could not load payment status" };
    }

    return {
      ok: true,
      status: {
        validationStatus: json.validationStatus ?? "pending",
        hasLinkedAccount: Boolean(json.hasLinkedAccount),
        accountId: json.accountId ?? null,
      },
    };
  } catch {
    return { ok: false, error: "Network error while loading payment status" };
  }
}

export async function submitOwnerPaymentOnboarding(
  form: OwnerPaymentSetupFormValues,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = resolveOwnerSession();
  if (!session) return { ok: false, error: "Owner session required" };

  try {
    const onboardBody = buildOnboardRequestBody(session.phone, session.role, form);
    const completeBody = buildOnboardCompleteRequestBody(session.phone, session.role, form);

    const headers = await syncAuthHeaders("application/json");
    if (!headers) return { ok: false, error: "Not authenticated" };

    const onboardRes = await fetch(`${getApiBase()}/payments-onboard`, {
      method: "POST",
      headers,
      body: JSON.stringify(onboardBody),
    });
    const onboardJson = (await onboardRes.json()) as { error?: string; detail?: string };
    if (!onboardRes.ok) {
      return { ok: false, error: formatApiError(onboardJson) };
    }

    const completeRes = await fetch(`${getApiBase()}/payments-onboard-complete`, {
      method: "POST",
      headers,
      body: JSON.stringify(completeBody),
    });
    const completeJson = (await completeRes.json()) as {
      error?: string;
      detail?: string;
      step?: string;
    };
    if (!completeRes.ok) {
      return { ok: false, error: formatApiError(completeJson) };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Network error while submitting payment setup" };
  }
}
