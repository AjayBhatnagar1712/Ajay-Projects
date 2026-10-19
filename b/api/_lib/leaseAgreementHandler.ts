/**
 * /api/v1/lease-agreements — JWT-scoped mobile creation-flow API.
 *
 * Routing (via the leasePath rewrite in vercel.json):
 *   POST   /api/v1/lease-agreements                 → create draft, returns id
 *   GET    /api/v1/lease-agreements                 → list caller's own (summary + status)
 *   GET    /api/v1/lease-agreements/:id             → full detail (parties + inventory + review state)
 *   POST   /api/v1/lease-agreements/:id/renew       → clone signed agreement into linked renewal draft
 *   PATCH  /api/v1/lease-agreements/:id             → partial property/commercial update (status excluded;
 *                                                     in_review edits clear party approvals + invalidate tokens)
 *   DELETE /api/v1/lease-agreements/:id             → cancel draft only (CASCADE parties + inventory);
 *                                                     non-draft → 400; other broker's id → 404
 *   POST   /api/v1/lease-agreements/:id/status      → guarded status transition
 *   POST   /api/v1/lease-agreements/:id/review/send → mint party review tokens + ensure in_review
 *   POST   /api/v1/lease-agreements/:id/parties/:partyId/review/resend → remint one party's token
 *   POST   /api/v1/lease-agreements/:id/parties/:partyId/review/shared → confirm link was shared
 *   PUT    /api/v1/lease-agreements/:id/parties     → replace full party set (in_review → reset review state)
 *   PUT    /api/v1/lease-agreements/:id/inventory   → replace full inventory list (in_review → reset review state)
 *   GET    /api/v1/lease-agreements/:id/pdf         → PDF preview bytes
 *   GET    /api/v1/lease-agreements/:id/signed-pdf  → authenticated signed PDF bytes (ownership)
 *
 * Every row is scoped to the authenticated broker (created_by_user_id). Requests
 * for another broker's agreement return 404 (not 403), matching brokerProfileHandler.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { generateLeaseAgreementPdf } from "@workspace/lease-agreement";
import {
  LeaseAgreementPatchSchema,
  LeaseInventoryReplaceSchema,
  LeasePartiesReplaceSchema,
  type LeaseAgreementPatch,
  type LeaseInventoryReplace,
  type LeasePartiesReplace,
  type LeaseAgreementStatusUpdate,
} from "./leaseAgreementSchemas.js";
import { BROKER_MARK_SIGNED_ERROR, parseLeaseAgreementStatusUpdate } from "./leaseAgreementStatus.js";
import {
  applyLeaseAgreementStatusTransition,
  STATUS_TRANSITION_AGREEMENT_COLUMNS,
  type StatusTransitionAgreementRow,
} from "./leaseAgreementStatusApply.js";
import { generateReviewToken, reviewTokenExpiresAt } from "./leaseAgreementReview.js";
import { buildLeaseAgreementPdfInput } from "./leaseAgreementPdf.js";
import { isLeaseAgreementFrozenForEdits, leaseAgreementFrozenEditError } from "./leaseAgreementEditGuard.js";
import { calculateRenewalDates } from "./leaseAgreementRenewal.js";
import { getSignedPdfBytes, SignedPdfBlobError } from "./signedPdfBlob.js";
import { sendSigningNotificationEmail } from "./signingEmail.js";
import { requestOrigin } from "./requestOrigin.js";
import { json, readJsonBody } from "./http.js";
import { sanitizeErrorForLog } from "./sanitizeErrorForLog.js";
import { assertJwtUserAuth } from "./syncAuth.js";
import { getPool } from "./vercelSyncDb.js";

type AgreementRow = {
  id: string;
  created_by_user_id: string;
  renewed_from_agreement_id: string | null;
  status: string;
  execution_date: string | null;
  effective_date: string | null;
  end_date: string | null;
  execution_city: string | null;
  duration_months: number | null;
  min_stay_months: number | null;
  notice_period_licensee_months: number | null;
  notice_period_licensor_months: number | null;
  monthly_rent_paise: number | null;
  security_deposit_paise: number | null;
  rent_due_day: number | null;
  brokerage_fee_paise: number | null;
  maintenance_included: boolean;
  monthly_maintenance_paise: number | null;
  property_address: string | null;
  area_sqft: string | null;
  facing: string | null;
  car_parking_count: number | null;
  created_at: Date | string;
  updated_at: Date | string;
  signed_at: Date | string | null;
  has_signed_pdf: boolean;
};

type PartyRow = {
  id: string;
  agreement_id: string;
  role: string;
  name: string;
  phone: string;
  title: string | null;
  age: number | null;
  address: string | null;
  aadhaar: string | null;
  pan: string | null;
  email: string | null;
  is_primary: boolean;
  sort_order: number;
  approval_status: string;
  review_comment: string | null;
  reviewed_at: Date | string | null;
  review_token: string | null;
  review_token_expires_at: Date | string | null;
  review_shared_at: Date | string | null;
};

type InventoryRow = {
  id: string;
  agreement_id: string;
  description: string;
  quantity: number;
  sort_order: number;
};

const ACTIVE_RENEWAL_STATUSES = ["draft", "in_review", "esign_sent"] as const;

const AGREEMENT_COLUMNS = `
  id,
  created_by_user_id,
  renewed_from_agreement_id,
  status,
  to_char(execution_date, 'YYYY-MM-DD') AS execution_date,
  to_char(effective_date, 'YYYY-MM-DD') AS effective_date,
  to_char(end_date, 'YYYY-MM-DD') AS end_date,
  execution_city,
  duration_months,
  min_stay_months,
  notice_period_licensee_months,
  notice_period_licensor_months,
  monthly_rent_paise,
  security_deposit_paise,
  rent_due_day,
  brokerage_fee_paise,
  maintenance_included,
  monthly_maintenance_paise,
  property_address,
  area_sqft,
  facing,
  car_parking_count,
  created_at,
  updated_at,
  signed_at,
  (signed_pdf_pathname IS NOT NULL) AS has_signed_pdf
`;

/** camelCase patch key → snake_case column, for the dynamic PATCH builder. */
const PATCH_COLUMN_MAP: Record<string, string> = {
  executionDate: "execution_date",
  effectiveDate: "effective_date",
  endDate: "end_date",
  executionCity: "execution_city",
  durationMonths: "duration_months",
  minStayMonths: "min_stay_months",
  noticePeriodLicenseeMonths: "notice_period_licensee_months",
  noticePeriodLicensorMonths: "notice_period_licensor_months",
  monthlyRentPaise: "monthly_rent_paise",
  securityDepositPaise: "security_deposit_paise",
  rentDueDay: "rent_due_day",
  brokerageFeePaise: "brokerage_fee_paise",
  maintenanceIncluded: "maintenance_included",
  monthlyMaintenancePaise: "monthly_maintenance_paise",
  propertyAddress: "property_address",
  areaSqft: "area_sqft",
  facing: "facing",
  carParkingCount: "car_parking_count",
};

