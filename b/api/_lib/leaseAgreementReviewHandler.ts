/**
 * Public lease-agreement review endpoints.
 *
 *   GET  /api/v1/review/:token  → agreement review payload (no JWT)
 *   POST /api/v1/review/:token  → approve / request changes / withdraw (no JWT)
 *
 * Access control is token match + expiry, via the server DB connection.
 * No public RLS and no anon table grants.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildLeaseAgreementPdfInput } from "./leaseAgreementPdf.js";
import {
  AGREEMENT_MOVED_FORWARD_MESSAGE,
  LeaseReviewDecisionSchema,
  REVIEW_WITHDRAWN_TERMINAL_MESSAGE,
  WITHDRAW_REQUIRES_APPROVAL_MESSAGE,
} from "./leaseAgreementReview.js";
import { json, readJsonBody } from "./http.js";
import { sanitizeErrorForLog } from "./sanitizeErrorForLog.js";
import { getPool } from "./vercelSyncDb.js";

type AgreementRow = {
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
  property_address: string | null;
  area_sqft: string | null;
  facing: string | null;
  car_parking_count: number | null;
};

type BrokerPublicRow = {
  name: string | null;
  phone: string | null;
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
  review_token: string | null;
  review_token_expires_at: Date | string | null;
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

type TokenLookup =
  | { kind: "missing" }
  | { kind: "expired"; party: PartyRow }
  | { kind: "valid"; party: PartyRow };

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
  property_address,
  area_sqft,
  facing,
  car_parking_count
`;

function reviewPathToken(req: VercelRequest): string | null {
  const raw = req.query.reviewPath ?? req.query.path ?? req.query.token;
  if (Array.isArray(raw)) {
    const first = raw[0];
    return typeof first === "string" && first.length > 0 ? first : null;
  }
  if (typeof raw === "string" && raw.length > 0) {
    const segment = raw.split("/").filter(Boolean)[0];
    return segment ?? null;
  }
  return null;
}

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function isExpired(expiresAt: Date | string | null): boolean {
  if (expiresAt === null) return true;
  const expiryMs =
    expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  return Number.isNaN(expiryMs) || expiryMs <= Date.now();
}

async function lookupPartyByToken(token: string): Promise<TokenLookup> {
  const result = await getPool().query<PartyRow>(
    `SELECT id, agreement_id, role, name, phone, title, age, address,
            aadhaar, pan, email, is_primary, sort_order,
            review_token, review_token_expires_at,
            approval_status, review_comment, reviewed_at
     FROM public.agreement_parties
     WHERE review_token = $1
     LIMIT 1`,
    [token],
  );
  const party = result.rows[0];
  if (!party) return { kind: "missing" };
  if (isExpired(party.review_token_expires_at)) {
    return { kind: "expired", party };
  }
  return { kind: "valid", party };
}

async function loadBrokerForAgreement(createdByUserId: string): Promise<{
  name: string;
  phone: string;
} | null> {
  const result = await getPool().query<BrokerPublicRow>(
    `SELECT
       COALESCE(NULLIF(b.name, ''), NULL) AS name,
       u.phone AS phone
     FROM auth.users u
     LEFT JOIN public.brokers b ON b.user_id = u.id
     WHERE u.id = $1
     LIMIT 1`,
    [createdByUserId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const phone = typeof row.phone === "string" ? row.phone.replace(/\D/g, "") : "";
  if (phone.length < 10) return null;
  const name =
    typeof row.name === "string" && row.name.trim().length > 0 ? row.name.trim() : "Your broker";
  return { name, phone };
}

async function loadAgreementBundle(agreementId: string): Promise<{
  agreement: AgreementRow | null;
  parties: PartyRow[];
  inventory: InventoryRow[];
}> {
  const [agreementResult, partiesResult, inventoryResult] = await Promise.all([
    getPool().query<AgreementRow>(
      `SELECT ${AGREEMENT_COLUMNS}
       FROM public.lease_agreements
       WHERE id = $1
       LIMIT 1`,
      [agreementId],
    ),
    getPool().query<PartyRow>(
      `SELECT id, agreement_id, role, name, phone, title, age, address,
              aadhaar, pan, email, is_primary, sort_order,
              review_token, review_token_expires_at,
              approval_status, review_comment, reviewed_at
       FROM public.agreement_parties
       WHERE agreement_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [agreementId],
    ),
    getPool().query<InventoryRow>(
      `SELECT id, description, quantity, sort_order
       FROM public.agreement_inventory_items
       WHERE agreement_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [agreementId],
    ),
  ]);

  return {
    agreement: agreementResult.rows[0] ?? null,
    parties: partiesResult.rows,
    inventory: inventoryResult.rows,
  };
}

function reviewDecisionBody(party: PartyRow) {
  return {
    decision: party.approval_status,
    comment: party.review_comment,
    reviewedAt: party.reviewed_at === null ? null : toIso(party.reviewed_at),
    party: {
      name: party.name,
      role: party.role,
      approvalStatus: party.approval_status,
    },
  };
}

async function loadAgreementStatus(agreementId: string): Promise<string | null> {
  const result = await getPool().query<{ status: string }>(
    `SELECT status
     FROM public.lease_agreements
     WHERE id = $1
     LIMIT 1`,
    [agreementId],
  );
  return result.rows[0]?.status ?? null;
}

function buildPublicReviewPayload(
  agreement: AgreementRow,
  parties: PartyRow[],
  inventory: InventoryRow[],
  viewer: PartyRow,
  broker: { name: string; phone: string } | null,
) {
  const pdfInput = buildLeaseAgreementPdfInput(agreement, parties, inventory);
  if (!pdfInput.ok) {
    return { ok: false as const, error: pdfInput.error, missing: pdfInput.missing };
  }

  // Mask KYC for every party in the public response, including the token-holder.
  const sanitizedParties = pdfInput.input.parties.map((party: (typeof pdfInput.input.parties)[number]) => ({
    ...party,
    aadhaar: null,
    pan: null,
  }));

  return {
    ok: true as const,
    payload: {
      agreementId: agreement.id,
      status: agreement.status,
      ...pdfInput.input,
      parties: sanitizedParties,
      viewer: {
        role: viewer.role,
        name: viewer.name,
        approvalStatus: viewer.approval_status,
        reviewComment: viewer.review_comment,
        reviewedAt: viewer.reviewed_at === null ? null : toIso(viewer.reviewed_at),
      },
      // Public review exposes only broker display name + dialable phone — nothing else.
      broker,
    },
  };
}

async function handleGet(token: string, res: VercelResponse): Promise<void> {
  const lookup = await lookupPartyByToken(token);
  if (lookup.kind === "missing") {
    json(res, 404, { error: "Review link not found" });
    return;
  }
  if (lookup.kind === "expired") {
    json(res, 410, { error: "Review link expired" });
    return;
  }

  const bundle = await loadAgreementBundle(lookup.party.agreement_id);
  if (!bundle.agreement) {
    json(res, 404, { error: "Review link not found" });
    return;
  }

  const broker = await loadBrokerForAgreement(bundle.agreement.created_by_user_id);
  const built = buildPublicReviewPayload(
    bundle.agreement,
    bundle.parties,
    bundle.inventory,
    lookup.party,
    broker,
  );
  if (!built.ok) {
    json(res, 400, { error: built.error, missing: built.missing });
    return;
  }

  json(res, 200, built.payload);
}

async function handlePost(token: string, req: VercelRequest, res: VercelResponse): Promise<void> {
  const body = LeaseReviewDecisionSchema.safeParse(readJsonBody(req));
  if (!body.success) {
    json(res, 400, { error: body.error.issues });
    return;
  }

  const lookup = await lookupPartyByToken(token);
  if (lookup.kind === "missing") {
    json(res, 404, { error: "Review link not found" });
    return;
  }
  if (lookup.kind === "expired") {
    json(res, 410, { error: "Review link expired" });
    return;
  }

  const agreementStatus = await loadAgreementStatus(lookup.party.agreement_id);
  if (!agreementStatus) {
    json(res, 404, { error: "Review link not found" });
    return;
  }
  if (agreementStatus !== "in_review") {
    json(res, 400, { error: AGREEMENT_MOVED_FORWARD_MESSAGE });
    return;
  }

  const decision = body.data.decision;
  const comment = body.data.comment?.trim() ? body.data.comment.trim() : null;

  if (decision === "withdrawn") {
    if (lookup.party.approval_status === "withdrawn") {
      json(res, 200, reviewDecisionBody(lookup.party));
      return;
    }
    if (lookup.party.approval_status !== "approved") {
      json(res, 400, { error: WITHDRAW_REQUIRES_APPROVAL_MESSAGE });
      return;
    }
  } else if (lookup.party.approval_status === "withdrawn") {
    json(res, 400, { error: REVIEW_WITHDRAWN_TERMINAL_MESSAGE });
    return;
  }

  const nextComment = decision === "withdrawn" ? null : comment;

  const updated = await getPool().query<PartyRow>(
    `UPDATE public.agreement_parties
     SET approval_status = $2,
         review_comment = $3,
         reviewed_at = now(),
         updated_at = now()
     WHERE id = $1
       AND review_token = $4
       AND review_token_expires_at IS NOT NULL
       AND review_token_expires_at > now()
     RETURNING id, agreement_id, role, name, phone, title, age, address,
               aadhaar, pan, email, is_primary, sort_order,
               review_token, review_token_expires_at,
               approval_status, review_comment, reviewed_at`,
    [lookup.party.id, decision, nextComment, token],
  );

  const party = updated.rows[0];
  if (!party) {
    // Token was replaced or expired between lookup and write.
    const again = await lookupPartyByToken(token);
    if (again.kind === "expired") {
      json(res, 410, { error: "Review link expired" });
      return;
    }
    json(res, 404, { error: "Review link not found" });
    return;
  }

  json(res, 200, reviewDecisionBody(party));
}

export async function handleLeaseAgreementReviewRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const method = req.method?.toUpperCase();
  const token = reviewPathToken(req);
  if (!token) {
    json(res, 404, { error: "Review link not found" });
    return;
  }

  try {
    if (method === "GET") {
      await handleGet(token, res);
      return;
    }
    if (method === "POST") {
      await handlePost(token, req, res);
      return;
    }
    json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("/api/v1/review failed", sanitizeErrorForLog(err));
    json(res, 500, { error: "Internal server error" });
  }
}
