/**
 * Admin-only lease agreement list, unsigned PDF, signed PDF upload/download, and signing email resend.
 *
 * Routing (via vercel.json leasePath rewrite):
 *   GET  /api/admin/lease-agreements
 *   GET  /api/admin/lease-agreements/:id
 *   GET  /api/admin/lease-agreements/:id/pdf
 *   GET  /api/admin/lease-agreements/:id/signed-pdf
 *   POST /api/admin/lease-agreements/:id/signed-pdf   multipart field "pdf"
 *   POST /api/admin/lease-agreements/:id/notify-signing
 */
import { readFile } from "node:fs/promises";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import formidable from "formidable";
import { generateLeaseAgreementPdf } from "@workspace/lease-agreement";
import { assertAdminAuth, readAuthorizationHeader } from "./adminAuth.js";
import { json } from "./http.js";
import { buildLeaseAgreementPdfInput } from "./leaseAgreementPdf.js";
import { requestOrigin } from "./requestOrigin.js";
import { sanitizeErrorForLog } from "./sanitizeErrorForLog.js";
import {
  assertPdfBytes,
  deleteSignedPdf,
  getSignedPdfBytes,
  putSignedPdf,
  SIGNED_PDF_MAX_BYTES,
  SignedPdfBlobError,
} from "./signedPdfBlob.js";
import { sendSigningNotificationEmail } from "./signingEmail.js";
import { getPool } from "./vercelSyncDb.js";

export const ADMIN_SIGNED_PDF_WRONG_STATUS_ERROR =
  "Upload a signed PDF only after the agreement has been sent for signing.";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AGREEMENT_COLUMNS = `
  id,
  created_by_user_id,
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
  maintenance_included,
  monthly_maintenance_paise,
  property_address,
  area_sqft,
  facing,
  car_parking_count,
  created_at,
  updated_at,
  signed_at,
  signing_notified_at,
  signed_uploaded_by_phone,
  (signed_pdf_pathname IS NOT NULL) AS has_signed_pdf
`;

type AdminAgreementRow = {
  id: string;
  created_by_user_id: string;
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
  maintenance_included: boolean;
  monthly_maintenance_paise: number | null;
  property_address: string | null;
  area_sqft: string | null;
  facing: string | null;
  car_parking_count: number | null;
  created_at: Date | string;
  updated_at: Date | string;
  signed_at: Date | string | null;
  signing_notified_at: Date | string | null;
  signed_uploaded_by_phone: string | null;
  has_signed_pdf: boolean;
};

type AdminAgreementListRow = AdminAgreementRow & {
  party_count: string | number | null;
  approved_count: string | number | null;
  changes_requested_count: string | number | null;
  withdrawn_count: string | number | null;
};

type PartyRow = {
  id: string;
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
};

type InventoryRow = {
  id: string;
  description: string;
  quantity: number;
  sort_order: number;
};

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function toIsoOrNull(value: Date | string | null): string | null {
  return value === null ? null : toIso(value);
}

function mapAdminAgreement(row: AdminAgreementRow) {
  return {
    id: row.id,
    createdByUserId: row.created_by_user_id,
    status: row.status,
    propertyAddress: row.property_address,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    signedAt: toIsoOrNull(row.signed_at),
    signingNotifiedAt: toIsoOrNull(row.signing_notified_at),
    signedUploadedByPhone: row.signed_uploaded_by_phone,
    hasSignedPdf: Boolean(row.has_signed_pdf),
  };
}

/** Full agreement fields for the admin detail view (includes party KYC for Leegality prep). */
function mapAdminAgreementDetail(row: AdminAgreementRow) {
  const areaSqft =
    row.area_sqft === null || row.area_sqft.trim() === "" ? null : Number(row.area_sqft);
  return {
    ...mapAdminAgreement(row),
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
    maintenanceIncluded: row.maintenance_included,
    monthlyMaintenancePaise: row.monthly_maintenance_paise,
    areaSqft: Number.isFinite(areaSqft) ? areaSqft : null,
    facing: row.facing,
    carParkingCount: row.car_parking_count,
  };
}

