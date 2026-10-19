import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Razorpay from "razorpay";
import { json } from "./http.js";
import {
  attachTransferToRentPayment,
  readActivationStatus,
  readLinkedAccountId,
  readProductId,
  updateRecipientValidationStatus,
  validationStatusForRouteWebhook,
} from "./razorpayRouteHelpers.js";
import { getPool } from "./vercelSyncDb.js";

type RazorpayWebhookEvent = {
  id: string;
  entity: string;
  event: string;
  payload: {
    payment?: { entity: Record<string, unknown> };
    transfer?: { entity: Record<string, unknown> };
    order?: { entity: Record<string, unknown> };
    settlement?: { entity: Record<string, unknown> };
    account?: { entity: Record<string, unknown> };
    product?: { entity: Record<string, unknown> };
  };
  created_at: number;
};

async function readRawBody(req: VercelRequest): Promise<string> {
  const buf = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
  return buf.toString("utf8");
}

function headerString(req: VercelRequest, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function extractLedgerIds(event: RazorpayWebhookEvent): {
  razorpayPaymentId: string | null;
  razorpayOrderId: string | null;
  razorpayTransferId: string | null;
} {
  const payment = event.payload.payment?.entity;
  const transfer = event.payload.transfer?.entity;
  const order = event.payload.order?.entity;

  return {
    razorpayPaymentId: asString(payment?.id),
    razorpayOrderId:
      asString(payment?.order_id) ?? asString(order?.id) ?? asString(transfer?.source),
    razorpayTransferId: asString(transfer?.id),
  };
}

function resolveEventId(req: VercelRequest): string {
  return headerString(req, "x-razorpay-event-id") ?? randomUUID();
}

async function insertWebhookEvent(
  razorpayEventId: string,
  eventType: string,
  payload: RazorpayWebhookEvent,
  ids: ReturnType<typeof extractLedgerIds>,
): Promise<boolean> {
  const result = await getPool().query(
    `INSERT INTO public.razorpay_webhook_events (
       id, razorpay_event_id, event_type, payload, signature_valid,
       processing_status, razorpay_payment_id, razorpay_order_id, razorpay_transfer_id,
       created_at
     ) VALUES (
       gen_random_uuid()::text, $1, $2, $3::jsonb, true,
       'received', $4, $5, $6, NOW()
     )
     ON CONFLICT (razorpay_event_id) DO NOTHING`,
    [
      razorpayEventId,
      eventType,
      JSON.stringify(payload),
      ids.razorpayPaymentId,
      ids.razorpayOrderId,
      ids.razorpayTransferId,
    ],
  );
  return (result.rowCount ?? 0) > 0;
}

async function markWebhookEvent(
  razorpayEventId: string,
  fields: {
    processingStatus: "processed" | "failed" | "ignored";
    processingError?: string | null;
    rentPaymentId?: string | null;
  },
): Promise<void> {
  await getPool().query(
    `UPDATE public.razorpay_webhook_events
     SET processing_status = $2,
         processing_error = $3,
         rent_payment_id = COALESCE($4, rent_payment_id),
         processed_at = NOW()
     WHERE razorpay_event_id = $1`,
    [
      razorpayEventId,
      fields.processingStatus,
      fields.processingError ?? null,
      fields.rentPaymentId ?? null,
    ],
  );
}

async function resolveTransferRentPaymentId(
  razorpayTransferId: string,
  transferEntity: Record<string, unknown> | undefined,
): Promise<string | null> {
  const found = await getPool().query<{ rent_payment_id: string }>(
    `SELECT rent_payment_id
     FROM public.rent_payment_transfers
     WHERE razorpay_transfer_id = $1
     LIMIT 1`,
    [razorpayTransferId],
  );
  if (found.rows[0]) return found.rows[0].rent_payment_id;

  const sourceOrderId = asString(transferEntity?.source);
  if (!sourceOrderId) return null;

  return attachTransferToRentPayment({
    razorpayOrderId: sourceOrderId,
    razorpayTransferId,
    linkedAccountId: asString(transferEntity?.recipient),
  });
}

async function handleRouteRecipientStatus(
  event: RazorpayWebhookEvent,
  razorpayEventId: string,
): Promise<void> {
  const accountEntity = event.payload.account?.entity;
  const productEntity = event.payload.product?.entity;
  const linkedAccountId =
    readLinkedAccountId(accountEntity) ?? readLinkedAccountId(productEntity);
  const productId = readProductId(productEntity);
  const activationStatus = readActivationStatus(productEntity) ?? readActivationStatus(accountEntity);
  const validationStatus = validationStatusForRouteWebhook(event.event, activationStatus);

  if (!validationStatus) {
    await markWebhookEvent(razorpayEventId, { processingStatus: "ignored" });
    return;
  }

  const updated = await updateRecipientValidationStatus({
    linkedAccountId,
    productId,
    validationStatus,
  });

  await markWebhookEvent(razorpayEventId, {
    processingStatus: updated > 0 ? "processed" : "ignored",
  });
}

async function handleTransferCreated(
  event: RazorpayWebhookEvent,
  razorpayEventId: string,
): Promise<string | null> {
  const transfer = event.payload.transfer?.entity;
  const razorpayTransferId = asString(transfer?.id);
  const sourceOrderId = asString(transfer?.source);

  let rentPaymentId: string | null = null;
  if (razorpayTransferId && sourceOrderId) {
    rentPaymentId = await attachTransferToRentPayment({
      razorpayOrderId: sourceOrderId,
      razorpayTransferId,
      linkedAccountId: asString(transfer?.recipient),
    });
  }

  await markWebhookEvent(razorpayEventId, {
    processingStatus: "processed",
    rentPaymentId,
  });
  return rentPaymentId;
}

/**
 * Promote rent_payments → 'settled' when every child transfer is processed.
 * Idempotent and ordering-safe: only the 'paid' → 'settled' transition is
 * allowed (WHERE status = 'paid'), so repeat calls, concurrent webhooks, and
 * out-of-order transfer.processed / payment.captured deliveries are all safe.
 * A payment with any non-processed child (pending or failed) is never settled.
 */
export async function promoteToSettledIfComplete(rentPaymentId: string): Promise<boolean> {
  const counts = await getPool().query<{ total: number; processed: number }>(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'processed')::int AS processed
     FROM public.rent_payment_transfers
     WHERE rent_payment_id = $1`,
    [rentPaymentId],
  );
  const { total, processed } = counts.rows[0] ?? { total: 0, processed: 0 };
  if (total === 0 || total !== processed) {
    return false;
  }

  const result = await getPool().query(
    `UPDATE public.rent_payments
     SET status = 'settled',
         settled_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
       AND status = 'paid'`,
    [rentPaymentId],
  );
  return (result.rowCount ?? 0) > 0;
}

async function handlePaymentCaptured(
  event: RazorpayWebhookEvent,
  razorpayEventId: string,
): Promise<string | null> {
  const payment = event.payload.payment?.entity;
  const razorpayPaymentId = asString(payment?.id);
  const razorpayOrderId = asString(payment?.order_id);
  const method = asString(payment?.method);

  let rentPaymentId: string | null = null;

  if (razorpayOrderId) {
    const found = await getPool().query<{ id: string; status: string }>(
      `SELECT id, status
       FROM public.rent_payments
       WHERE razorpay_order_id = $1
       LIMIT 1`,
      [razorpayOrderId],
    );
    const row = found.rows[0];
    if (row) {
      rentPaymentId = row.id;
      if (row.status !== "paid" && row.status !== "settled") {
        await getPool().query(
          `UPDATE public.rent_payments
           SET status = 'paid',
               razorpay_payment_id = COALESCE($2, razorpay_payment_id),
               payment_method = COALESCE($3, payment_method),
               paid_at = NOW(),
               updated_at = NOW()
           WHERE id = $1`,
          [row.id, razorpayPaymentId, method],
        );
      }
      // transfer.processed may have arrived before payment.captured; the child
      // transfers can already be complete, so re-check settlement now.
      await promoteToSettledIfComplete(row.id);
    }
  }

  await markWebhookEvent(razorpayEventId, {
    processingStatus: "processed",
    rentPaymentId,
  });
  return rentPaymentId;
}

/**
 * Apply transfer.processed effects to rent_payment_transfers / rent_payments.
 * Shared by the webhook handler and (future) reconciliation. No webhook ledger writes.
 */
export async function applyTransferProcessed(
  transferId: string,
  transferEntity?: Record<string, unknown>,
): Promise<string | null> {
  let rentPaymentId: string | null = await resolveTransferRentPaymentId(
    transferId,
    transferEntity,
  );

  const found = await getPool().query<{
    id: string;
    rent_payment_id: string;
    status: string;
  }>(
    `SELECT id, rent_payment_id, status
     FROM public.rent_payment_transfers
     WHERE razorpay_transfer_id = $1
     LIMIT 1`,
    [transferId],
  );
  const row = found.rows[0];
  if (row) {
    if (row.status !== "processed") {
      await getPool().query(
        `UPDATE public.rent_payment_transfers
         SET status = 'processed',
             processed_at = NOW()
         WHERE id = $1`,
        [row.id],
      );
    }

    await promoteToSettledIfComplete(row.rent_payment_id);
  }

  return rentPaymentId;
}

async function handleTransferProcessed(
  event: RazorpayWebhookEvent,
  razorpayEventId: string,
): Promise<string | null> {
  const transfer = event.payload.transfer?.entity;
  const razorpayTransferId = asString(transfer?.id);

  const rentPaymentId = razorpayTransferId
    ? await applyTransferProcessed(razorpayTransferId, transfer)
    : null;

  await markWebhookEvent(razorpayEventId, {
    processingStatus: "processed",
    rentPaymentId,
  });
  return rentPaymentId;
}

async function handlePaymentFailed(
  event: RazorpayWebhookEvent,
  razorpayEventId: string,
): Promise<string | null> {
  const payment = event.payload.payment?.entity;
  const razorpayOrderId = asString(payment?.order_id);

  let rentPaymentId: string | null = null;

  if (razorpayOrderId) {
    const found = await getPool().query<{ id: string; status: string }>(
      `SELECT id, status
       FROM public.rent_payments
       WHERE razorpay_order_id = $1
       LIMIT 1`,
      [razorpayOrderId],
    );
    const row = found.rows[0];
    if (row) {
      rentPaymentId = row.id;
      if (row.status === "created") {
        await getPool().query(
          `UPDATE public.rent_payments
           SET status = 'failed',
               updated_at = NOW()
           WHERE id = $1`,
          [row.id],
        );
      }
    }
  }

  await markWebhookEvent(razorpayEventId, {
    processingStatus: "processed",
    rentPaymentId,
  });
  return rentPaymentId;
}

/**
 * Apply transfer.failed effects to rent_payment_transfers / rent_payments.
 * Shared by the webhook handler and (future) reconciliation. No webhook ledger writes.
 * transfer.error is webhook-payload-only — child table has no error column.
 */
export async function applyTransferFailed(
  transferId: string,
  transferEntity?: Record<string, unknown>,
): Promise<string | null> {
  let rentPaymentId: string | null = await resolveTransferRentPaymentId(
    transferId,
    transferEntity,
  );

  const found = await getPool().query<{
    id: string;
    rent_payment_id: string;
    status: string;
  }>(
    `SELECT id, rent_payment_id, status
     FROM public.rent_payment_transfers
     WHERE razorpay_transfer_id = $1
     LIMIT 1`,
    [transferId],
  );
  const row = found.rows[0];
  if (row) {
    rentPaymentId = row.rent_payment_id;
    if (row.status !== "failed") {
      await getPool().query(
        `UPDATE public.rent_payment_transfers
         SET status = 'failed',
             processed_at = NOW()
         WHERE id = $1`,
        [row.id],
      );
    }
    // Flag parent for ops; do not change rent_payments.status (tenant paid).
    await getPool().query(
      `UPDATE public.rent_payments
       SET transfer_failed_at = COALESCE(transfer_failed_at, NOW()),
           updated_at = NOW()
       WHERE id = $1`,
      [row.rent_payment_id],
    );
  }

  return rentPaymentId;
}

async function handleTransferFailed(
  event: RazorpayWebhookEvent,
  razorpayEventId: string,
): Promise<string | null> {
  const transfer = event.payload.transfer?.entity;
  const razorpayTransferId = asString(transfer?.id);
  // transfer.error (description/reason) is preserved in razorpay_webhook_events.payload.
  // rent_payment_transfers has no error/reason column — do not invent one.

  const rentPaymentId = razorpayTransferId
    ? await applyTransferFailed(razorpayTransferId, transfer)
    : null;

  await markWebhookEvent(razorpayEventId, {
    processingStatus: "processed",
    rentPaymentId,
  });
  return rentPaymentId;
}

async function handleSettlementProcessed(
  event: RazorpayWebhookEvent,
  razorpayEventId: string,
): Promise<string | null> {
  // Parent-merchant settlement entity typically includes:
  // id, entity, amount, status, fees, tax, utr, created_at.
  // No merchant-settlement ledger table exists — acknowledge only so the event
  // is recorded as processed (full payload already stored as jsonb).
  const settlement = event.payload.settlement?.entity;
  asString(settlement?.id);

  await markWebhookEvent(razorpayEventId, {
    processingStatus: "processed",
  });
  return null;
}

async function processWebhookEvent(
  event: RazorpayWebhookEvent,
  razorpayEventId: string,
): Promise<void> {
  switch (event.event) {
    case "payment.captured":
      await handlePaymentCaptured(event, razorpayEventId);
      return;
    case "transfer.created":
      await handleTransferCreated(event, razorpayEventId);
      return;
    case "transfer.processed":
      await handleTransferProcessed(event, razorpayEventId);
      return;
    case "payment.failed":
      await handlePaymentFailed(event, razorpayEventId);
      return;
    case "transfer.failed":
      await handleTransferFailed(event, razorpayEventId);
      return;
    case "settlement.processed":
      await handleSettlementProcessed(event, razorpayEventId);
      return;
    case "product.route.activated":
    case "product.route.on_hold":
    case "product.route.needs_clarification":
    case "product.route.activation.in_progress":
    case "product.route.under_review":
    case "product.route.rejected":
      await handleRouteRecipientStatus(event, razorpayEventId);
      return;
    default:
      if (event.event.startsWith("product.route.")) {
        await handleRouteRecipientStatus(event, razorpayEventId);
        return;
      }
      await markWebhookEvent(razorpayEventId, { processingStatus: "ignored" });
  }
}

export async function handleRazorpayWebhookRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  let razorpayEventId: string | null = null;

  try {
    const raw = await readRawBody(req);

    const sig = req.headers["x-razorpay-signature"];
    if (!sig || typeof sig !== "string") {
      json(res, 400, { error: "Missing signature" });
      return;
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) throw new Error("RAZORPAY_WEBHOOK_SECRET not configured");

    const isValid = Razorpay.validateWebhookSignature(raw, sig, webhookSecret);
    if (!isValid) {
      json(res, 400, { error: "Invalid signature" });
      return;
    }

    const event = JSON.parse(raw) as RazorpayWebhookEvent;
    razorpayEventId = resolveEventId(req);
    const ids = extractLedgerIds(event);

    const inserted = await insertWebhookEvent(razorpayEventId, event.event, event, ids);
    if (!inserted) {
      json(res, 200, { ok: true, status: "already_processed" });
      return;
    }

    try {
      await processWebhookEvent(event, razorpayEventId);
      json(res, 200, { ok: true, status: "processed" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markWebhookEvent(razorpayEventId, {
        processingStatus: "failed",
        processingError: message,
      });
      json(res, 200, { ok: false, status: "failed", error: message });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (razorpayEventId) {
      try {
        await markWebhookEvent(razorpayEventId, {
          processingStatus: "failed",
          processingError: message,
        });
      } catch {
        // Best-effort — still return 200 to Razorpay when possible.
      }
    }
    json(res, 200, { ok: false, status: "failed", error: message });
  }
}

/** Exported for unit tests only. */
export const razorpayWebhookHandlerTestApi = {
  handlePaymentCaptured,
  handleTransferFailed,
  handleSettlementProcessed,
  processWebhookEvent,
};
