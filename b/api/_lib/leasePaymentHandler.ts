/**
 * Lease-agreement payment orders (mobile owner/tenant portal).
 * Rent → owner Route linked account (on_hold: 0).
 * Brokerage → broker Route linked account (on_hold: 0, no escrow).
 */
import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { json, readJsonBody } from "./http.js";
import { getRazorpayClient } from "./razorpayClient.js";
import { extractTransfersFromOrder } from "./razorpayRouteHelpers.js";
import { assertPaymentAuth } from "./syncAuth.js";
import { sanitizeErrorForLog } from "./sanitizeErrorForLog.js";
import { getPool, phoneVariantsForPartyMatch } from "./vercelSyncDb.js";
import { calculateLeaseRentInvoice, indiaDate } from "./leaseRentBilling.js";
import { hasRenewalRentConflict } from "./leaseAgreementRentConflict.js";

const rentBodySchema = z.object({
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, "").slice(-10))
    .refine((v) => v.length === 10, "phone must be a 10-digit number"),
  agreementId: z.string().uuid(),
  rentPeriod: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, 'rentPeriod must be in "YYYY-MM" format'),
});

const brokerageBodySchema = z.object({
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, "").slice(-10))
    .refine((v) => v.length === 10, "phone must be a 10-digit number"),
  agreementId: z.string().uuid(),
});

type LeaseAgreementPayRow = {
  id: string;
  status: string;
  monthly_rent_paise: number | null;
  brokerage_fee_paise: number | null;
  created_by_user_id: string;
  effective_date: string | null;
  end_date: string | null;
};

type PartyPayRow = {
  role: string;
  name: string;
  phone: string;
};

type RecipientConfigRow = {
  razorpay_linked_account_id: string | null;
  commission_rate_bps: number;
  validation_status: string;
};

type RazorpayErrorShape = {
  error?: { description?: string };
};

type RazorpayOrderShape = {
  id: string;
  amount?: number;
  transfers?: unknown;
  status?: string;
};

class RentCheckoutError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

function requestAuthorization(req: VercelRequest): string | undefined {
  const header = req.headers.authorization ?? req.headers.Authorization;
  if (Array.isArray(header)) return header[0];
  return header;
}

function parseRazorpayError(err: unknown): string {
  const shaped = err as RazorpayErrorShape;
  if (shaped.error?.description) return shaped.error.description;
  if (err instanceof Error) return err.message;
  return "Unknown Razorpay error";
}

