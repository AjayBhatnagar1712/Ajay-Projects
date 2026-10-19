import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { json, readJsonBody } from "./http.js";
import { getRazorpayClient } from "./razorpayClient.js";
import { assertPaymentAuth } from "./syncAuth.js";
import { getPool, normalizePhone } from "./vercelSyncDb.js";

const createEscrowBodySchema = z.object({
  phone: z
    .string()
    .transform((value) => normalizePhone(value))
    .refine((value) => value.length === 10, "phone must be a 10-digit number"),
  agreementId: z.string().trim().min(1),
  paymentType: z.enum(["brokerage_tenant", "security_deposit"]),
});

const releaseEscrowBodySchema = z.object({
  agreementId: z.string().trim().min(1),
  phone: z
    .string()
    .transform((value) => normalizePhone(value))
    .refine((value) => value.length === 10, "phone must be a 10-digit number"),
});

type EscrowAgreementRow = {
  id: string;
  account_phone: string;
  account_role: string;
  property_id: string | null;
  tenant_contact: string;
  tenant_name: string;
  owner_name: string;
  brokerage_amount_paise: number | null;
  security_deposit_paise: number | null;
};

type RecipientConfigRow = {
  razorpay_linked_account_id: string | null;
  validation_status: string;
};

type EscrowPaymentRow = {
  id: string;
  status: string;
  razorpay_order_id: string | null;
  amount_paise: number;
  payment_type: string;
  owner_phone: string;
};

type RazorpayErrorShape = {
  error?: {
    description?: string;
  };
};

type RazorpayOrderShape = {
  id: string;
};

type TransferSpec = {
  account: string;
  amount: number;
  currency: "INR";
  notes: Record<string, string>;
  on_hold: 0 | 1;
};

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

function tenantPhoneFromContact(contact: string): string {
  return normalizePhone(contact);
}

async function loadEscrowAgreement(
  agreementId: string,
  tenantPhone: string,
): Promise<EscrowAgreementRow | null> {
  const pool = getPool();
  const result = await pool.query<EscrowAgreementRow>(
    `SELECT id, account_phone, account_role, property_id, tenant_contact, tenant_name,
            owner_name, brokerage_amount_paise, security_deposit_paise
     FROM public.agreements
     WHERE id = $1
     LIMIT 1`,
    [agreementId],
  );
  const row = result.rows[0];
  if (!row) return null;
  if (tenantPhoneFromContact(row.tenant_contact) !== tenantPhone) return null;
  return row;
}

async function loadRecipientConfig(phone: string, role: string): Promise<RecipientConfigRow | null> {
  const pool = getPool();
  const result = await pool.query<RecipientConfigRow>(
    `SELECT razorpay_linked_account_id, validation_status
     FROM public.payment_recipient_config
     WHERE phone = $1 AND role = $2
     LIMIT 1`,
    [phone, role],
  );
  return result.rows[0] ?? null;
}

async function loadExistingEscrowPayment(
  agreementId: string,
  paymentType: string,
): Promise<EscrowPaymentRow | null> {
  const pool = getPool();
  const result = await pool.query<EscrowPaymentRow>(
    `SELECT id, status, razorpay_order_id, amount_paise, payment_type, owner_phone
     FROM public.rent_payments
     WHERE agreement_id = $1 AND payment_type = $2
     LIMIT 1`,
    [agreementId, paymentType],
  );
  return result.rows[0] ?? null;
}

