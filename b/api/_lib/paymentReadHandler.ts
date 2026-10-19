/**
 * Read APIs for rent payment history (tenant / owner) and broker
 * consultancy-fee history.
 * On-read transfer reconciliation heals missed transfer.* webhooks.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { json } from "./http.js";
import { getRazorpayClient } from "./razorpayClient.js";
import {
  applyTransferFailed,
  applyTransferProcessed,
  promoteToSettledIfComplete,
} from "./razorpayWebhookHandler.js";
import { assertPaymentAuth } from "./syncAuth.js";
import { sanitizeErrorForLog } from "./sanitizeErrorForLog.js";
import { getPool, normalizePhone } from "./vercelSyncDb.js";

const RECONCILE_MIN_AGE_SQL = "INTERVAL '2 minutes'";
const RECONCILE_MAX_AGE_SQL = "INTERVAL '7 days'";
const RECONCILE_COOLDOWN_SQL = "INTERVAL '2 minutes'";

const phoneQuerySchema = z.object({
  phone: z
    .string()
    .transform((v) => normalizePhone(v))
    .refine((v) => v.length === 10, "phone must be a 10-digit number"),
});

type TenantPaymentHistoryRow = {
  id: string;
  rent_period: string | null;
  amount_paise: number;
  status: string;
  payment_method: string | null;
  paid_at: Date | string | null;
  created_at: Date | string;
};

type StaleTransferCandidate = {
  rent_payment_id: string;
  razorpay_transfer_id: string;
  child_status: string;
};

function requestAuthorization(req: VercelRequest): string | undefined {
  const header = req.headers.authorization ?? req.headers.Authorization;
  if (Array.isArray(header)) return header[0];
  return header;
}

function queryParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function toIsoString(value: Date | string | null): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function transferStatus(entity: Record<string, unknown> | undefined): string | null {
  const status = entity?.status;
  return typeof status === "string" ? status : null;
}

/**
 * On-read self-heal for missed transfer.processed / transfer.failed webhooks.
 * Mirrors syncRecipientValidationFromRazorpay: re-fetch Razorpay, apply shared
 * settle/fail helpers. No Razorpay calls when there are no candidates.
 *
 * Idempotent: applyTransferProcessed / applyTransferFailed already skip when
 * the child is already in the terminal status.
 */
export async function reconcileStaleTransfers(
  phone: string,
  role: "tenant" | "owner",
): Promise<void> {
  const scopeSql =
    role === "tenant"
      ? `RIGHT(regexp_replace(COALESCE(a.tenant_contact, ''), '\\D', '', 'g'), 10) = $1`
      : `RIGHT(regexp_replace(COALESCE(a.account_phone, ''), '\\D', '', 'g'), 10) = $1
         AND a.account_role = 'owner'`;

  const candidates = await getPool().query<StaleTransferCandidate>(
    `SELECT DISTINCT
       rp.id AS rent_payment_id,
       t.razorpay_transfer_id,
       t.status AS child_status
     FROM public.rent_payments rp
     INNER JOIN public.agreements a ON a.id = rp.agreement_id
     INNER JOIN public.rent_payment_transfers t ON t.rent_payment_id = rp.id
     WHERE ${scopeSql}
       AND rp.payment_type = 'rent'
       AND rp.status = 'paid'
       AND t.razorpay_transfer_id IS NOT NULL
       AND (
         -- Path A: non-terminal child — needs a Razorpay re-fetch
         t.status NOT IN ('processed', 'failed')
         -- Path B: stranded settlement — every sibling already processed but the
         -- parent missed the paid → settled promotion (webhook ordering race)
         OR (
           t.status = 'processed'
           AND NOT EXISTS (
             SELECT 1
             FROM public.rent_payment_transfers t2
             WHERE t2.rent_payment_id = rp.id
               AND t2.status <> 'processed'
           )
         )
       )
       AND rp.paid_at IS NOT NULL
       AND rp.paid_at < NOW() - ${RECONCILE_MIN_AGE_SQL}
       AND rp.paid_at > NOW() - ${RECONCILE_MAX_AGE_SQL}
       AND (
         rp.last_reconciled_at IS NULL
         OR rp.last_reconciled_at < NOW() - ${RECONCILE_COOLDOWN_SQL}
       )`,
    [phone],
  );

  if (candidates.rows.length === 0) {
    return;
  }

  const attemptedPaymentIds = new Set<string>();

  for (const row of candidates.rows) {
    attemptedPaymentIds.add(row.rent_payment_id);
    const transferId = row.razorpay_transfer_id;

    try {
      if (row.child_status === "processed") {
        // Path B: children are already terminal — promote locally, no Razorpay call.
        await promoteToSettledIfComplete(row.rent_payment_id);
        continue;
      }

      const fetched = await getRazorpayClient().transfers.fetch(transferId);
      const entity = asRecord(fetched);
      const status = transferStatus(entity);

      if (status === "processed") {
        await applyTransferProcessed(transferId, entity);
      } else if (status === "failed") {
        await applyTransferFailed(transferId, entity);
      }
    } catch (err) {
      console.error("reconcileStaleTransfers transfer fetch/apply failed", {
        transferId,
        rentPaymentId: row.rent_payment_id,
        error: sanitizeErrorForLog(err),
      });
    }
  }

  const paymentIds = [...attemptedPaymentIds];
  if (paymentIds.length > 0) {
    try {
      await getPool().query(
        `UPDATE public.rent_payments
         SET last_reconciled_at = NOW(),
             updated_at = NOW()
         WHERE id = ANY($1::text[])`,
        [paymentIds],
      );
    } catch (err) {
      console.error("reconcileStaleTransfers last_reconciled_at update failed", {
        error: sanitizeErrorForLog(err),
      });
    }
  }
}

