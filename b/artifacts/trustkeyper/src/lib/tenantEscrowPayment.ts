import { API_BASE } from "@/lib/apiBase";
import { getActiveSession, normalizePhoneDigits } from "./storageKeys";
import { syncAuthHeaders } from "./syncSession";
import type { TenantPreSigningEscrowType } from "./tenantWorkspace";

const RAZORPAY_KEY_ID = (import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined)?.trim() ?? "";

type RazorpayHandlerResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayCheckoutInstance = {
  open: () => void;
  on: (event: string, handler: (response: RazorpayHandlerResponse) => void) => void;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayCheckoutInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

export interface EscrowCheckoutDetails {
  orderId: string;
  amount: number;
  currency: string;
  rentPaymentId: string;
  paymentType: TenantPreSigningEscrowType;
  keyId: string;
}

export type RazorpayCheckoutInput = {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  description: string;
};

export type CreateEscrowOrderResult =
  | { ok: true; checkout: EscrowCheckoutDetails }
  | { ok: false; error: string; fallbackWithoutGateway?: boolean };

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.Razorpay) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.body.appendChild(script);
  });
}

function resolveTenantPhone(): string | null {
  const session = getActiveSession();
  if (!session || session.role !== "tenant") return null;
  const digits = normalizePhoneDigits(session.phone);
  return digits.length === 10 ? digits : null;
}

export async function createTenantEscrowOrder(input: {
  agreementId: string;
  paymentType: TenantPreSigningEscrowType;
}): Promise<CreateEscrowOrderResult> {
  const phone = resolveTenantPhone();
  if (!phone) return { ok: false, error: "Tenant session required" };

  try {
    const headers = await syncAuthHeaders("application/json");
    if (!headers) return { ok: false, error: "Not authenticated" };

    const res = await fetch(`${API_BASE}/payments-create-escrow-order`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone,
        agreementId: input.agreementId,
        paymentType: input.paymentType,
      }),
    });

    const json = (await res.json()) as {
      orderId?: string;
      amount?: number;
      currency?: string;
      rentPaymentId?: string;
      paymentType?: TenantPreSigningEscrowType;
      keyId?: string;
      error?: string;
      code?: string;
    };

    if (res.status === 503 && json.code === "gateway_unavailable") {
      return { ok: false, error: json.error ?? "Gateway unavailable", fallbackWithoutGateway: true };
    }

    if (!res.ok || !json.orderId || !json.rentPaymentId) {
      return { ok: false, error: json.error ?? "Could not create payment order" };
    }

    return {
      ok: true,
      checkout: {
        orderId: json.orderId,
        amount: json.amount ?? 0,
        currency: json.currency ?? "INR",
        rentPaymentId: json.rentPaymentId,
        paymentType: json.paymentType ?? input.paymentType,
        keyId: json.keyId || RAZORPAY_KEY_ID,
      },
    };
  } catch {
    return { ok: false, error: "Network error while creating payment order" };
  }
}

export async function openRazorpayCheckout(
  checkout: RazorpayCheckoutInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!checkout.keyId) {
    return { ok: false, error: "Razorpay is not configured for this environment" };
  }

  try {
    await loadRazorpayScript();
    if (!window.Razorpay) {
      return { ok: false, error: "Razorpay checkout failed to load" };
    }

    return await new Promise((resolve) => {
      const rzp = new window.Razorpay!({
        key: checkout.keyId,
        amount: checkout.amount,
        currency: checkout.currency,
        order_id: checkout.orderId,
        name: "TrustKeyper",
        description: checkout.description,
        handler: () => resolve({ ok: true }),
        modal: {
          ondismiss: () => resolve({ ok: false, error: "Payment cancelled" }),
        },
      });

      rzp.on("payment.failed", () => {
        resolve({ ok: false, error: "Payment failed" });
      });
      rzp.open();
    });
  } catch {
    return { ok: false, error: "Could not open payment checkout" };
  }
}

export async function releaseEscrowForAgreement(agreementId: string): Promise<boolean> {
  const phone = resolveTenantPhone();
  if (!phone) return false;

  try {
    const headers = await syncAuthHeaders("application/json");
    if (!headers) return false;

    const res = await fetch(`${API_BASE}/payments-release-escrow`, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone, agreementId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