function requestAuthorization(req: VercelRequest): string | undefined {
  const header = req.headers.authorization ?? req.headers.Authorization;
  if (Array.isArray(header)) return header[0];
  return header;
}

function leasePathSegments(req: VercelRequest): string[] {
  const raw = req.query.leasePath ?? req.query.path;
  if (Array.isArray(raw)) return raw.flatMap((value) => String(value).split("/")).filter(Boolean);
  if (typeof raw === "string" && raw.length > 0) return raw.split("/").filter(Boolean);
  return [];
}

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapAgreementRow(row: AgreementRow) {
  return {
    id: row.id,
    createdByUserId: row.created_by_user_id,
    renewedFromAgreementId: row.renewed_from_agreement_id,
    status: row.status,
    executionDate: row.execution_date,
    effectiveDate: row.effective_date,
    endDate: row.end_date,
    executionCity: row.execution_city,
    durationMonths: row.duration_months,
    minStayMonths: row.min_stay_months,
    noticePeriodLicenseeMonths: row.notice_period_licensee_months,
    noticePeriodLicensorMonths: row.notice_period_licensor_months,
    monthlyRentPaise: row.monthly_rent_paise,
    securityDepositPaise: row.security_deposit_paise,
    rentDueDay: row.rent_due_day,
    brokerageFeePaise: row.brokerage_fee_paise,
    maintenanceIncluded: row.maintenance_included,
    monthlyMaintenancePaise: row.monthly_maintenance_paise,
    propertyAddress: row.property_address,
    areaSqft: row.area_sqft === null ? null : Number(row.area_sqft),
    facing: row.facing,
    carParkingCount: row.car_parking_count,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    signedAt: row.signed_at === null ? null : toIso(row.signed_at),
    hasSignedPdf: Boolean(row.has_signed_pdf),
  };
}

type AgreementListRow = AgreementRow & {
  party_count: string | number | null;
  approved_count: string | number | null;
  changes_requested_count: string | number | null;
  withdrawn_count: string | number | null;
};

function mapAgreementListRow(row: AgreementListRow) {
  return {
    ...mapAgreementRow(row),
    partyCount: Number(row.party_count ?? 0),
    approvedCount: Number(row.approved_count ?? 0),
    changesRequestedCount: Number(row.changes_requested_count ?? 0),
    withdrawnCount: Number(row.withdrawn_count ?? 0),
  };
}

function isReviewTokenExpired(expiresAt: Date | string | null): boolean {
  if (expiresAt === null) return true;
  const expiryMs = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  return Number.isNaN(expiryMs) || expiryMs <= Date.now();
}

type ReviewLinkStatus = "none" | "active" | "expired";

/**
 * Distinguishes never-minted / cleared tokens from an expired leftover token.
 * Never expose the token value.
 */
function partyReviewLinkStatus(row: PartyRow): ReviewLinkStatus {
  if (typeof row.review_token !== "string" || row.review_token.length === 0) {
    return "none";
  }
  if (isReviewTokenExpired(row.review_token_expires_at)) {
    return "expired";
  }
  return "active";
}

function mapPartyRow(row: PartyRow) {
  const reviewLinkStatus = partyReviewLinkStatus(row);
  const reviewSharedAt = row.review_shared_at === null ? null : toIso(row.review_shared_at);
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    phone: row.phone,
    title: row.title,
    age: row.age,
    address: row.address,
    aadhaar: row.aadhaar,
    pan: row.pan,
    email: row.email,
    isPrimary: row.is_primary,
    sortOrder: row.sort_order,
    approvalStatus: row.approval_status,
    reviewComment: row.review_comment,
    reviewedAt: row.reviewed_at === null ? null : toIso(row.reviewed_at),
    /** True when a usable (non-expired) review token exists — never expose the token itself. */
    hasReviewToken: reviewLinkStatus === "active",
    reviewLinkStatus,
    reviewSharedAt,
    hasBeenShared: reviewSharedAt !== null,
  };
}

