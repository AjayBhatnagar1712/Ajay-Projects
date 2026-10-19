import { getActiveSession, normalizePhoneDigits } from "./storageKeys";
import { syncAuthHeaders } from "./syncSession";
import { openRazorpayCheckout } from "./tenantEscrowPayment";

import { getApiBase } from "@/lib/apiBase";
const RAZORPAY_KEY_ID = (import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined)?.trim() ?? "";

export interface RentCheckoutDetails {
  orderId: string;
  amount: number;
  currency: string;
  rentPaymentId: string;
  rentPeriod: string;
  keyId: string;
  description: string;
}

export type CreateRentOrderResult =
  | { ok: true; checkout: RentCheckoutDetails }
  | { ok: false; error: string; fallbackWithoutGateway?: boolean };

/** API row from GET /api/payments-tenant-history (amountPaise is a bigint string). */
export type TenantPaymentRow = {
  id: string;
  rentPeriod: string;
  amountPaise: string;
  status: string;
  paymentMethod: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type FetchTenantPaymentHistoryResult =
  | { ok: true; payments: TenantPaymentRow[] }
  | { ok: false; error: string };

function resolveTenantPhone(): string | null {
  const session = getActiveSession();
  if (!session || session.role !== "tenant") return null;
  const digits = normalizePhoneDigits(session.phone);
  return digits.length === 10 ? digits : null;
}

function coerceAmountPaise(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "0";
}

export function computeCurrentRentPeriod(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export async function fetchTenantPaymentHistory(
  phone?: string,
): Promise<FetchTenantPaymentHistoryResult> {
  const digits = normalizePhoneDigits(phone ?? resolveTenantPhone() ?? "");
  if (digits.length !== 10) return { ok: false, error: "Tenant session required" };

  try {
    const headers = await syncAuthHeaders();
    if (!headers) return { ok: false, error: "Not authenticated" };

    const res = await fetch(
      `${getApiBase()}/payments-tenant-history?phone=${encodeURIComponent(digits)}`,
      { method: "GET", headers },
    );

    const json = (await res.json()) as {
      payments?: Array<{
        id?: string;
        rentPeriod?: string | null;
        amountPaise?: string | number;
        status?: string;
        paymentMethod?: string | null;
        paidAt?: string | null;
        createdAt?: string;
      }>;
      error?: string;
    };

    if (!res.ok) {
      return { ok: false, error: json.error ?? "Could not load payment history" };
    }

    const payments: TenantPaymentRow[] = (json.payments ?? [])
      .filter(
        (row): row is {
          id: string;
          rentPeriod?: string | null;
          amountPaise?: string | number;
          status: string;
          paymentMethod?: string | null;
          paidAt?: string | null;
          createdAt: string;
        } =>
          typeof row.id === "string" &&
          typeof row.status === "string" &&
          typeof row.createdAt === "string",
      )
      .map((row) => ({
        id: row.id,
        rentPeriod: typeof row.rentPeriod === "string" ? row.rentPeriod : "",
        amountPaise: coerceAmountPaise(row.amountPaise),
        status: row.status,
        paymentMethod: row.paymentMethod ?? null,
        paidAt: row.paidAt ?? null,
        createdAt: row.createdAt,
      }));

    return { ok: true, payments };
  } catch {
    return { ok: false, error: "Network error while loading payment history" };
  }
}

export async function createTenantRentOrder(input: {
  agreementId: string;
  rentPeriod: string;
}): Promise<CreateRentOrderResult> {
  const phone = resolveTenantPhone();
  if (!phone) return { ok: false, error: "Tenant session required" };

  try {
    const headers = await syncAuthHeaders("application/json");
    if (!headers) return { ok: false, error: "Not authenticated" };

    const res = await fetch(`${getApiBase()}/payments-create-rent-order-tenant`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone,
        agreementId: input.agreementId,
        rentPeriod: input.rentPeriod,
      }),
    });

    const json = (await res.json()) as {
      orderId?: string;
      amount?: number;
      currency?: string;
      rentPaymentId?: string;
      rentPeriod?: string;
      keyId?: string;
      error?: string;
      detail?: string;
      code?: string;
    };

    if (res.status === 503 && json.code === "gateway_unavailable") {
      return { ok: false, error: json.error ?? "Gateway unavailable", fallbackWithoutGateway: true };
    }

    if (!res.ok || !json.orderId || !json.rentPaymentId) {
      const message = json.detail ? `${json.error ?? "Request failed"}: ${json.detail}` : json.error;
      return { ok: false, error: message ?? "Could not create payment order" };
    }

    return {
      ok: true,
      checkout: {
        orderId: json.orderId,
        amount: json.amount ?? 0,
        currency: json.currency ?? "INR",
        rentPaymentId: json.rentPaymentId,
        rentPeriod: json.rentPeriod ?? input.rentPeriod,
        keyId: json.keyId || RAZORPAY_KEY_ID,
        description: "Monthly rent — TrustKeyper",
      },
    };
  } catch {
    return { ok: false, error: "Network error while creating payment order" };
  }
}

export { openRazorpayCheckout };
