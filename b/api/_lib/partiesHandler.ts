/**
 * GET /api/v1/parties?role=owner|tenant — JWT-scoped party contact summaries
 * for the Records tab. Phone-deduped across the broker's own agreements.
 *
 * Same-phone / different-name rule: contact fields (name, email, address) come
 * from the most recently created agreement_parties row (created_at DESC). Other
 * distinct names for that phone are returned in alternateNames so the broker
 * can see mismatches without duplicate contact rows.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { json } from "./http.js";
import { sanitizeErrorForLog } from "./sanitizeErrorForLog.js";
import { assertJwtUserAuth } from "./syncAuth.js";
import { getPool } from "./vercelSyncDb.js";

const PartyRoleQuerySchema = z.enum(["owner", "tenant"]);

export type PartyContactAgreement = {
  agreementId: string;
  propertyAddress: string | null;
  /** lease_agreements.status — e.g. draft, in_review, esign_sent, signed */
  status: string;
};

export type PartyContactSummary = {
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  role: "owner" | "tenant";
  /** Distinct other names seen for this phone (same-phone / different-name cases). */
  alternateNames: string[];
  agreementCount: number;
  agreements: PartyContactAgreement[];
};

export type PartyContactSourceRow = {
  phone: string;
  name: string;
  email: string | null;
  address: string | null;
  role: "owner" | "tenant";
  partyCreatedAt: Date | string;
  agreementId: string;
  propertyAddress: string | null;
  status: string;
};

function partyCreatedAtMs(value: Date | string): number {
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Collapse per-agreement party rows into one contact per phone.
 * Rows must already be filtered to a single role and broker.
 */
export function dedupePartyContactRows(rows: PartyContactSourceRow[]): PartyContactSummary[] {
  const byPhone = new Map<
    string,
    {
      newest: PartyContactSourceRow;
      names: Set<string>;
      agreements: Map<string, PartyContactAgreement>;
    }
  >();

  for (const row of rows) {
    const existing = byPhone.get(row.phone);
    if (!existing) {
      byPhone.set(row.phone, {
        newest: row,
        names: new Set([row.name.trim()].filter((name) => name.length > 0)),
        agreements: new Map([
          [
            row.agreementId,
            {
              agreementId: row.agreementId,
              propertyAddress: row.propertyAddress,
              status: row.status,
            },
          ],
        ]),
      });
      continue;
    }

    existing.names.add(row.name.trim());
    existing.agreements.set(row.agreementId, {
      agreementId: row.agreementId,
      propertyAddress: row.propertyAddress,
      status: row.status,
    });

    // Prefer the most recently created party row for display name / email / address.
    if (partyCreatedAtMs(row.partyCreatedAt) > partyCreatedAtMs(existing.newest.partyCreatedAt)) {
      existing.newest = row;
    }
  }

  const summaries: PartyContactSummary[] = [];
  for (const group of byPhone.values()) {
    const displayName = group.newest.name.trim();
    const alternateNames = [...group.names]
      .filter((name) => name.length > 0 && name !== displayName)
      .sort((a, b) => a.localeCompare(b));
    const agreements = [...group.agreements.values()].sort((a, b) => {
      const left = a.propertyAddress ?? "";
      const right = b.propertyAddress ?? "";
      return left.localeCompare(right) || a.agreementId.localeCompare(b.agreementId);
    });

    summaries.push({
      name: displayName,
      phone: group.newest.phone,
      email: group.newest.email,
      address: group.newest.address,
      role: group.newest.role,
      alternateNames,
      agreementCount: agreements.length,
      agreements,
    });
  }

  return summaries.sort((a, b) => a.name.localeCompare(b.name) || a.phone.localeCompare(b.phone));
}

function requestAuthorization(req: VercelRequest): string | undefined {
  const header = req.headers.authorization ?? req.headers.Authorization;
  if (Array.isArray(header)) return header[0];
  return header;
}

function queryRole(req: VercelRequest): string | undefined {
  const raw = req.query.role;
  if (Array.isArray(raw)) return raw[0];
  return typeof raw === "string" ? raw : undefined;
}

export async function handlePartiesRequest(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      json(res, 405, { error: "Method not allowed" });
      return;
    }

    const auth = await assertJwtUserAuth(requestAuthorization(req));
    if (!auth.ok) {
      json(res, auth.status, { error: auth.error });
      return;
    }

    const roleParsed = PartyRoleQuerySchema.safeParse(queryRole(req));
    if (!roleParsed.success) {
      json(res, 400, { error: "Query parameter role must be owner or tenant" });
      return;
    }
    const role = roleParsed.data;
    const userId = auth.user.userId;

    const result = await getPool().query<PartyContactSourceRow>(
      `SELECT
         ap.phone,
         ap.name,
         ap.email,
         ap.address,
         ap.role,
         ap.created_at AS "partyCreatedAt",
         la.id AS "agreementId",
         la.property_address AS "propertyAddress",
         la.status AS "status"
       FROM public.agreement_parties ap
       INNER JOIN public.lease_agreements la ON la.id = ap.agreement_id
       WHERE la.created_by_user_id = $1
         AND ap.role = $2
       ORDER BY ap.phone ASC, ap.created_at DESC`,
      [userId, role],
    );

    const parties = dedupePartyContactRows(
      result.rows.map((row) => ({
        ...row,
        role,
      })),
    );

    json(res, 200, { parties });
  } catch (err) {
    console.error("/api/v1/parties failed", sanitizeErrorForLog(err));
    json(res, 500, { error: "Internal server error" });
  }
}