function mapInventoryRow(row: InventoryRow) {
  return {
    id: row.id,
    description: row.description,
    quantity: row.quantity,
    sortOrder: row.sort_order,
  };
}

async function selectAgreementForUser(id: string, userId: string): Promise<AgreementRow | null> {
  const result = await getPool().query<AgreementRow>(
    `SELECT ${AGREEMENT_COLUMNS}
     FROM public.lease_agreements
     WHERE id = $1 AND created_by_user_id = $2
     LIMIT 1`,
    [id, userId],
  );
  return result.rows[0] ?? null;
}

async function selectParties(agreementId: string): Promise<PartyRow[]> {
  const result = await getPool().query<PartyRow>(
    `SELECT id, agreement_id, role, name, phone, title, age, address,
            aadhaar, pan, email, is_primary, sort_order,
            approval_status, review_comment, reviewed_at,
            review_token, review_token_expires_at, review_shared_at
     FROM public.agreement_parties
     WHERE agreement_id = $1
     ORDER BY sort_order ASC, created_at ASC`,
    [agreementId],
  );
  return result.rows;
}

async function selectPartiesForUpdate(client: PoolClient, agreementId: string): Promise<PartyRow[]> {
  const result = await client.query<PartyRow>(
    `SELECT id, agreement_id, role, name, phone, title, age, address,
            aadhaar, pan, email, is_primary, sort_order,
            approval_status, review_comment, reviewed_at,
            review_token, review_token_expires_at, review_shared_at
     FROM public.agreement_parties
     WHERE agreement_id = $1
     ORDER BY sort_order ASC, created_at ASC
     FOR UPDATE`,
    [agreementId],
  );
  return result.rows;
}

async function selectInventory(agreementId: string): Promise<InventoryRow[]> {
  const result = await getPool().query<InventoryRow>(
    `SELECT id, agreement_id, description, quantity, sort_order
     FROM public.agreement_inventory_items
     WHERE agreement_id = $1
     ORDER BY sort_order ASC, created_at ASC`,
    [agreementId],
  );
  return result.rows;
}

async function handleCreate(userId: string, res: VercelResponse): Promise<void> {
  const inserted = await getPool().query<AgreementRow>(
    `INSERT INTO public.lease_agreements (created_by_user_id, rent_due_day)
     VALUES ($1, 5)
     RETURNING ${AGREEMENT_COLUMNS}`,
    [userId],
  );
  const row = inserted.rows[0];
  if (!row) {
    throw new Error("Failed to insert lease agreement");
  }
  json(res, 201, mapAgreementRow(row));
}