async function runReconcileBestEffort(phone: string, role: "tenant" | "owner"): Promise<void> {
  try {
    await reconcileStaleTransfers(phone, role);
  } catch (err) {
    console.error("reconcileStaleTransfers unexpected error", {
      phone,
      role,
      error: sanitizeErrorForLog(err),
    });
  }
}

/** Map a DB row to the tenant-facing payment history item (no commission fields). */
export function mapTenantPaymentHistoryItem(row: TenantPaymentHistoryRow): {
  id: string;
  rentPeriod: string | null;
  amountPaise: number;
  status: string;
  paymentMethod: string | null;
  paidAt: string | null;
  createdAt: string;
} {
  return {
    id: row.id,
    rentPeriod: row.rent_period,
    amountPaise: row.amount_paise,
    status: row.status,
    paymentMethod: row.payment_method,
    paidAt: toIsoString(row.paid_at),
    createdAt: toIsoString(row.created_at) ?? new Date(0).toISOString(),
  };
}

/**
 * GET /api/payments-tenant-history?phone=
 * Returns rent payments for agreements where tenant_contact matches the caller.
 */
export async function handleTenantPaymentHistoryRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "GET") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const parsed = phoneQuerySchema.safeParse({
    phone: queryParam(req.query.phone),
  });
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid query parameters";
    json(res, 400, { error: message });
    return;
  }

  const { phone } = parsed.data;
  const auth = await assertPaymentAuth(requestAuthorization(req), phone);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  try {
    await runReconcileBestEffort(phone, "tenant");

    const result = await getPool().query<TenantPaymentHistoryRow>(
      `SELECT
         rp.id,
         rp.rent_period,
         rp.amount_paise,
         rp.status,
         rp.payment_method,
         rp.paid_at,
         rp.created_at
       FROM public.rent_payments rp
       INNER JOIN public.agreements a ON a.id = rp.agreement_id
       WHERE RIGHT(regexp_replace(COALESCE(a.tenant_contact, ''), '\\D', '', 'g'), 10) = $1
         AND rp.payment_type = 'rent'
       ORDER BY rp.created_at DESC`,
      [phone],
    );

    json(res, 200, {
      payments: result.rows.map(mapTenantPaymentHistoryItem),
    });
  } catch (err) {
    console.error("payments-tenant-history unexpected error", sanitizeErrorForLog(err));
    json(res, 500, { error: "Internal server error" });
  }
}

type OwnerPaymentHistoryRow = {
  id: string;
  rent_period: string | null;
  amount_paise: number | string;
  owner_settlement_paise: number | string | null;
  commission_paise: number | string;
  status: string;
  payment_method: string | null;
  paid_at: Date | string | null;
  created_at: Date | string;
  transfer_failed_at: Date | string | null;
};

/** Map a DB row to the owner-facing payment history item (includes settlement split). */
export function mapOwnerPaymentHistoryItem(row: OwnerPaymentHistoryRow): {
  id: string;
  rentPeriod: string | null;
  amountPaise: number | string;
  ownerSettlementPaise: number | string | null;
  commissionPaise: number | string;
  status: string;
  paymentMethod: string | null;
  paidAt: string | null;
  createdAt: string;
  transferFailedAt: string | null;
} {
  return {
    id: row.id,
    rentPeriod: row.rent_period,
    amountPaise: row.amount_paise,
    ownerSettlementPaise: row.owner_settlement_paise,
    commissionPaise: row.commission_paise,
    status: row.status,
    paymentMethod: row.payment_method,
    paidAt: toIsoString(row.paid_at),
    createdAt: toIsoString(row.created_at) ?? new Date(0).toISOString(),
    transferFailedAt: toIsoString(row.transfer_failed_at),
  };
}