function mapAdminPartyRow(row: PartyRow) {
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
    reviewedAt: toIsoOrNull(row.reviewed_at),
  };
}

function mapAdminInventoryRow(row: InventoryRow) {
  return {
    id: row.id,
    description: row.description,
    quantity: row.quantity,
    sortOrder: row.sort_order,
  };
}

function mapAdminListRow(row: AdminAgreementListRow) {
  return {
    ...mapAdminAgreement(row),
    partyCount: Number(row.party_count ?? 0),
    approvedCount: Number(row.approved_count ?? 0),
    changesRequestedCount: Number(row.changes_requested_count ?? 0),
    withdrawnCount: Number(row.withdrawn_count ?? 0),
  };
}

function leasePathSegments(req: VercelRequest): string[] {
  const raw = req.query.leasePath ?? req.query.path;
  if (Array.isArray(raw)) return raw.flatMap((value) => String(value).split("/")).filter(Boolean);
  if (typeof raw === "string" && raw.length > 0) return raw.split("/").filter(Boolean);
  return [];
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function fileValue(files: formidable.Files, name: string): formidable.File | undefined {
  const raw = files[name];
  if (Array.isArray(raw)) return raw[0];
  if (raw && typeof raw === "object" && "filepath" in raw) return raw;
  return undefined;
}

function isMaxFileSizeError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as Error & { code?: number }).code;
  return code === 1009 || /maxFileSize|max file size/i.test(err.message);
}

async function selectAgreement(id: string): Promise<AdminAgreementRow | undefined> {
  const result = await getPool().query<AdminAgreementRow>(
    `SELECT ${AGREEMENT_COLUMNS}
     FROM public.lease_agreements
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  return result.rows[0];
}

async function selectParties(agreementId: string): Promise<PartyRow[]> {
  const result = await getPool().query<PartyRow>(
    `SELECT id, role, name, phone, title, age, address,
            aadhaar, pan, email, is_primary, sort_order,
            approval_status, review_comment, reviewed_at
     FROM public.agreement_parties
     WHERE agreement_id = $1
     ORDER BY sort_order ASC, created_at ASC`,
    [agreementId],
  );
  return result.rows;
}

async function selectInventory(agreementId: string): Promise<InventoryRow[]> {
  const result = await getPool().query<InventoryRow>(
    `SELECT id, description, quantity, sort_order
     FROM public.agreement_inventory_items
     WHERE agreement_id = $1
     ORDER BY sort_order ASC, created_at ASC`,
    [agreementId],
  );
  return result.rows;
}

async function handleList(res: VercelResponse): Promise<void> {
  const result = await getPool().query<AdminAgreementListRow>(
    `SELECT a.id,
            a.created_by_user_id,
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
            a.maintenance_included,
            a.monthly_maintenance_paise,
            a.property_address,
            a.area_sqft,
            a.facing,
            a.car_parking_count,
            a.created_at,
            a.updated_at,
            a.signed_at,
            a.signing_notified_at,
            a.signed_uploaded_by_phone,
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
     ORDER BY a.updated_at DESC`,
  );
  json(res, 200, { leaseAgreements: result.rows.map(mapAdminListRow) });
}

async function handleDetail(id: string, res: VercelResponse): Promise<void> {
  const agreement = await selectAgreement(id);
  if (!agreement) {
    json(res, 404, { error: "Lease agreement not found" });
    return;
  }
  const [parties, inventory] = await Promise.all([selectParties(id), selectInventory(id)]);
  json(res, 200, {
    ...mapAdminAgreementDetail(agreement),
    parties: parties.map(mapAdminPartyRow),
    inventory: inventory.map(mapAdminInventoryRow),
  });
}

async function handleUnsignedPdf(id: string, res: VercelResponse): Promise<void> {
  const agreement = await selectAgreement(id);
  if (!agreement) {
    json(res, 404, { error: "Lease agreement not found" });
    return;
  }

  const [parties, inventory] = await Promise.all([
    getPool().query<{
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
    }>(
      `SELECT id, agreement_id, role, name, phone, title, age, address,
              aadhaar, pan, email, is_primary, sort_order
       FROM public.agreement_parties
       WHERE agreement_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [id],
    ),
    selectInventory(id),
  ]);

  const pdfInput = buildLeaseAgreementPdfInput(agreement, parties.rows, inventory);
  if (!pdfInput.ok) {
    json(res, 400, { error: pdfInput.error, missing: pdfInput.missing });
    return;
  }

  const pdf = await generateLeaseAgreementPdf(pdfInput.input);
  res.status(200);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Length", String(pdf.bytes.byteLength));
  res.setHeader("Content-Disposition", `attachment; filename="lease-agreement-${id}.pdf"`);
  res.end(Buffer.from(pdf.bytes));
}