async function handleRenew(id: string, userId: string, res: VercelResponse): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const originalResult = await client.query<AgreementRow>(
      `SELECT ${AGREEMENT_COLUMNS}
       FROM public.lease_agreements
       WHERE id = $1 AND created_by_user_id = $2
       LIMIT 1
       FOR UPDATE`,
      [id, userId],
    );
    const original = originalResult.rows[0];
    if (!original) {
      await client.query("ROLLBACK");
      json(res, 404, { error: "Lease agreement not found" });
      return;
    }
    if (original.status !== "signed") {
      await client.query("ROLLBACK");
      json(res, 400, { error: "Only signed agreements can be renewed" });
      return;
    }

    const activeRenewal = await client.query<{ id: string; status: string }>(
      `SELECT id, status
       FROM public.lease_agreements
       WHERE renewed_from_agreement_id = $1
         AND created_by_user_id = $2
         AND status = ANY($3::text[])
       ORDER BY updated_at DESC
       LIMIT 1`,
      [id, userId, ACTIVE_RENEWAL_STATUSES],
    );
    const activeRenewalRow = activeRenewal.rows[0];
    if (activeRenewalRow) {
      await client.query("ROLLBACK");
      json(res, 409, {
        error: "Active renewal already exists for this agreement",
        renewalAgreementId: activeRenewalRow.id,
        status: activeRenewalRow.status,
      });
      return;
    }

    const partiesResult = await client.query<PartyRow>(
      `SELECT id, agreement_id, role, name, phone, title, age, address,
              aadhaar, pan, email, is_primary, sort_order,
              approval_status, review_comment, reviewed_at,
              review_token, review_token_expires_at, review_shared_at
       FROM public.agreement_parties
       WHERE agreement_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [id],
    );
    const inventoryResult = await client.query<InventoryRow>(
      `SELECT id, agreement_id, description, quantity, sort_order
       FROM public.agreement_inventory_items
       WHERE agreement_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [id],
    );

    const renewalDates = calculateRenewalDates({
      effectiveDate: original.effective_date,
      endDate: original.end_date,
      durationMonths: original.duration_months,
    });
    const renewedAgreementId = randomUUID();
    const inserted = await client.query<AgreementRow>(
      `INSERT INTO public.lease_agreements (
         id,
         created_by_user_id,
         renewed_from_agreement_id,
         status,
         execution_date,
         effective_date,
         end_date,
         execution_city,
         duration_months,
         min_stay_months,
         notice_period_licensee_months,
         notice_period_licensor_months,
         monthly_rent_paise,
         security_deposit_paise,
         rent_due_day,
         brokerage_fee_paise,
         maintenance_included,
         monthly_maintenance_paise,
         property_address,
         area_sqft,
         facing,
         car_parking_count
       ) VALUES (
         $1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10, $11,
         $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
       )
       RETURNING ${AGREEMENT_COLUMNS}`,
      [
        renewedAgreementId,
        userId,
        id,
        renewalDates.executionDate,
        renewalDates.effectiveDate,
        renewalDates.endDate,
        original.execution_city,
        renewalDates.durationMonths,
        original.min_stay_months,
        original.notice_period_licensee_months,
        original.notice_period_licensor_months,
        original.monthly_rent_paise,
        original.security_deposit_paise,
        5,
        original.brokerage_fee_paise,
        original.maintenance_included,
        original.monthly_maintenance_paise,
        original.property_address,
        original.area_sqft,
        original.facing,
        original.car_parking_count,
      ],
    );
    const renewed = inserted.rows[0];
    if (!renewed) {
      throw new Error("Failed to insert renewal agreement");
    }

    for (const party of partiesResult.rows) {
      await client.query(
        `INSERT INTO public.agreement_parties (
           id, agreement_id, role, name, phone, title, age, address,
           aadhaar, pan, email, is_primary, sort_order, approval_status
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8,
           $9, $10, $11, $12, $13, 'pending'
         )`,
        [
          randomUUID(),
          renewedAgreementId,
          party.role,
          party.name,
          party.phone,
          party.title,
          party.age,
          party.address,
          party.aadhaar,
          party.pan,
          party.email,
          party.is_primary,
          party.sort_order,
        ],
      );
    }

    for (const item of inventoryResult.rows) {
      await client.query(
        `INSERT INTO public.agreement_inventory_items (
           id, agreement_id, description, quantity, sort_order
         ) VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), renewedAgreementId, item.description, item.quantity, item.sort_order],
      );
    }

    const renewedParties = await client.query<PartyRow>(
      `SELECT id, agreement_id, role, name, phone, title, age, address,
              aadhaar, pan, email, is_primary, sort_order,
              approval_status, review_comment, reviewed_at,
              review_token, review_token_expires_at, review_shared_at
       FROM public.agreement_parties
       WHERE agreement_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [renewedAgreementId],
    );
    const renewedInventory = await client.query<InventoryRow>(
      `SELECT id, agreement_id, description, quantity, sort_order
       FROM public.agreement_inventory_items
       WHERE agreement_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [renewedAgreementId],
    );

    await client.query("COMMIT");
    json(res, 201, {
      ...mapAgreementRow(renewed),
      parties: renewedParties.rows.map(mapPartyRow),
      inventory: renewedInventory.rows.map(mapInventoryRow),
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function handleList(userId: string, res: VercelResponse): Promise<void> {
  const result = await getPool().query<AgreementListRow>(
    `SELECT a.id,
            a.created_by_user_id,
            a.renewed_from_agreement_id,
            a.status,
            to_char(a.execution_date, 'YYYY-MM-DD') AS execution_date,
            to_char(a.effective_date, 'YYYY-MM-DD') AS effective_date,
            to_char(a.end_date, 'YYYY-MM-DD') AS end_date,
            a.execution_city,
            a.duration_months,
            a.min_stay_months,
            a.notice_period_licensee_months,
            a.notice_period_licensor_months,
            a.monthly_rent_paise,
            a.security_deposit_paise,
            a.rent_due_day,
            a.brokerage_fee_paise,
            a.maintenance_included,
            a.monthly_maintenance_paise,
            a.property_address,
            a.area_sqft,
            a.facing,
            a.car_parking_count,
            a.created_at,
            a.updated_at,
            a.signed_at,
            (a.signed_pdf_pathname IS NOT NULL) AS has_signed_pdf,
            COALESCE(p.party_count, 0) AS party_count,
            COALESCE(p.approved_count, 0) AS approved_count,
            COALESCE(p.changes_requested_count, 0) AS changes_requested_count,
            COALESCE(p.withdrawn_count, 0) AS withdrawn_count
     FROM public.lease_agreements a
     LEFT JOIN (
       SELECT agreement_id,
              COUNT(*)::int AS party_count,
              COALESCE(SUM(CASE WHEN approval_status = 'approved' THEN 1 ELSE 0 END), 0)::int
                AS approved_count,
              COALESCE(SUM(CASE WHEN approval_status = 'changes_requested' THEN 1 ELSE 0 END), 0)::int
                AS changes_requested_count,
              COALESCE(SUM(CASE WHEN approval_status = 'withdrawn' THEN 1 ELSE 0 END), 0)::int
                AS withdrawn_count
       FROM public.agreement_parties
       GROUP BY agreement_id
     ) p ON p.agreement_id = a.id
     WHERE a.created_by_user_id = $1
     ORDER BY a.updated_at DESC`,
    [userId],
  );
  json(res, 200, { leaseAgreements: result.rows.map(mapAgreementListRow) });
}

async function handleDetail(id: string, userId: string, res: VercelResponse): Promise<void> {
  const agreement = await selectAgreementForUser(id, userId);
  if (!agreement) {
    json(res, 404, { error: "Lease agreement not found" });
    return;
  }
  const [parties, inventory] = await Promise.all([selectParties(id), selectInventory(id)]);
  json(res, 200, {
    ...mapAgreementRow(agreement),
    parties: parties.map(mapPartyRow),
    inventory: inventory.map(mapInventoryRow),
  });
}

/**
 * Cancel a draft agreement. Children cascade via FK ON DELETE CASCADE
 * (agreement_parties, agreement_inventory_items). Non-draft → 400.
 * Missing / other broker → 404 (same ownership shape as GET/PATCH).
 */
async function handleDelete(id: string, userId: string, res: VercelResponse): Promise<void> {
  const pool = getPool();
  const existing = await pool.query<{ id: string; status: string }>(
    `SELECT id, status
     FROM public.lease_agreements
     WHERE id = $1 AND created_by_user_id = $2`,
    [id, userId],
  );
  const row = existing.rows[0];
  if (!row) {
    json(res, 404, { error: "Lease agreement not found" });
    return;
  }
  if (row.status !== "draft") {
    json(res, 400, {
      error: "Only draft agreements can be cancelled",
    });
    return;
  }

  await pool.query(
    `DELETE FROM public.lease_agreements
     WHERE id = $1 AND created_by_user_id = $2 AND status = 'draft'`,
    [id, userId],
  );
  json(res, 200, { ok: true });
}

async function handlePdfPreview(id: string, userId: string, res: VercelResponse): Promise<void> {
  const agreement = await selectAgreementForUser(id, userId);
  if (!agreement) {
    json(res, 404, { error: "Lease agreement not found" });
    return;
  }

  const [parties, inventory] = await Promise.all([selectParties(id), selectInventory(id)]);

  const pdfInput = buildLeaseAgreementPdfInput(agreement, parties, inventory);
  if (!pdfInput.ok) {
    json(res, 400, { error: pdfInput.error, missing: pdfInput.missing });
    return;
  }

  const pdf = await generateLeaseAgreementPdf(pdfInput.input);
  res.status(200);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Length", String(pdf.bytes.byteLength));
  res.setHeader("Content-Disposition", `inline; filename="lease-agreement-${id}.pdf"`);
  res.end(Buffer.from(pdf.bytes));
}

async function handleSignedPdfDownload(id: string, userId: string, res: VercelResponse): Promise<void> {
  const owned = await getPool().query<{
    signed_pdf_pathname: string | null;
  }>(
    `SELECT signed_pdf_pathname
     FROM public.lease_agreements
     WHERE id = $1 AND created_by_user_id = $2
     LIMIT 1`,
    [id, userId],
  );
  const row = owned.rows[0];
  if (!row) {
    json(res, 404, { error: "Lease agreement not found" });
    return;
  }
  if (!row.signed_pdf_pathname) {
    json(res, 404, { error: "Signed PDF is not available yet" });
    return;
  }

  try {
    const bytes = await getSignedPdfBytes(row.signed_pdf_pathname);
    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", String(bytes.byteLength));
    res.setHeader("Content-Disposition", `attachment; filename="lease-agreement-${id}-signed.pdf"`);
    res.end(bytes);
  } catch (err) {
    if (err instanceof SignedPdfBlobError && err.code === "not_found") {
      json(res, 404, { error: err.message });
      return;
    }
    console.error("[lease-agreements] signed PDF download failed", sanitizeErrorForLog(err));
    json(res, 502, { error: "Could not download the signed PDF" });
  }
}

async function handlePatch(id: string, userId: string, patch: LeaseAgreementPatch, res: VercelResponse): Promise<void> {
  // Cross-field date check against the merged (existing + patch) values, so a
  // progressive save that sets endDate after effectiveDate is still validated.
  // Load + update run in one transaction so in_review edits atomically clear
  // stale approvals/tokens with the field write.
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const locked = await client.query<AgreementRow>(
      `SELECT ${AGREEMENT_COLUMNS}
       FROM public.lease_agreements
       WHERE id = $1 AND created_by_user_id = $2
       LIMIT 1
       FOR UPDATE`,
      [id, userId],
    );
    const existing = locked.rows[0];
    if (!existing) {
      await client.query("ROLLBACK");
      json(res, 404, { error: "Lease agreement not found" });
      return;
    }

    if (isLeaseAgreementFrozenForEdits(existing.status)) {
      await client.query("ROLLBACK");
      json(res, 400, { error: leaseAgreementFrozenEditError(existing.status) });
      return;
    }

    const effective = "effectiveDate" in patch ? (patch.effectiveDate ?? null) : existing.effective_date;
    const end = "endDate" in patch ? (patch.endDate ?? null) : existing.end_date;
    if (
      effective != null &&
      end != null &&
      new Date(`${end}T00:00:00Z`).getTime() <= new Date(`${effective}T00:00:00Z`).getTime()
    ) {
      await client.query("ROLLBACK");
      json(res, 400, { error: "endDate must be after effectiveDate" });
      return;
    }

    const setClauses: string[] = [];
    const values: unknown[] = [id, userId];
    for (const [key, value] of Object.entries({ ...patch, rentDueDay: 5 })) {
      const column = PATCH_COLUMN_MAP[key];
      if (!column) continue;
      values.push(value ?? null);
      setClauses.push(`${column} = $${values.length}`);
    }

    if (setClauses.length === 0) {
      await client.query("COMMIT");
      json(res, 200, mapAgreementRow(existing));
      return;
    }

    setClauses.push("updated_at = now()");
    const updated = await client.query<AgreementRow>(
      `UPDATE public.lease_agreements
       SET ${setClauses.join(", ")}
       WHERE id = $1 AND created_by_user_id = $2
       RETURNING ${AGREEMENT_COLUMNS}`,
      values,
    );
    const row = updated.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      json(res, 404, { error: "Lease agreement not found" });
      return;
    }

    if (existing.status === "in_review") {
      await invalidatePartyReviewState(client, id);
    }

    await client.query("COMMIT");
    json(res, 200, mapAgreementRow(row));
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function handleStatusTransition(
  id: string,
  userId: string,
  nextStatus: LeaseAgreementStatusUpdate["status"],
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (nextStatus === "signed") {
    json(res, 400, { error: BROKER_MARK_SIGNED_ERROR });
    return;
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await applyLeaseAgreementStatusTransition(client, {
      id,
      userId,
      nextStatus,
    });
    if (!result.ok) {
      await client.query("ROLLBACK");
      json(res, result.status, { error: result.error });
      return;
    }

    await client.query("COMMIT");

    if (result.fromStatus === "in_review" && nextStatus === "esign_sent") {
      const origin = requestOrigin(req).replace(/\/$/, "");
      const emailed = await sendSigningNotificationEmail({
        agreementId: id,
        propertyAddress: result.agreement.property_address,
        adminUrl: `${origin}/admin/agreements/${id}`,
      });
      if (emailed) {
        // Reuse the checked-out client — getPool() is max:1; a second pool.query here deadlocks.
        await client.query(
          `UPDATE public.lease_agreements
           SET signing_notified_at = now(), updated_at = now()
           WHERE id = $1`,
          [id],
        );
      }
    }

    json(res, 200, mapAgreementRow(result.agreement));
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function handleReviewSend(id: string, userId: string, req: VercelRequest, res: VercelResponse): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const owned = await client.query<StatusTransitionAgreementRow>(
      `SELECT ${STATUS_TRANSITION_AGREEMENT_COLUMNS}
       FROM public.lease_agreements
       WHERE id = $1 AND created_by_user_id = $2
       LIMIT 1
       FOR UPDATE`,
      [id, userId],
    );
    const existing = owned.rows[0];
    if (!existing) {
      await client.query("ROLLBACK");
      json(res, 404, { error: "Lease agreement not found" });
      return;
    }

    if (existing.status !== "draft" && existing.status !== "in_review") {
      await client.query("ROLLBACK");
      json(res, 400, {
        error: `Cannot send for review from status ${existing.status}. Allowed: draft, in_review.`,
      });
      return;
    }

    if (existing.status === "draft") {
      const transition = await applyLeaseAgreementStatusTransition(client, {
        id,
        userId,
        nextStatus: "in_review",
        existing,
      });
      if (!transition.ok) {
        await client.query("ROLLBACK");
        json(res, transition.status, { error: transition.error });
        return;
      }
    }

    const parties = await selectPartiesForUpdate(client, id);
    if (parties.length === 0) {
      await client.query("ROLLBACK");
      json(res, 400, {
        error: "Cannot send for review: agreement has no parties",
      });
      return;
    }

    const expiresAt = reviewTokenExpiresAt();
    const origin = requestOrigin(req).replace(/\/$/, "");
    const responseParties: Array<{
      id: string;
      name: string;
      role: string;
      reviewLink: string;
    }> = [];

    for (const party of parties) {
      const token = generateReviewToken();
      await client.query(
        `UPDATE public.agreement_parties
         SET review_token = $2,
             review_token_expires_at = $3,
             approval_status = 'pending',
             review_comment = NULL,
             reviewed_at = NULL,
             review_shared_at = NULL,
             updated_at = now()
         WHERE id = $1`,
        [party.id, token, expiresAt.toISOString()],
      );
      responseParties.push({
        id: party.id,
        name: party.name,
        role: party.role,
        reviewLink: `${origin}/review/${token}`,
      });
    }

    await client.query(`UPDATE public.lease_agreements SET updated_at = now() WHERE id = $1`, [id]);
    await client.query("COMMIT");

    json(res, 200, { parties: responseParties });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function handlePartyReviewResend(
  agreementId: string,
  partyId: string,
  userId: string,
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const status = await lockOwnedAgreementStatus(client, agreementId, userId);
    if (status === null) {
      await client.query("ROLLBACK");
      json(res, 404, { error: "Lease agreement not found" });
      return;
    }
    if (status !== "in_review") {
      await client.query("ROLLBACK");
      json(res, 400, {
        error: `Cannot resend review link from status ${status}. Allowed: in_review.`,
      });
      return;
    }

    const partyResult = await client.query<PartyRow>(
      `SELECT id, agreement_id, role, name, phone, title, age, address,
              aadhaar, pan, email, is_primary, sort_order,
              approval_status, review_comment, reviewed_at,
              review_token, review_token_expires_at, review_shared_at
       FROM public.agreement_parties
       WHERE id = $1 AND agreement_id = $2
       LIMIT 1
       FOR UPDATE`,
      [partyId, agreementId],
    );
    const party = partyResult.rows[0];
    if (!party) {
      await client.query("ROLLBACK");
      json(res, 404, { error: "Party not found" });
      return;
    }

    const token = generateReviewToken();
    const expiresAt = reviewTokenExpiresAt();
    await client.query(
      `UPDATE public.agreement_parties
       SET review_token = $2,
           review_token_expires_at = $3,
           approval_status = 'pending',
           review_comment = NULL,
           reviewed_at = NULL,
           review_shared_at = NULL,
           updated_at = now()
       WHERE id = $1`,
      [party.id, token, expiresAt.toISOString()],
    );

    await client.query(`UPDATE public.lease_agreements SET updated_at = now() WHERE id = $1`, [agreementId]);
    await client.query("COMMIT");

    const origin = requestOrigin(req).replace(/\/$/, "");
    json(res, 200, {
      id: party.id,
      name: party.name,
      role: party.role,
      reviewLink: `${origin}/review/${token}`,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function handlePartyReviewShared(
  agreementId: string,
  partyId: string,
  userId: string,
  res: VercelResponse,
): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const status = await lockOwnedAgreementStatus(client, agreementId, userId);
    if (status === null) {
      await client.query("ROLLBACK");
      json(res, 404, { error: "Lease agreement not found" });
      return;
    }
    if (status !== "in_review") {
      await client.query("ROLLBACK");
      json(res, 400, {
        error: `Cannot confirm review share from status ${status}. Allowed: in_review.`,
      });
      return;
    }

    const partyResult = await client.query<PartyRow>(
      `SELECT id, agreement_id, role, name, phone, title, age, address,
              aadhaar, pan, email, is_primary, sort_order,
              approval_status, review_comment, reviewed_at,
              review_token, review_token_expires_at, review_shared_at
       FROM public.agreement_parties
       WHERE id = $1 AND agreement_id = $2
       LIMIT 1
       FOR UPDATE`,
      [partyId, agreementId],
    );
    const party = partyResult.rows[0];
    if (!party) {
      await client.query("ROLLBACK");
      json(res, 404, { error: "Party not found" });
      return;
    }

    if (partyReviewLinkStatus(party) !== "active") {
      await client.query("ROLLBACK");
      json(res, 400, {
        error: "Cannot confirm share without a live review link",
      });
      return;
    }

    const updated = await client.query<PartyRow>(
      `UPDATE public.agreement_parties
       SET review_shared_at = now(),
           updated_at = now()
       WHERE id = $1
       RETURNING id, agreement_id, role, name, phone, title, age, address,
                 aadhaar, pan, email, is_primary, sort_order,
                 approval_status, review_comment, reviewed_at,
                 review_token, review_token_expires_at, review_shared_at`,
      [partyId],
    );
    const saved = updated.rows[0];
    if (!saved) {
      await client.query("ROLLBACK");
      json(res, 500, { error: "Could not confirm review share" });
      return;
    }

    await client.query(`UPDATE public.lease_agreements SET updated_at = now() WHERE id = $1`, [agreementId]);
    await client.query("COMMIT");

    json(res, 200, mapPartyRow(saved));
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Lock the caller's agreement row and return its status, or null if not found.
 */
async function lockOwnedAgreementStatus(client: PoolClient, id: string, userId: string): Promise<string | null> {
  const owned = await client.query<{ status: string }>(
    `SELECT status FROM public.lease_agreements
     WHERE id = $1 AND created_by_user_id = $2
     FOR UPDATE`,
    [id, userId],
  );
  return owned.rows[0]?.status ?? null;
}

/**
 * Editing an in_review agreement must never leave approvals attached to a
 * document the parties have not re-seen. Clears decisions and invalidates
 * review tokens (old links → 404 on public GET/POST).
 */
async function invalidatePartyReviewState(client: PoolClient, agreementId: string): Promise<void> {
  await client.query(
    `UPDATE public.agreement_parties
     SET approval_status = 'pending',
         review_comment = NULL,
         reviewed_at = NULL,
         review_token = NULL,
         review_token_expires_at = NULL,
         review_shared_at = NULL,
         updated_at = now()
     WHERE agreement_id = $1`,
    [agreementId],
  );
}

async function handleReplaceParties(
  id: string,
  userId: string,
  body: LeasePartiesReplace,
  res: VercelResponse,
): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const status = await lockOwnedAgreementStatus(client, id, userId);
    if (status === null) {
      await client.query("ROLLBACK");
      json(res, 404, { error: "Lease agreement not found" });
      return;
    }

    if (isLeaseAgreementFrozenForEdits(status)) {
      await client.query("ROLLBACK");
      json(res, 400, { error: leaseAgreementFrozenEditError(status) });
      return;
    }

    await client.query(`DELETE FROM public.agreement_parties WHERE agreement_id = $1`, [id]);

    for (let index = 0; index < body.parties.length; index += 1) {
      const party = body.parties[index];
      await client.query(
        `INSERT INTO public.agreement_parties (
           agreement_id, role, name, phone, title, age, address,
           aadhaar, pan, email, is_primary, sort_order
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          id,
          party.role,
          party.name,
          party.phone,
          party.title ?? null,
          party.age ?? null,
          party.address ?? null,
          party.aadhaar ?? null,
          party.pan ?? null,
          party.email ?? null,
          party.isPrimary,
          party.sortOrder ?? index,
        ],
      );
    }

    // DELETE already drops prior tokens; explicit invalidate keeps in_review
    // edits consistent with PATCH/inventory (pending, no live links).
    if (status === "in_review") {
      await invalidatePartyReviewState(client, id);
    }

    await client.query(`UPDATE public.lease_agreements SET updated_at = now() WHERE id = $1`, [id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  const parties = await selectParties(id);
  json(res, 200, { parties: parties.map(mapPartyRow) });
}

async function handleReplaceInventory(
  id: string,
  userId: string,
  body: LeaseInventoryReplace,
  res: VercelResponse,
): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const status = await lockOwnedAgreementStatus(client, id, userId);
    if (status === null) {
      await client.query("ROLLBACK");
      json(res, 404, { error: "Lease agreement not found" });
      return;
    }

    if (isLeaseAgreementFrozenForEdits(status)) {
      await client.query("ROLLBACK");
      json(res, 400, { error: leaseAgreementFrozenEditError(status) });
      return;
    }

    await client.query(`DELETE FROM public.agreement_inventory_items WHERE agreement_id = $1`, [id]);

    for (let index = 0; index < body.items.length; index += 1) {
      const item = body.items[index];
      await client.query(
        `INSERT INTO public.agreement_inventory_items (agreement_id, description, quantity, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [id, item.description, item.quantity, item.sortOrder ?? index],
      );
    }

    if (status === "in_review") {
      await invalidatePartyReviewState(client, id);
    }

    await client.query(`UPDATE public.lease_agreements SET updated_at = now() WHERE id = $1`, [id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  const inventory = await selectInventory(id);
  json(res, 200, { inventory: inventory.map(mapInventoryRow) });
}

export async function handleLeaseAgreementRequest(req: VercelRequest, res: VercelResponse): Promise<void> {
  const auth = await assertJwtUserAuth(requestAuthorization(req));
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  const userId = auth.user.userId;
  const method = req.method?.toUpperCase();
  const segments = leasePathSegments(req);

  try {
    // Collection routes: /api/v1/lease-agreements
    if (segments.length === 0) {
      if (method === "POST") {
        await handleCreate(userId, res);
        return;
      }
      if (method === "GET") {
        await handleList(userId, res);
        return;
      }
      json(res, 405, { error: "Method not allowed" });
      return;
    }

    const id = segments[0];
    if (!UUID_RE.test(id)) {
      json(res, 404, { error: "Lease agreement not found" });
      return;
    }

    // Item routes: /api/v1/lease-agreements/:id
    if (segments.length === 1) {
      if (method === "GET") {
        await handleDetail(id, userId, res);
        return;
      }
      if (method === "PATCH") {
        const body = LeaseAgreementPatchSchema.safeParse(readJsonBody(req));
        if (!body.success) {
          json(res, 400, { error: body.error.issues });
          return;
        }
        await handlePatch(id, userId, body.data, res);
        return;
      }
      if (method === "DELETE") {
        await handleDelete(id, userId, res);
        return;
      }
      json(res, 405, { error: "Method not allowed" });
      return;
    }

    // Sub-resource routes: /api/v1/lease-agreements/:id/{status|parties|inventory|pdf}
    if (segments.length === 2) {
      const sub = segments[1];
      if (sub === "status") {
        if (method !== "POST") {
          json(res, 405, { error: "Method not allowed" });
          return;
        }
        const body = parseLeaseAgreementStatusUpdate(readJsonBody(req));
        if (!body.success) {
          json(res, 400, { error: body.error.issues });
          return;
        }
        await handleStatusTransition(id, userId, body.data.status, req, res);
        return;
      }
      if (sub === "pdf") {
        if (method !== "GET") {
          json(res, 405, { error: "Method not allowed" });
          return;
        }
        await handlePdfPreview(id, userId, res);
        return;
      }
      if (sub === "signed-pdf") {
        if (method !== "GET") {
          json(res, 405, { error: "Method not allowed" });
          return;
        }
        await handleSignedPdfDownload(id, userId, res);
        return;
      }
      if (sub === "renew") {
        if (method !== "POST") {
          json(res, 405, { error: "Method not allowed" });
          return;
        }
        await handleRenew(id, userId, res);
        return;
      }
      if (sub === "parties") {
        if (method !== "PUT") {
          json(res, 405, { error: "Method not allowed" });
          return;
        }
        const body = LeasePartiesReplaceSchema.safeParse(readJsonBody(req));
        if (!body.success) {
          json(res, 400, { error: body.error.issues });
          return;
        }
        await handleReplaceParties(id, userId, body.data, res);
        return;
      }
      if (sub === "inventory") {
        if (method !== "PUT") {
          json(res, 405, { error: "Method not allowed" });
          return;
        }
        const body = LeaseInventoryReplaceSchema.safeParse(readJsonBody(req));
        if (!body.success) {
          json(res, 400, { error: body.error.issues });
          return;
        }
        await handleReplaceInventory(id, userId, body.data, res);
        return;
      }
    }

    // Nested: /api/v1/lease-agreements/:id/review/send
    if (segments.length === 3 && segments[1] === "review" && segments[2] === "send") {
      if (method !== "POST") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      await handleReviewSend(id, userId, req, res);
      return;
    }

    // Nested: /api/v1/lease-agreements/:id/parties/:partyId/review/shared
    if (
      segments.length === 5 &&
      segments[1] === "parties" &&
      UUID_RE.test(segments[2]) &&
      segments[3] === "review" &&
      segments[4] === "shared"
    ) {
      if (method !== "POST") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      await handlePartyReviewShared(id, segments[2], userId, res);
      return;
    }

    // Nested: /api/v1/lease-agreements/:id/parties/:partyId/review/resend
    if (
      segments.length === 5 &&
      segments[1] === "parties" &&
      UUID_RE.test(segments[2]) &&
      segments[3] === "review" &&
      segments[4] === "resend"
    ) {
      if (method !== "POST") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      await handlePartyReviewResend(id, segments[2], userId, req, res);
      return;
    }

    json(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("/api/v1/lease-agreements failed", sanitizeErrorForLog(err));
    json(res, 500, { error: "Internal server error" });
  }
}
