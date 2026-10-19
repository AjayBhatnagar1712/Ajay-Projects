import { getRazorpayClient } from "./razorpayClient.js";
import { getPool } from "./vercelSyncDb.js";

export type OrderTransferItem = {
  id: string;
  recipient: string;
  amount: number;
};

/** Normalise transfers[] from orders.create (array or { items: [] }). */
export function extractTransfersFromOrder(order: unknown): OrderTransferItem[] {
  if (!order || typeof order !== "object") return [];

  const transfers = (order as { transfers?: unknown }).transfers;
  if (!transfers) return [];

  let items: unknown[] = [];
  if (Array.isArray(transfers)) {
    items = transfers;
  } else if (
    typeof transfers === "object" &&
    transfers !== null &&
    Array.isArray((transfers as { items?: unknown[] }).items)
  ) {
    items = (transfers as { items: unknown[] }).items;
  }

  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === "string" ? rec.id : null;
    if (!id) return [];
    const recipient =
      typeof rec.recipient === "string"
        ? rec.recipient
        : typeof rec.account === "string"
          ? rec.account
          : "";
    const amount =
      typeof rec.amount === "number" ? rec.amount : Number(rec.amount) || 0;
    return [{ id, recipient, amount }];
  });
}

const ROUTE_EVENT_STATUS: Record<string, string> = {
  "product.route.activated": "activated",
  "product.route.on_hold": "cooling",
  "product.route.needs_clarification": "needs_clarification",
  "product.route.activation.in_progress": "submitted",
  "product.route.under_review": "submitted",
  "product.route.rejected": "failed",
};

const ACTIVATION_STATUS_MAP: Record<string, string> = {
  activated: "activated",
  on_hold: "cooling",
  needs_clarification: "needs_clarification",
  under_review: "submitted",
  activation_in_progress: "submitted",
  in_progress: "submitted",
  rejected: "failed",
  failed: "failed",
};

export function validationStatusFromActivationStatus(
  activationStatus?: string | null,
  fallback = "submitted",
): string {
  if (activationStatus) {
    const mapped = ACTIVATION_STATUS_MAP[activationStatus.toLowerCase()];
    if (mapped) return mapped;
  }
  return fallback;
}

export function validationStatusForRouteWebhook(
  eventType: string,
  activationStatus?: string | null,
): string | null {
  if (activationStatus) {
    const mapped = ACTIVATION_STATUS_MAP[activationStatus.toLowerCase()];
    if (mapped) return mapped;
  }
  return ROUTE_EVENT_STATUS[eventType] ?? null;
}

export function readLinkedAccountId(entity: Record<string, unknown> | undefined): string | null {
  if (!entity) return null;
  if (typeof entity.account_id === "string") return entity.account_id;
  if (typeof entity.id === "string" && entity.id.startsWith("acc_") && !entity.id.includes("_prd_")) {
    return entity.id;
  }
  return null;
}

export function readProductId(entity: Record<string, unknown> | undefined): string | null {
  if (!entity) return null;
  if (typeof entity.id === "string" && entity.id.includes("_prd_")) return entity.id;
  return null;
}

export function readActivationStatus(entity: Record<string, unknown> | undefined): string | null {
  if (!entity) return null;
  if (typeof entity.activation_status === "string") return entity.activation_status;
  if (typeof entity.status === "string") return entity.status;
  return null;
}

export async function updateRecipientValidationStatus(params: {
  linkedAccountId?: string | null;
  productId?: string | null;
  validationStatus: string;
}): Promise<number> {
  const { linkedAccountId, productId, validationStatus } = params;
  if (!linkedAccountId && !productId) return 0;

  const result = await getPool().query(
    `UPDATE public.payment_recipient_config
     SET validation_status = $3,
         activated_at = CASE
           WHEN $3 = 'activated' THEN COALESCE(activated_at, NOW())
           ELSE activated_at
         END,
         updated_at = NOW()
     WHERE ($1::text IS NOT NULL AND razorpay_linked_account_id = $1)
        OR ($2::text IS NOT NULL AND razorpay_product_id = $2)`,
    [linkedAccountId ?? null, productId ?? null, validationStatus],
  );
  return result.rowCount ?? 0;
}

