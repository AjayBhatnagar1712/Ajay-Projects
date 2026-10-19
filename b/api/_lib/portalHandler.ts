/**
 * Owner/tenant portal — list/detail lease agreements where JWT phone is a party.
 * Also exposes payment status helpers for rent / brokerage / late alerts.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { json } from "./http.js";
import { assertJwtUserAuth } from "./syncAuth.js";
import { getPool, phoneVariantsForPartyMatch } from "./vercelSyncDb.js";
import { hasRenewalRentConflict } from "./leaseAgreementRentConflict.js";
import {
  calculateLeaseRentInvoice,
  indiaDate,
  issuedLeaseRentInvoices,
  type LeaseRentInvoice,
} from "./leaseRentBilling.js";

type PortalListRow = {
  id: string;
  status: string;
  property_address: string | null;
  monthly_rent_paise: number | null;
  security_deposit_paise: number | null;
  rent_due_day: number | null;
  brokerage_fee_paise: number | null;
  effective_date: string | null;
  end_date: string | null;
  signed_at: Date | string | null;
  party_role: string;
  party_name: string;
  party_approval_status: string;
};

type PortalDetailRow = PortalListRow & {
  created_by_user_id: string;
  execution_date: string | null;
  execution_city: string | null;
  duration_months: number | null;
  min_stay_months: number | null;
  notice_period_licensee_months: number | null;
  notice_period_licensor_months: number | null;
  maintenance_included: boolean;
  monthly_maintenance_paise: number | null;
  area_sqft: string | null;
  facing: string | null;
  car_parking_count: number | null;
  has_signed_pdf: boolean;
};

type PartyRow = {
  id: string;
  role: string;
  name: string;
  phone: string;
  is_primary: boolean;
  approval_status: string;
};

type PaymentRow = {
  id: string;
  payment_type: string;
  rent_period: string | null;
  status: string;
  amount_paise: number;
  paid_at: Date | string | null;
  razorpay_order_id?: string | null;
};

type RecipientRow = {
  validation_status: string;
  razorpay_linked_account_id: string | null;
};

function requestAuthorization(req: VercelRequest): string | undefined {
  const header = req.headers.authorization ?? req.headers.Authorization;
  if (Array.isArray(header)) return header[0];
  return header;
}

function portalPathSegments(req: VercelRequest): string[] {
  const raw = req.query.portalPath ?? req.query.path;
  if (Array.isArray(raw))
    return raw.flatMap((value) => String(value).split("/")).filter(Boolean);
  if (typeof raw === "string" && raw.length > 0)
    return raw.split("/").filter(Boolean);
  return [];
}

function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function currentRentPeriod(now = new Date()): string {
  return indiaDate(now).slice(0, 7);
}

export type PortalRentPaymentState =
  | "none"
  | "needs_review"
  | "upcoming"
  | "due_soon"
  | "late"
  | "paid"
  | "settled";

export function computeRentPaymentState(input: {
  agreementStatus: string;
  rentDueDay: number | null;
  periodPayment: PaymentRow | null;
  monthlyRentPaise: number | null;
  effectiveDate: string | null;
  endDate: string | null;
  hasRenewalConflict?: boolean;
  rentPeriod?: string;
  now?: Date;
}): {
  rentPeriod: string;
  state: PortalRentPaymentState;
  dueDate: string | null;
} {
  const now = input.now ?? new Date();
  const rentPeriod = input.rentPeriod ?? currentRentPeriod(now);
  if (input.agreementStatus !== "signed") {
    return { rentPeriod, state: "none", dueDate: null };
  }
  const invoice = calculateLeaseRentInvoice({
    rentPeriod,
    effectiveDate: input.effectiveDate,
    endDate: input.endDate,
    monthlyRentPaise: input.monthlyRentPaise,
  });
  if (!invoice || invoice.coverageStart > indiaDate(now)) {
    return { rentPeriod, state: "none", dueDate: null };
  }

  const dueDate = invoice.dueDate;
  const payment = input.periodPayment;

  if (
    payment &&
    (payment.status === "paid" ||
      payment.status === "settled" ||
      payment.paid_at)
  ) {
    return {
      rentPeriod,
      state: payment.status === "settled" ? "settled" : "paid",
      dueDate,
    };
  }
  if (input.hasRenewalConflict) {
    return { rentPeriod, state: "needs_review", dueDate: null };
  }
  if (indiaDate(now) > dueDate) {
    return { rentPeriod, state: "late", dueDate };
  }
  return { rentPeriod, state: "due_soon", dueDate };
}

type PortalRentInvoice = LeaseRentInvoice & { state: PortalRentPaymentState };

async function loadRentBilling(row: PortalListRow, payments: PaymentRow[]) {
  const now = new Date();
  const invoices: PortalRentInvoice[] = [];
  for (const invoice of issuedLeaseRentInvoices(
    {
      effectiveDate: row.effective_date,
      endDate: row.end_date,
      monthlyRentPaise: row.monthly_rent_paise,
    },
    now,
  )) {
    const payment =
      payments.find(
        (p) =>
          p.payment_type === "rent" && p.rent_period === invoice.rentPeriod,
      ) ?? null;
    const completed =
      payment &&
      (payment.status === "paid" ||
        payment.status === "settled" ||
        payment.paid_at);
    const conflict =
      !completed && (await hasRenewalRentConflict(row.id, invoice.rentPeriod));
    const legacyOrder =
      !completed &&
      payment?.razorpay_order_id &&
      Number(payment.amount_paise) !== invoice.amountPaise;
    const state = computeRentPaymentState({
      agreementStatus: row.status,
      rentDueDay: row.rent_due_day,
      monthlyRentPaise: row.monthly_rent_paise,
      effectiveDate: row.effective_date,
      endDate: row.end_date,
      periodPayment: payment,
      rentPeriod: invoice.rentPeriod,
      hasRenewalConflict: Boolean(conflict || legacyOrder),
      now,
    });
    invoices.push({
      ...invoice,
      amountPaise: completed
        ? Number(payment.amount_paise)
        : invoice.amountPaise,
      state: state.state,
    });
  }
  const selected =
    invoices.find(
      (invoice) => invoice.state !== "paid" && invoice.state !== "settled",
    ) ?? invoices.at(-1);
  return {
    invoices,
    selected,
    rentState: selected
      ? {
          rentPeriod: selected.rentPeriod,
          state: selected.state,
          dueDate: selected.dueDate,
        }
      : {
          rentPeriod: currentRentPeriod(now),
          state: "none" as const,
          dueDate: null,
        },
  };
}

async function ensureLateRentMarker(
  agreementId: string,
  ownerPhone: string,
  tenantPhone: string,
  rentPeriod: string,
  amountPaise: number,
): Promise<void> {
  const pool = getPool();
  const existing = await pool.query<{ id: string; status: string }>(
    `SELECT id, status FROM public.rent_payments
     WHERE agreement_id = $1 AND rent_period = $2 AND payment_type = 'rent'
     LIMIT 1`,
    [agreementId, rentPeriod],
  );
  if (existing.rows[0]) {
    if (
      existing.rows[0].status === "created" ||
      existing.rows[0].status === "late"
    ) {
      await pool.query(
        `UPDATE public.rent_payments SET status = 'late',
           amount_paise = CASE WHEN razorpay_order_id IS NULL THEN $2 ELSE amount_paise END,
           updated_at = now()
         WHERE id = $1 AND status NOT IN ('paid', 'settled') AND paid_at IS NULL`,
        [existing.rows[0].id, amountPaise],
      );
    }
    return;
  }
  await pool.query(
    `INSERT INTO public.rent_payments (
       id, agreement_id, owner_phone, tenant_phone, rent_period, payment_type,
       amount_paise, commission_paise, owner_settlement_paise, status, initiated_by, payer_phone
     ) VALUES (
       $1, $2, $3, $4, $5, 'rent', $6, 0, $6, 'late', 'system', $4
     ) ON CONFLICT (agreement_id, rent_period) WHERE (payment_type = 'rent') DO NOTHING`,
    [
      `late_${agreementId}_${rentPeriod}`,
      agreementId,
      ownerPhone,
      tenantPhone,
      rentPeriod,
      amountPaise,
    ],
  );
}

async function loadPaymentsForAgreement(
  agreementId: string,
): Promise<PaymentRow[]> {
  const pool = getPool();
  const result = await pool.query<PaymentRow>(
    `SELECT id, payment_type, rent_period, status, amount_paise, paid_at, razorpay_order_id
     FROM public.rent_payments
     WHERE agreement_id = $1`,
    [agreementId],
  );
  return result.rows;
}

async function loadOwnerPayoutStatus(ownerPhone10: string): Promise<{
  validationStatus: string | null;
  activated: boolean;
}> {
  const pool = getPool();
  const result = await pool.query<RecipientRow>(
    `SELECT validation_status, razorpay_linked_account_id
     FROM public.payment_recipient_config
     WHERE phone = $1 AND role = 'owner'
     LIMIT 1`,
    [ownerPhone10],
  );
  const row = result.rows[0];
  if (!row) return { validationStatus: null, activated: false };
  return {
    validationStatus: row.validation_status,
    activated:
      row.validation_status === "activated" &&
      Boolean(row.razorpay_linked_account_id),
  };
}

function mapListItem(
  row: PortalListRow,
  billing: Awaited<ReturnType<typeof loadRentBilling>>,
  brokeragePaid: boolean,
  payout: { validationStatus: string | null; activated: boolean } | null,
) {
  const { rentState, selected } = billing;
  return {
    id: row.id,
    status: row.status,
    propertyAddress: row.property_address,
    partyRole: row.party_role,
    partyName: row.party_name,
    partyApprovalStatus: row.party_approval_status,
    monthlyRentPaise: row.monthly_rent_paise,
    securityDepositPaise: row.security_deposit_paise,
    rentDueDay: 5,
    brokerageFeePaise: row.brokerage_fee_paise,
    brokeragePaid,
    effectiveDate: row.effective_date,
    endDate: row.end_date,
    signedAt: toIso(row.signed_at),
    rentPeriod: rentState.rentPeriod,
    rentPaymentState: rentState.state,
    rentDueDate: rentState.dueDate,
    rentAmountPaise: selected?.amountPaise ?? null,
    rentCoverageStart: selected?.coverageStart ?? null,
    rentCoverageEnd: selected?.coverageEnd ?? null,
    rentInvoices: billing.invoices,
    ownerPayout: payout,
  };
}

async function handleList(res: VercelResponse, phone10: string): Promise<void> {
  const variants = phoneVariantsForPartyMatch(phone10);
  const pool = getPool();
  const result = await pool.query<PortalListRow>(
    `SELECT
       a.id,
       a.status,
       a.property_address,
       a.monthly_rent_paise,
       a.security_deposit_paise,
       a.rent_due_day,
       a.brokerage_fee_paise,
       to_char(a.effective_date, 'YYYY-MM-DD') AS effective_date,
       to_char(a.end_date, 'YYYY-MM-DD') AS end_date,
       a.signed_at,
       ap.role AS party_role,
       ap.name AS party_name,
       ap.approval_status AS party_approval_status
     FROM agreement_parties ap
     INNER JOIN lease_agreements a ON a.id = ap.agreement_id
     WHERE ap.phone = ANY($1::text[])
       AND a.status = 'signed'
     ORDER BY a.updated_at DESC`,
    [variants],
  );

  const items = [];
  for (const row of result.rows) {
    const payments = await loadPaymentsForAgreement(row.id);
    const billing = await loadRentBilling(row, payments);
    const { rentState } = billing;

    if (rentState.state === "late" && row.monthly_rent_paise != null) {
      const parties = await pool.query<{ role: string; phone: string }>(
        `SELECT role, phone FROM agreement_parties WHERE agreement_id = $1`,
        [row.id],
      );
      const owner = parties.rows.find((p) => p.role === "owner");
      const tenant = parties.rows.find((p) => p.role === "tenant");
      if (owner && tenant) {
        const owner10 = owner.phone.replace(/\D/g, "").slice(-10);
        const tenant10 = tenant.phone.replace(/\D/g, "").slice(-10);
        await ensureLateRentMarker(
          row.id,
          owner10,
          tenant10,
          rentState.rentPeriod,
          billing.selected!.amountPaise,
        );
      }
    }

    const brokeragePaid = payments.some(
      (p) =>
        p.payment_type === "brokerage_tenant" &&
        (p.status === "paid" || p.status === "settled"),
    );

    let payout: { validationStatus: string | null; activated: boolean } | null =
      null;
    if (row.party_role === "owner") {
      payout = await loadOwnerPayoutStatus(phone10);
    }

    items.push(mapListItem(row, billing, brokeragePaid, payout));
  }

  json(res, 200, { agreements: items });
}

async function handleDetail(
  res: VercelResponse,
  phone10: string,
  agreementId: string,
): Promise<void> {
  const idParse = z.string().uuid().safeParse(agreementId);
  if (!idParse.success) {
    json(res, 400, { error: "Invalid agreement id" });
    return;
  }

  const variants = phoneVariantsForPartyMatch(phone10);
  const pool = getPool();
  const result = await pool.query<PortalDetailRow>(
    `SELECT
       a.id,
       a.created_by_user_id,
       a.status,
       a.property_address,
       a.monthly_rent_paise,
       a.security_deposit_paise,
       a.rent_due_day,
       a.brokerage_fee_paise,
       to_char(a.effective_date, 'YYYY-MM-DD') AS effective_date,
       to_char(a.end_date, 'YYYY-MM-DD') AS end_date,
       to_char(a.execution_date, 'YYYY-MM-DD') AS execution_date,
       a.execution_city,
       a.duration_months,
       a.min_stay_months,
       a.notice_period_licensee_months,
       a.notice_period_licensor_months,
       a.maintenance_included,
       a.monthly_maintenance_paise,
       a.area_sqft,
       a.facing,
       a.car_parking_count,
       a.signed_at,
       (a.signed_pdf_pathname IS NOT NULL) AS has_signed_pdf,
       ap.role AS party_role,
       ap.name AS party_name,
       ap.approval_status AS party_approval_status
     FROM agreement_parties ap
     INNER JOIN lease_agreements a ON a.id = ap.agreement_id
     WHERE a.id = $1 AND ap.phone = ANY($2::text[])
       AND a.status = 'signed'
     LIMIT 1`,
    [agreementId, variants],
  );

  const row = result.rows[0];
  if (!row) {
    json(res, 404, { error: "Agreement not found" });
    return;
  }

  const partiesResult = await pool.query<PartyRow>(
    `SELECT id, role, name, phone, is_primary, approval_status
     FROM agreement_parties
     WHERE agreement_id = $1
     ORDER BY sort_order ASC`,
    [agreementId],
  );

  const payments = await loadPaymentsForAgreement(agreementId);
  const billing = await loadRentBilling(row, payments);

  const brokeragePayment =
    payments.find((p) => p.payment_type === "brokerage_tenant") ?? null;
  const brokeragePaid =
    brokeragePayment != null &&
    (brokeragePayment.status === "paid" ||
      brokeragePayment.status === "settled");

  let payout: { validationStatus: string | null; activated: boolean } | null =
    null;
  if (row.party_role === "owner") {
    payout = await loadOwnerPayoutStatus(phone10);
  }

  const broker = await pool.query<{ phone: string | null }>(
    `SELECT phone FROM auth.users WHERE id = $1 LIMIT 1`,
    [row.created_by_user_id],
  );
  const brokerPhone = broker.rows[0]?.phone
    ? broker.rows[0].phone.replace(/\D/g, "").slice(-10)
    : null;

  json(res, 200, {
    ...mapListItem(row, billing, brokeragePaid, payout),
    createdByUserId: row.created_by_user_id,
    brokerPhone,
    executionDate: row.execution_date,
    executionCity: row.execution_city,
    durationMonths: row.duration_months,
    minStayMonths: row.min_stay_months,
    noticePeriodLicenseeMonths: row.notice_period_licensee_months,
    noticePeriodLicensorMonths: row.notice_period_licensor_months,
    maintenanceIncluded: row.maintenance_included,
    monthlyMaintenancePaise: row.monthly_maintenance_paise,
    areaSqft: row.area_sqft === null ? null : Number(row.area_sqft),
    facing: row.facing,
    carParkingCount: row.car_parking_count,
    hasSignedPdf: Boolean(row.has_signed_pdf),
    parties: partiesResult.rows.map((p) => ({
      id: p.id,
      role: p.role,
      name: p.name,
      phone: p.phone,
      isPrimary: p.is_primary,
      approvalStatus: p.approval_status,
    })),
    brokeragePaymentStatus: brokeragePayment?.status ?? null,
    payments: payments.map((p) => ({
      id: p.id,
      paymentType: p.payment_type,
      rentPeriod: p.rent_period,
      status: p.status,
      amountPaise: Number(p.amount_paise),
      paidAt: toIso(p.paid_at),
    })),
  });
}

export async function handlePortalRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const auth = await assertJwtUserAuth(requestAuthorization(req));
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  const method = (req.method ?? "GET").toUpperCase();
  const segments = portalPathSegments(req);

  if (method === "GET" && segments.length === 0) {
    await handleList(res, auth.user.phone);
    return;
  }

  if (method === "GET" && segments.length === 1) {
    await handleDetail(res, auth.user.phone, segments[0]!);
    return;
  }

  json(res, 404, { error: "Not found" });
}