/**
 * GET /api/payments-owner-history?phone=
 * Returns rent payments for agreements owned by the caller (includes settlement split).
 */
export async function handleOwnerPaymentHistoryRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "GET") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const parsed = phoneQuerySchema.safeParse({
    phone: queryParam(req.query.phone),
  });
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid query parameters";
    json(res, 400, { error: message });
    return;
  }

  const { phone } = parsed.data;
  const auth = await assertPaymentAuth(requestAuthorization(req), phone);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  try {
    await runReconcileBestEffort(phone, "owner");

    const result = await getPool().query<OwnerPaymentHistoryRow>(
      `SELECT
         rp.id,
         rp.rent_period,
         rp.amount_paise,
         rp.owner_settlement_paise,
         rp.commission_paise,
         rp.status,
         rp.payment_method,
         rp.paid_at,
         rp.created_at,
         rp.transfer_failed_at
       FROM public.rent_payments rp
       INNER JOIN public.agreements a ON a.id = rp.agreement_id
       WHERE RIGHT(regexp_replace(COALESCE(a.account_phone, ''), '\\D', '', 'g'), 10) = $1
         AND a.account_role = 'owner'
         AND rp.payment_type = 'rent'
       ORDER BY rp.created_at DESC`,
      [phone],
    );

    json(res, 200, {
      payments: result.rows.map(mapOwnerPaymentHistoryItem),
    });
  } catch (err) {
    console.error("payments-owner-history unexpected error", sanitizeErrorForLog(err));
    json(res, 500, { error: "Internal server error" });
  }
}

type BrokerPaymentHistoryRow = {
  id: string;
  agreement_id: string | null;
  amount_paise: number;
  status: string;
  paid_at: Date | string | null;
  created_at: Date | string;
  property_label: string | null;
};

/** Map a DB row to the broker-facing consultancy-fee history item. */
export function mapBrokerPaymentHistoryItem(row: BrokerPaymentHistoryRow): {
  id: string;
  agreementId: string | null;
  amountPaise: number | string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  propertyAddress: string | null;
} {
  const label = row.property_label?.trim();
  return {
    id: row.id,
    agreementId: row.agreement_id,
    amountPaise: row.amount_paise,
    status: row.status,
    paidAt: toIsoString(row.paid_at),
    createdAt: toIsoString(row.created_at) ?? new Date(0).toISOString(),
    propertyAddress: label && label.length > 0 ? label : null,
  };
}

/**
 * GET /api/payments-broker-history?phone=
 * Returns paid/settled consultancy-fee (brokerage_*) payments for the caller.
 */
export async function handleBrokerPaymentHistoryRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "GET") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const parsed = phoneQuerySchema.safeParse({
    phone: queryParam(req.query.phone),
  });
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid query parameters";
    json(res, 400, { error: message });
    return;
  }

  const { phone } = parsed.data;
  const auth = await assertPaymentAuth(requestAuthorization(req), phone);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  try {
    const result = await getPool().query<BrokerPaymentHistoryRow>(
      `SELECT
         rp.id,
         rp.agreement_id,
         rp.amount_paise,
         rp.status,
         rp.paid_at,
         rp.created_at,
         COALESCE(la.property_address, NULLIF(a.property_title, '')) AS property_label
       FROM public.rent_payments rp
       LEFT JOIN public.lease_agreements la ON la.id = rp.agreement_id
       LEFT JOIN public.agreements a ON a.id = rp.agreement_id
       WHERE RIGHT(regexp_replace(COALESCE(rp.broker_phone, ''), '\\D', '', 'g'), 10) = $1
         AND rp.payment_type IN ('brokerage_tenant', 'brokerage_owner')
         AND rp.status IN ('paid', 'settled')
       ORDER BY COALESCE(rp.paid_at, rp.created_at) DESC`,
      [phone],
    );

    json(res, 200, {
      payments: result.rows.map(mapBrokerPaymentHistoryItem),
    });
  } catch (err) {
    console.error("payments-broker-history unexpected error", sanitizeErrorForLog(err));
    json(res, 500, { error: "Internal server error" });
  }
}