function toPhone10(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function razorpayKeyId(): string {
  return process.env.RAZORPAY_KEY_ID?.trim() ?? "";
}

async function loadLeaseAgreement(
  agreementId: string,
): Promise<LeaseAgreementPayRow | null> {
  const pool = getPool();
  const result = await pool.query<LeaseAgreementPayRow>(
    `SELECT id, status, monthly_rent_paise, brokerage_fee_paise, created_by_user_id,
            to_char(effective_date, 'YYYY-MM-DD') AS effective_date,
            to_char(end_date, 'YYYY-MM-DD') AS end_date
     FROM public.lease_agreements
     WHERE id = $1
     LIMIT 1`,
    [agreementId],
  );
  return result.rows[0] ?? null;
}

async function loadParties(agreementId: string): Promise<PartyPayRow[]> {
  const pool = getPool();
  const result = await pool.query<PartyPayRow>(
    `SELECT role, name, phone FROM public.agreement_parties WHERE agreement_id = $1`,
    [agreementId],
  );
  return result.rows;
}

async function loadRecipient(
  phone10: string,
  role: "owner" | "broker",
): Promise<RecipientConfigRow | null> {
  const pool = getPool();
  const result = await pool.query<RecipientConfigRow>(
    `SELECT razorpay_linked_account_id, commission_rate_bps, validation_status
     FROM public.payment_recipient_config
     WHERE phone = $1 AND role = $2
     LIMIT 1`,
    [phone10, role],
  );
  return result.rows[0] ?? null;
}

async function loadBrokerPhone(userId: string): Promise<string | null> {
  const pool = getPool();
  const result = await pool.query<{ phone: string | null }>(
    `SELECT phone FROM auth.users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  const phone = result.rows[0]?.phone;
  if (!phone) return null;
  const digits = toPhone10(phone);
  return digits.length === 10 ? digits : null;
}

function partyMatchesPhone(partyPhone: string, phone10: string): boolean {
  return (
    phoneVariantsForPartyMatch(phone10).includes(partyPhone) ||
    toPhone10(partyPhone) === phone10
  );
}

async function upsertRentPayment(params: {
  agreementId: string;
  ownerPhone: string;
  tenantPhone: string;
  rentPeriod: string;
  amountPaise: number;
  commissionPaise: number;
  ownerSettlementPaise: number;
  ownerName: string;
  createOrder: () => Promise<RazorpayOrderShape>;
}): Promise<{ id: string; orderId: string }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize checkouts for this agreement, including when the payment row
    // does not exist yet. Reuse the same client throughout (pool may be max:1).
    await client.query(
      `SELECT id FROM public.lease_agreements WHERE id = $1 FOR UPDATE`,
      [params.agreementId],
    );
    const existing = (
      await client.query<{
        id: string;
        status: string;
        paid_at: string | null;
        razorpay_order_id: string | null;
        amount_paise: number;
        commission_paise: number;
        owner_settlement_paise: number;
      }>(
        `SELECT id, status, paid_at, razorpay_order_id, amount_paise, commission_paise, owner_settlement_paise
       FROM public.rent_payments
       WHERE agreement_id = $1 AND rent_period = $2 AND payment_type = 'rent'
       FOR UPDATE`,
        [params.agreementId, params.rentPeriod],
      )
    ).rows[0];
    if (
      existing &&
      (existing.status === "paid" ||
        existing.status === "settled" ||
        existing.paid_at)
    ) {
      throw new RentCheckoutError(
        "Rent for this period has already been paid.",
        409,
        "rent_already_paid",
      );
    }
    if (existing?.razorpay_order_id) {
      if (
        Number(existing.amount_paise) !== params.amountPaise ||
        Number(existing.commission_paise) !== params.commissionPaise ||
        Number(existing.owner_settlement_paise) !== params.ownerSettlementPaise
      ) {
        throw new RentCheckoutError(
          "An earlier checkout has a different amount. Contact TrustKeyper to review it before paying.",
          409,
          "rent_amount_review_required",
        );
      }
      let order: RazorpayOrderShape;
      try {
        order = (await getRazorpayClient().orders.fetch(
          existing.razorpay_order_id,
        )) as RazorpayOrderShape;
      } catch (err) {
        throw new RentCheckoutError(
          parseRazorpayError(err),
          502,
          "gateway_error",
        );
      }
      if (order.status === "paid") {
        throw new RentCheckoutError(
          "This payment is already received and is being confirmed.",
          409,
          "rent_already_paid",
        );
      }
      if (
        Number(order.amount) !== params.amountPaise ||
        !["created", "attempted"].includes(order.status ?? "")
      ) {
        throw new RentCheckoutError(
          "The existing checkout needs review before payment.",
          409,
          "rent_amount_review_required",
        );
      }
      await client.query("COMMIT");
      return { id: existing.id, orderId: existing.razorpay_order_id };
    }
    const order = await params.createOrder();
    const transferIds = extractTransfersFromOrder(order).map((t) => t.id);
    const paymentResult = await client.query<{ id: string }>(
      `INSERT INTO public.rent_payments (
         id, agreement_id, owner_phone, tenant_phone, rent_period, payment_type,
         amount_paise, commission_paise, owner_settlement_paise, razorpay_order_id,
         status, initiated_by, payer_phone, razorpay_transfer_ids
       ) VALUES (
         $1, $2, $3, $4, $5, 'rent',
         $6, $7, $8, $9, 'created', 'tenant', $4, $10::jsonb
       )
       ON CONFLICT (agreement_id, rent_period) WHERE (payment_type = 'rent')
       DO UPDATE SET
         razorpay_order_id = EXCLUDED.razorpay_order_id,
         amount_paise = EXCLUDED.amount_paise,
         commission_paise = EXCLUDED.commission_paise,
         owner_settlement_paise = EXCLUDED.owner_settlement_paise,
         razorpay_transfer_ids = EXCLUDED.razorpay_transfer_ids,
         status = 'created',
         initiated_by = 'tenant',
         updated_at = NOW()
       WHERE rent_payments.status NOT IN ('paid', 'settled') AND rent_payments.paid_at IS NULL
       RETURNING id`,
      [
        randomUUID(),
        params.agreementId,
        params.ownerPhone,
        params.tenantPhone,
        params.rentPeriod,
        params.amountPaise,
        params.commissionPaise,
        params.ownerSettlementPaise,
        order.id,
        JSON.stringify(transferIds),
      ],
    );
    const rentPaymentId = paymentResult.rows[0]?.id;
    if (!rentPaymentId) throw new Error("rent_payments upsert failed");

    await client.query(
      `DELETE FROM public.rent_payment_transfers WHERE rent_payment_id = $1`,
      [rentPaymentId],
    );
    await client.query(
      `INSERT INTO public.rent_payment_transfers (
         id, rent_payment_id, recipient_phone, recipient_name, recipient_role,
         amount_paise, razorpay_transfer_id, status
       ) VALUES ($1, $2, $3, $4, 'owner', $5, $6, 'pending')`,
      [
        randomUUID(),
        rentPaymentId,
        params.ownerPhone,
        params.ownerName,
        params.ownerSettlementPaise,
        transferIds[0] ?? null,
      ],
    );
    await client.query("COMMIT");
    return { id: rentPaymentId, orderId: order.id };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function upsertBrokeragePayment(params: {
  agreementId: string;
  ownerPhone: string;
  tenantPhone: string;
  brokerPhone: string;
  amountPaise: number;
  razorpayOrderId: string;
  transferIds: string[];
  brokerName: string;
}): Promise<string> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const paymentResult = await client.query<{ id: string }>(
      `INSERT INTO public.rent_payments (
         id, agreement_id, owner_phone, tenant_phone, rent_period, payment_type,
         broker_phone, payee_role, amount_paise, commission_paise, owner_settlement_paise,
         razorpay_order_id, status, initiated_by, payer_phone, razorpay_transfer_ids
       ) VALUES (
         $1, $2, $3, $4, NULL, 'brokerage_tenant',
         $5, 'broker', $6, 0, $6, $7, 'created', 'tenant', $4, $8::jsonb
       )
       ON CONFLICT (agreement_id, payment_type) WHERE (payment_type IN ('brokerage_tenant', 'brokerage_owner'))
       DO UPDATE SET
         razorpay_order_id = EXCLUDED.razorpay_order_id,
         amount_paise = EXCLUDED.amount_paise,
         owner_settlement_paise = EXCLUDED.owner_settlement_paise,
         razorpay_transfer_ids = EXCLUDED.razorpay_transfer_ids,
         status = 'created',
         updated_at = NOW()
       RETURNING id`,
      [
        randomUUID(),
        params.agreementId,
        params.ownerPhone,
        params.tenantPhone,
        params.brokerPhone,
        params.amountPaise,
        params.razorpayOrderId,
        JSON.stringify(params.transferIds),
      ],
    );
    const rentPaymentId = paymentResult.rows[0]?.id;
    if (!rentPaymentId) throw new Error("brokerage upsert failed");

    await client.query(
      `DELETE FROM public.rent_payment_transfers WHERE rent_payment_id = $1`,
      [rentPaymentId],
    );
    await client.query(
      `INSERT INTO public.rent_payment_transfers (
         id, rent_payment_id, recipient_phone, recipient_name, recipient_role,
         amount_paise, razorpay_transfer_id, status
       ) VALUES ($1, $2, $3, $4, 'broker', $5, $6, 'pending')`,
      [
        randomUUID(),
        rentPaymentId,
        params.brokerPhone,
        params.brokerName,
        params.amountPaise,
        params.transferIds[0] ?? null,
      ],
    );
    await client.query("COMMIT");
    return rentPaymentId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function handleLeaseRentOrderRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const rawBody = readJsonBody(req);
  if (rawBody === null) {
    json(res, 400, { error: "Malformed JSON body" });
    return;
  }

  const parsed = rentBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    json(res, 400, {
      error: parsed.error.issues[0]?.message ?? "Invalid body",
    });
    return;
  }

  const body = parsed.data;
  const auth = await assertPaymentAuth(requestAuthorization(req), body.phone);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  if (!razorpayKeyId() || !process.env.RAZORPAY_KEY_SECRET?.trim()) {
    json(res, 503, {
      error: "Payment gateway not configured",
      code: "gateway_unavailable",
    });
    return;
  }

  try {
    const agreement = await loadLeaseAgreement(body.agreementId);
    if (!agreement || agreement.status !== "signed") {
      json(res, 404, { error: "Signed agreement not found" });
      return;
    }
    if (
      agreement.monthly_rent_paise == null ||
      agreement.monthly_rent_paise <= 0
    ) {
      json(res, 400, { error: "Agreement has no monthly rent" });
      return;
    }
    const invoice = calculateLeaseRentInvoice({
      rentPeriod: body.rentPeriod,
      effectiveDate: agreement.effective_date,
      endDate: agreement.end_date,
      monthlyRentPaise: agreement.monthly_rent_paise,
    });
    if (!invoice || invoice.amountPaise <= 0) {
      json(res, 400, {
        error: "Rent is not payable for this agreement period",
      });
      return;
    }

    const parties = await loadParties(body.agreementId);
    const tenant = parties.find(
      (p) => p.role === "tenant" && partyMatchesPhone(p.phone, body.phone),
    );
    if (!tenant) {
      json(res, 403, {
        error: "Only the tenant on this agreement can pay rent",
      });
      return;
    }
    if (invoice.coverageStart > indiaDate()) {
      json(res, 409, {
        error:
          "This rent bill is not available until its billing period starts.",
        code: "rent_not_issued",
      });
      return;
    }
    if (await hasRenewalRentConflict(agreement.id, body.rentPeriod)) {
      json(res, 409, {
        error:
          "Signed agreements in the renewal history cover the same dates. Contact TrustKeyper to review them before paying.",
        code: "renewal_rent_review_required",
      });
      return;
    }
    const owner = parties.find((p) => p.role === "owner") ?? null;
    if (!owner) {
      json(res, 400, { error: "Agreement has no owner party" });
      return;
    }
    const ownerPhone = toPhone10(owner.phone);
    const recipient = await loadRecipient(ownerPhone, "owner");
    if (
      !recipient?.razorpay_linked_account_id ||
      recipient.validation_status !== "activated"
    ) {
      json(res, 409, {
        error: "Owner payout method is not activated yet",
        code: "owner_payout_inactive",
      });
      return;
    }

    const amountPaise = invoice.amountPaise;
    const ownerAccountId = recipient.razorpay_linked_account_id;
    const commissionPaise = Math.round(
      (amountPaise * (recipient.commission_rate_bps ?? 0)) / 10000,
    );
    const ownerSettlementPaise = amountPaise - commissionPaise;

    const payment = await upsertRentPayment({
      agreementId: body.agreementId,
      ownerPhone,
      tenantPhone: body.phone,
      rentPeriod: body.rentPeriod,
      amountPaise,
      commissionPaise,
      ownerSettlementPaise,
      ownerName: owner.name,
      createOrder: async () => {
        try {
          return (await getRazorpayClient().orders.create({
            amount: amountPaise,
            currency: "INR",
            receipt: `lrent_${body.agreementId.slice(0, 8)}_${body.rentPeriod}`,
            transfers: [
              {
                account: ownerAccountId,
                amount: ownerSettlementPaise,
                currency: "INR",
                notes: {
                  agreement_id: body.agreementId,
                  rent_period: body.rentPeriod,
                  coverage_start: invoice.coverageStart,
                  coverage_end: invoice.coverageEnd,
                  due_date: invoice.dueDate,
                  owner_phone: ownerPhone,
                },
                on_hold: 0,
              },
            ],
          })) as RazorpayOrderShape;
        } catch (err) {
          console.error(
            "[lease-rent-order] razorpay",
            sanitizeErrorForLog(err),
          );
          throw new RentCheckoutError(
            parseRazorpayError(err),
            502,
            "gateway_error",
          );
        }
      },
    });

    json(res, 201, {
      orderId: payment.orderId,
      rentPaymentId: payment.id,
      amountPaise,
      commissionPaise,
      ownerSettlementPaise,
      currency: "INR",
      keyId: razorpayKeyId(),
      description: `Rent ${invoice.coverageStart} to ${invoice.coverageEnd}`,
      invoice,
    });
  } catch (err) {
    if (err instanceof RentCheckoutError) {
      json(res, err.status, { error: err.message, code: err.code });
      return;
    }
    console.error("[lease-rent-order]", sanitizeErrorForLog(err));
    json(res, 500, { error: "Internal server error" });
  }
}

export async function handleLeaseBrokerageOrderRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const rawBody = readJsonBody(req);
  if (rawBody === null) {
    json(res, 400, { error: "Malformed JSON body" });
    return;
  }

  const parsed = brokerageBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    json(res, 400, {
      error: parsed.error.issues[0]?.message ?? "Invalid body",
    });
    return;
  }

  const body = parsed.data;
  const auth = await assertPaymentAuth(requestAuthorization(req), body.phone);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  if (!razorpayKeyId() || !process.env.RAZORPAY_KEY_SECRET?.trim()) {
    json(res, 503, {
      error: "Payment gateway not configured",
      code: "gateway_unavailable",
    });
    return;
  }

  try {
    const agreement = await loadLeaseAgreement(body.agreementId);
    if (!agreement || agreement.status !== "signed") {
      json(res, 404, { error: "Signed agreement not found" });
      return;
    }
    if (
      agreement.brokerage_fee_paise == null ||
      agreement.brokerage_fee_paise <= 0
    ) {
      json(res, 400, { error: "No brokerage fee set on this agreement" });
      return;
    }

    const parties = await loadParties(body.agreementId);
    const tenant = parties.find(
      (p) => p.role === "tenant" && partyMatchesPhone(p.phone, body.phone),
    );
    if (!tenant) {
      json(res, 403, { error: "Only the tenant can pay brokerage" });
      return;
    }
    const owner = parties.find((p) => p.role === "owner");
    if (!owner) {
      json(res, 400, { error: "Agreement has no owner party" });
      return;
    }

    const brokerPhone = await loadBrokerPhone(agreement.created_by_user_id);
    if (!brokerPhone) {
      json(res, 409, {
        error: "Broker account phone not found",
        code: "broker_phone_missing",
      });
      return;
    }

    const recipient = await loadRecipient(brokerPhone, "broker");
    if (
      !recipient?.razorpay_linked_account_id ||
      recipient.validation_status !== "activated"
    ) {
      json(res, 409, {
        error:
          "Broker payout is not activated — broker must complete Route bank onboarding",
        code: "broker_payout_inactive",
      });
      return;
    }

    const amountPaise = agreement.brokerage_fee_paise;
    let order: RazorpayOrderShape;
    try {
      order = (await getRazorpayClient().orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: `lbrok_${body.agreementId.slice(0, 8)}`,
        transfers: [
          {
            account: recipient.razorpay_linked_account_id,
            amount: amountPaise,
            currency: "INR",
            notes: {
              agreement_id: body.agreementId,
              broker_phone: brokerPhone,
              payment_type: "brokerage_tenant",
            },
            on_hold: 0,
          },
        ],
      })) as RazorpayOrderShape;
    } catch (err) {
      console.error(
        "[lease-brokerage-order] razorpay",
        sanitizeErrorForLog(err),
      );
      json(res, 502, { error: parseRazorpayError(err) });
      return;
    }

    const transferIds = extractTransfersFromOrder(order).map((t) => t.id);
    const rentPaymentId = await upsertBrokeragePayment({
      agreementId: body.agreementId,
      ownerPhone: toPhone10(owner.phone),
      tenantPhone: body.phone,
      brokerPhone,
      amountPaise,
      razorpayOrderId: order.id,
      transferIds,
      brokerName: "Broker",
    });

    json(res, 201, {
      orderId: order.id,
      rentPaymentId,
      amountPaise,
      currency: "INR",
      keyId: razorpayKeyId(),
      description: "Consultancy fee",
    });
  } catch (err) {
    console.error("[lease-brokerage-order]", sanitizeErrorForLog(err));
    json(res, 500, { error: "Internal server error" });
  }
}