async function persistEscrowPayment(params: {
  agreementId: string;
  propertyId: string | null;
  recipientPhone: string;
  recipientRole: string;
  tenantPhone: string;
  paymentType: string;
  amountPaise: number;
  razorpayOrderId: string;
  recipientName: string;
}): Promise<string> {
  const pool = getPool();
  const existing = await loadExistingEscrowPayment(params.agreementId, params.paymentType);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let rentPaymentId = existing?.id;
    if (rentPaymentId) {
      await client.query(
        `UPDATE public.rent_payments
         SET razorpay_order_id = $1, status = 'created', amount_paise = $2, updated_at = NOW()
         WHERE id = $3`,
        [params.razorpayOrderId, params.amountPaise, rentPaymentId],
      );
    } else {
      const paymentResult = await client.query<{ id: string }>(
        `INSERT INTO public.rent_payments (
           id, agreement_id, property_id, owner_phone, tenant_phone, rent_period,
           payment_type, amount_paise, commission_paise, owner_settlement_paise,
           razorpay_order_id, status, initiated_by, payer_phone, payee_role
         ) VALUES (
           gen_random_uuid()::text, $1, $2, $3, $4, NULL,
           $5, $6, 0, $6, $7, 'created', 'tenant', $4, $8
         )
         RETURNING id`,
        [
          params.agreementId,
          params.propertyId,
          params.recipientPhone,
          params.tenantPhone,
          params.paymentType,
          params.amountPaise,
          params.razorpayOrderId,
          params.recipientRole,
        ],
      );
      rentPaymentId = paymentResult.rows[0]?.id;
    }

    if (!rentPaymentId) throw new Error("escrow payment upsert did not return id");

    await client.query(`DELETE FROM public.rent_payment_transfers WHERE rent_payment_id = $1`, [
      rentPaymentId,
    ]);

    await client.query(
      `INSERT INTO public.rent_payment_transfers (
         id, rent_payment_id, recipient_phone, recipient_name, recipient_role,
         amount_paise, razorpay_transfer_id, status
       ) VALUES (
         gen_random_uuid()::text, $1, $2, $3, $4, $5, NULL, 'pending'
       )`,
      [
        rentPaymentId,
        params.recipientPhone,
        params.recipientName,
        params.recipientRole,
        params.amountPaise,
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

export async function releaseEscrowForAgreement(agreementId: string): Promise<boolean> {
  const pool = getPool();
  const payments = await pool.query<EscrowPaymentRow>(
    `SELECT id, status, razorpay_order_id, amount_paise, payment_type, owner_phone
     FROM public.rent_payments
     WHERE agreement_id = $1
       AND payment_type IN ('brokerage_tenant', 'security_deposit')
       AND status = 'paid'`,
    [agreementId],
  );

  if (payments.rows.length === 0) return false;

  for (const payment of payments.rows) {
    await pool.query(
      `UPDATE public.rent_payments
       SET status = 'settled', updated_at = NOW()
       WHERE id = $1`,
      [payment.id],
    );
    await pool.query(
      `UPDATE public.rent_payment_transfers
       SET status = 'settled', updated_at = NOW()
       WHERE rent_payment_id = $1`,
      [payment.id],
    );
  }

  return true;
}

export async function handlePaymentCreateEscrowOrderRequest(
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

  const parsed = createEscrowBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request body";
    json(res, 400, { error: message });
    return;
  }

  const body = parsed.data;
  const auth = await assertPaymentAuth(requestAuthorization(req), body.phone);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  if (!process.env.RAZORPAY_KEY_ID?.trim() || !process.env.RAZORPAY_KEY_SECRET?.trim()) {
    json(res, 503, {
      error: "Payment gateway not configured",
      code: "gateway_unavailable",
    });
    return;
  }

  try {
    const agreement = await loadEscrowAgreement(body.agreementId, body.phone);
    if (!agreement) {
      json(res, 404, { error: "Agreement not found for tenant" });
      return;
    }

    const amountPaise =
      body.paymentType === "security_deposit"
        ? agreement.security_deposit_paise
        : agreement.brokerage_amount_paise;

    if (amountPaise == null || amountPaise <= 0) {
      json(res, 400, { error: "Agreement has no escrow amount configured" });
      return;
    }

    const recipientPhone = normalizePhone(agreement.account_phone);
    const recipientRole = agreement.account_role;
    const recipientConfig = await loadRecipientConfig(recipientPhone, recipientRole);
    if (!recipientConfig?.razorpay_linked_account_id) {
      json(res, 409, {
        error: "Recipient payment account not set up",
        hint: "Complete onboarding first",
      });
      return;
    }

    if (recipientConfig.validation_status !== "activated") {
      json(res, 409, {
        error: "Recipient payment account not yet activated",
        validationStatus: recipientConfig.validation_status,
      });
      return;
    }

    const existing = await loadExistingEscrowPayment(body.agreementId, body.paymentType);
    if (existing && existing.status === "paid") {
      json(res, 409, { error: "Escrow payment already completed", status: existing.status });
      return;
    }

    const transfers: TransferSpec[] = [
      {
        account: recipientConfig.razorpay_linked_account_id,
        amount: amountPaise,
        currency: "INR",
        notes: {
          agreement_id: body.agreementId,
          payment_type: body.paymentType,
          recipient_phone: recipientPhone,
        },
        on_hold: 1,
      },
    ];

    const receipt = `escrow_${body.agreementId}_${body.paymentType}`;
    let order: RazorpayOrderShape;
    try {
      order = (await getRazorpayClient().orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt,
        transfers,
      })) as RazorpayOrderShape;
    } catch (err) {
      json(res, 502, {
        error: "Failed to create escrow payment order",
        detail: parseRazorpayError(err),
      });
      return;
    }

    const rentPaymentId = await persistEscrowPayment({
      agreementId: body.agreementId,
      propertyId: agreement.property_id,
      recipientPhone,
      recipientRole,
      tenantPhone: body.phone,
      paymentType: body.paymentType,
      amountPaise,
      razorpayOrderId: order.id,
      recipientName: agreement.owner_name,
    });

    json(res, 200, {
      orderId: order.id,
      amount: amountPaise,
      currency: "INR",
      rentPaymentId,
      paymentType: body.paymentType,
      keyId: process.env.RAZORPAY_KEY_ID?.trim() ?? "",
    });
  } catch (err) {
    json(res, 500, { error: "Internal server error" });
  }
}

export async function handlePaymentReleaseEscrowRequest(
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

  const parsed = releaseEscrowBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request body";
    json(res, 400, { error: message });
    return;
  }

  const auth = await assertPaymentAuth(requestAuthorization(req), parsed.data.phone);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  const released = await releaseEscrowForAgreement(parsed.data.agreementId);
  if (!released) {
    json(res, 404, { error: "No paid escrow payment found to release" });
    return;
  }

  json(res, 200, { ok: true });
}