export type SyncRecipientValidationResult = {
  validationStatus: string;
  activationStatus: string | null;
  synced: boolean;
};

/**
 * Re-fetch Route product activation from Razorpay and mirror into
 * payment_recipient_config. Used by status endpoint (missed webhooks)
 * and one-off repair scripts. Falls back to stored status on Razorpay errors.
 */
export async function syncRecipientValidationFromRazorpay(params: {
  linkedAccountId: string;
  productId: string;
  currentValidationStatus: string;
}): Promise<SyncRecipientValidationResult> {
  const { linkedAccountId, productId, currentValidationStatus } = params;

  try {
    const product = await getRazorpayClient().products.fetch(linkedAccountId, productId);
    const activationStatus =
      product && typeof product === "object" && typeof product.activation_status === "string"
        ? product.activation_status
        : null;
    const validationStatus = validationStatusFromActivationStatus(
      activationStatus,
      currentValidationStatus,
    );

    if (validationStatus !== currentValidationStatus) {
      await updateRecipientValidationStatus({
        linkedAccountId,
        productId,
        validationStatus,
      });
      return { validationStatus, activationStatus, synced: true };
    }

    // Backfill activated_at when Razorpay says activated but DB never got the webhook.
    if (validationStatus === "activated") {
      await updateRecipientValidationStatus({
        linkedAccountId,
        productId,
        validationStatus,
      });
    }

    return { validationStatus, activationStatus, synced: false };
  } catch (err) {
    console.error("syncRecipientValidationFromRazorpay failed", {
      linkedAccountId,
      productId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      validationStatus: currentValidationStatus,
      activationStatus: null,
      synced: false,
    };
  }
}

/** Attach a Razorpay transfer id to the rent payment row for an order (idempotent). */
export async function attachTransferToRentPayment(params: {
  razorpayOrderId: string;
  razorpayTransferId: string;
  linkedAccountId?: string | null;
}): Promise<string | null> {
  const payment = await getPool().query<{ id: string }>(
    `SELECT id
     FROM public.rent_payments
     WHERE razorpay_order_id = $1
     LIMIT 1`,
    [params.razorpayOrderId],
  );
  const rentPaymentId = payment.rows[0]?.id;
  if (!rentPaymentId) return null;

  if (params.linkedAccountId) {
    await getPool().query(
      `UPDATE public.rent_payment_transfers t
       SET razorpay_transfer_id = $3
       FROM public.payment_recipient_config c
       WHERE t.rent_payment_id = $1
         AND t.recipient_phone = c.phone
         AND t.recipient_role = c.role
         AND c.razorpay_linked_account_id = $2
         AND (t.razorpay_transfer_id IS NULL OR t.razorpay_transfer_id = $3)`,
      [rentPaymentId, params.linkedAccountId, params.razorpayTransferId],
    );
  }

  await getPool().query(
    `UPDATE public.rent_payment_transfers
     SET razorpay_transfer_id = $2
     WHERE rent_payment_id = $1
       AND razorpay_transfer_id IS NULL
       AND id = (
         SELECT id
         FROM public.rent_payment_transfers
         WHERE rent_payment_id = $1
           AND razorpay_transfer_id IS NULL
         ORDER BY created_at ASC
         LIMIT 1
       )`,
    [rentPaymentId, params.razorpayTransferId],
  );

  await getPool().query(
    `UPDATE public.rent_payments
     SET razorpay_transfer_ids = COALESCE(razorpay_transfer_ids, '[]'::jsonb) || to_jsonb($2::text),
         updated_at = NOW()
     WHERE id = $1
       AND NOT COALESCE(razorpay_transfer_ids, '[]'::jsonb) @> to_jsonb($2::text)`,
    [rentPaymentId, params.razorpayTransferId],
  );

  return rentPaymentId;
}