type ApplySignedPdfResult =
  | { ok: true; agreement: AdminAgreementRow }
  | { ok: false; status: 400 | 404 | 502; error: string };

/**
 * Upload-then-UPDATE. Never flips status unless the private Blob put succeeded.
 */
export async function applyAdminSignedPdfUpload(params: {
  agreementId: string;
  uploadedByPhone: string;
  bytes: Buffer;
  contentType: string | undefined;
}): Promise<ApplySignedPdfResult> {
  try {
    assertPdfBytes(params.bytes, params.contentType);
  } catch (err) {
    if (err instanceof SignedPdfBlobError) {
      return { ok: false, status: 400, error: err.message };
    }
    throw err;
  }

  const client = await getPool().connect();
  let previousPathname: string | null = null;
  try {
    await client.query("BEGIN");
    const locked = await client.query<{
      status: string;
      signed_pdf_pathname: string | null;
    }>(
      `SELECT status, signed_pdf_pathname
       FROM public.lease_agreements
       WHERE id = $1
       LIMIT 1
       FOR UPDATE`,
      [params.agreementId],
    );
    const existing = locked.rows[0];
    if (!existing) {
      await client.query("ROLLBACK");
      return { ok: false, status: 404, error: "Lease agreement not found" };
    }
    if (existing.status !== "esign_sent" && existing.status !== "signed") {
      await client.query("ROLLBACK");
      return { ok: false, status: 400, error: ADMIN_SIGNED_PDF_WRONG_STATUS_ERROR };
    }

    previousPathname = existing.signed_pdf_pathname;

    let stored: { pathname: string };
    try {
      stored = await putSignedPdf({
        agreementId: params.agreementId,
        bytes: params.bytes,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err instanceof SignedPdfBlobError) {
        const status = err.code === "not_configured" || err.code === "store_failed" ? 502 : 400;
        return { ok: false, status, error: err.message };
      }
      console.error("[admin-lease-agreements] blob put failed", sanitizeErrorForLog(err));
      return { ok: false, status: 502, error: "Could not store the signed PDF." };
    }

    const updated = await client.query<AdminAgreementRow>(
      `UPDATE public.lease_agreements
       SET status = 'signed',
           signed_at = now(),
           signed_pdf_pathname = $2,
           signed_uploaded_by_phone = $3,
           updated_at = now()
       WHERE id = $1
       RETURNING ${AGREEMENT_COLUMNS}`,
      [params.agreementId, stored.pathname, params.uploadedByPhone],
    );
    const row = updated.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false, status: 404, error: "Lease agreement not found" };
    }

    await client.query("COMMIT");

    if (previousPathname && previousPathname !== stored.pathname) {
      await deleteSignedPdf(previousPathname);
    }

    return { ok: true, agreement: row };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function handleSignedPdfDownload(id: string, res: VercelResponse): Promise<void> {
  const result = await getPool().query<{ signed_pdf_pathname: string | null }>(
    `SELECT signed_pdf_pathname
     FROM public.lease_agreements
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  const row = result.rows[0];
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
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="lease-agreement-${id}-signed.pdf"`,
    );
    res.end(bytes);
  } catch (err) {
    if (err instanceof SignedPdfBlobError && err.code === "not_found") {
      json(res, 404, { error: err.message });
      return;
    }
    console.error("[admin-lease-agreements] signed PDF download failed", sanitizeErrorForLog(err));
    json(res, 502, { error: "Could not download the signed PDF" });
  }
}

async function handleSignedPdfUpload(
  id: string,
  uploadedByPhone: string,
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  let files: formidable.Files;
  try {
    const form = formidable({
      maxFileSize: SIGNED_PDF_MAX_BYTES,
      multiples: false,
      filter: ({ mimetype }) =>
        !mimetype || mimetype === "application/pdf" || mimetype === "application/octet-stream",
    });
    [, files] = await form.parse(req);
  } catch (err) {
    if (isMaxFileSizeError(err)) {
      json(res, 400, { error: "Signed PDF is too large — max 10MB." });
      return;
    }
    json(res, 400, { error: "Invalid form data" });
    return;
  }

  const pdf = fileValue(files, "pdf") ?? fileValue(files, "file");
  if (!pdf?.filepath) {
    json(res, 400, { error: "Signed PDF file is required." });
    return;
  }

  const bytes = await readFile(pdf.filepath);
  const result = await applyAdminSignedPdfUpload({
    agreementId: id,
    uploadedByPhone,
    bytes,
    contentType: pdf.mimetype ?? headerValue(req.headers["content-type"]),
  });
  if (!result.ok) {
    json(res, result.status, { error: result.error });
    return;
  }
  json(res, 200, mapAdminAgreement(result.agreement));
}

async function handleNotifySigning(
  id: string,
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const agreement = await selectAgreement(id);
  if (!agreement) {
    json(res, 404, { error: "Lease agreement not found" });
    return;
  }
  if (agreement.status !== "esign_sent" && agreement.status !== "signed") {
    json(res, 400, {
      error: "Signing notification is only available after the agreement has been sent for signing.",
    });
    return;
  }

  const origin = requestOrigin(req).replace(/\/$/, "");
  const emailed = await sendSigningNotificationEmail({
    agreementId: id,
    propertyAddress: agreement.property_address,
    adminUrl: `${origin}/admin/agreements/${id}`,
  });
  if (!emailed) {
    json(res, 502, { error: "Could not send the signing notification email." });
    return;
  }

  const updated = await getPool().query<AdminAgreementRow>(
    `UPDATE public.lease_agreements
     SET signing_notified_at = now(), updated_at = now()
     WHERE id = $1
     RETURNING ${AGREEMENT_COLUMNS}`,
    [id],
  );
  const row = updated.rows[0];
  if (!row) {
    json(res, 404, { error: "Lease agreement not found" });
    return;
  }
  json(res, 200, mapAdminAgreement(row));
}

export async function handleAdminLeaseAgreementRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const auth = await assertAdminAuth(readAuthorizationHeader(req.headers));
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  const method = req.method?.toUpperCase();
  const segments = leasePathSegments(req);

  try {
    if (segments.length === 0) {
      if (method === "GET") {
        await handleList(res);
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

    if (segments.length === 1) {
      if (method === "GET") {
        await handleDetail(id, res);
        return;
      }
      json(res, 405, { error: "Method not allowed" });
      return;
    }

    if (segments.length === 2 && segments[1] === "pdf") {
      if (method !== "GET") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      await handleUnsignedPdf(id, res);
      return;
    }

    if (segments.length === 2 && segments[1] === "signed-pdf") {
      if (method === "GET") {
        await handleSignedPdfDownload(id, res);
        return;
      }
      if (method === "POST") {
        await handleSignedPdfUpload(id, auth.phone, req, res);
        return;
      }
      json(res, 405, { error: "Method not allowed" });
      return;
    }

    if (segments.length === 2 && segments[1] === "notify-signing") {
      if (method !== "POST") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      await handleNotifySigning(id, req, res);
      return;
    }

    json(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("[admin-lease-agreements] handler failed", sanitizeErrorForLog(err));
    json(res, 500, { error: "Internal server error" });
  }
}
