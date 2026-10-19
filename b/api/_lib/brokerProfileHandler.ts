/**
 * GET/PATCH /api/v1/broker/profile — JWT-scoped broker onboarding profile.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  BrokerProfilePatchSchema,
  type BrokerProfile,
  type BrokerProfilePatch,
} from "./brokerProfileSchemas.js";
import { json, readJsonBody } from "./http.js";
import { sanitizeErrorForLog } from "./sanitizeErrorForLog.js";
import { assertJwtUserAuth } from "./syncAuth.js";
import { getPool } from "./vercelSyncDb.js";

type BrokerRow = {
  id: string;
  user_id: string;
  name: string;
  age: number | null;
  firm_name: string | null;
  employment_type: string;
  business_since_year: number | null;
  properties_handled: number | null;
  deals_with: string[] | null;
  deals_with_other: string | null;
  property_types: string[] | null;
  property_types_other: string | null;
  region: string;
  pincodes: string[] | null;
  step_completed: number;
  onboarding_completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function requestAuthorization(req: VercelRequest): string | undefined {
  const header = req.headers.authorization ?? req.headers.Authorization;
  if (Array.isArray(header)) return header[0];
  return header;
}

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function toIsoOrNull(value: Date | string | null): string | null {
  if (value === null) return null;
  return toIso(value);
}

export function mapBrokerRowToProfile(row: BrokerRow): BrokerProfile {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    age: row.age,
    firmName: row.firm_name,
    employmentType: row.employment_type,
    businessSinceYear: row.business_since_year,
    propertiesHandled: row.properties_handled,
    dealsWith: row.deals_with ?? [],
    dealsWithOther: row.deals_with_other,
    propertyTypes: row.property_types ?? [],
    propertyTypesOther: row.property_types_other,
    region: row.region,
    pincodes: row.pincodes ?? [],
    stepCompleted: row.step_completed,
    onboardingCompletedAt: toIsoOrNull(row.onboarding_completed_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

async function selectBrokerByUserId(userId: string): Promise<BrokerRow | null> {
  const pool = getPool();
  const result = await pool.query<BrokerRow>(
    `SELECT
      id, user_id, name, age, firm_name, employment_type,
      business_since_year, properties_handled,
      deals_with, deals_with_other, property_types, property_types_other,
      region, pincodes, step_completed, onboarding_completed_at,
      created_at, updated_at
    FROM public.brokers
    WHERE user_id = $1
    LIMIT 1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

async function upsertBrokerProfile(
  userId: string,
  patch: BrokerProfilePatch,
): Promise<BrokerRow> {
  const pool = getPool();
  const existing = await selectBrokerByUserId(userId);
  const completeOnboarding = patch.stepCompleted === 4;

  if (!existing) {
    const inserted = await pool.query<BrokerRow>(
      `INSERT INTO public.brokers (
        user_id,
        name,
        age,
        firm_name,
        employment_type,
        business_since_year,
        properties_handled,
        deals_with,
        deals_with_other,
        property_types,
        property_types_other,
        region,
        pincodes,
        step_completed,
        onboarding_completed_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        CASE WHEN $15 THEN now() ELSE NULL END
      )
      RETURNING
        id, user_id, name, age, firm_name, employment_type,
        business_since_year, properties_handled,
        deals_with, deals_with_other, property_types, property_types_other,
        region, pincodes, step_completed, onboarding_completed_at,
        created_at, updated_at`,
      [
        userId,
        patch.name ?? "",
        patch.age ?? null,
        patch.firmName ?? null,
        patch.employmentType ?? "",
        patch.businessSinceYear ?? null,
        patch.propertiesHandled ?? null,
        patch.dealsWith ?? [],
        patch.dealsWithOther ?? null,
        patch.propertyTypes ?? [],
        patch.propertyTypesOther ?? null,
        patch.region ?? "",
        patch.pincodes ?? [],
        patch.stepCompleted,
        completeOnboarding,
      ],
    );
    const row = inserted.rows[0];
    if (!row) {
      throw new Error("Failed to insert broker profile");
    }
    return row;
  }

  const updated = await pool.query<BrokerRow>(
    `UPDATE public.brokers SET
      name = COALESCE($2, name),
      age = COALESCE($3, age),
      firm_name = CASE WHEN $4::boolean THEN $5 ELSE firm_name END,
      employment_type = COALESCE($6, employment_type),
      business_since_year = COALESCE($7, business_since_year),
      properties_handled = COALESCE($8, properties_handled),
      deals_with = COALESCE($9, deals_with),
      deals_with_other = CASE WHEN $10::boolean THEN $11 ELSE deals_with_other END,
      property_types = COALESCE($12, property_types),
      property_types_other = CASE WHEN $13::boolean THEN $14 ELSE property_types_other END,
      region = COALESCE($15, region),
      pincodes = COALESCE($16, pincodes),
      step_completed = $17,
      onboarding_completed_at = CASE
        WHEN $18::boolean THEN COALESCE(onboarding_completed_at, now())
        ELSE onboarding_completed_at
      END,
      updated_at = now()
    WHERE user_id = $1
    RETURNING
      id, user_id, name, age, firm_name, employment_type,
      business_since_year, properties_handled,
      deals_with, deals_with_other, property_types, property_types_other,
      region, pincodes, step_completed, onboarding_completed_at,
      created_at, updated_at`,
    [
      userId,
      patch.name ?? null,
      patch.age ?? null,
      patch.firmName !== undefined,
      patch.firmName ?? null,
      patch.employmentType ?? null,
      patch.businessSinceYear ?? null,
      patch.propertiesHandled ?? null,
      patch.dealsWith ?? null,
      patch.dealsWithOther !== undefined,
      patch.dealsWithOther ?? null,
      patch.propertyTypes ?? null,
      patch.propertyTypesOther !== undefined,
      patch.propertyTypesOther ?? null,
      patch.region ?? null,
      patch.pincodes ?? null,
      patch.stepCompleted,
      completeOnboarding,
    ],
  );
  const row = updated.rows[0];
  if (!row) {
    throw new Error("Failed to update broker profile");
  }
  return row;
}

export async function handleBrokerProfileRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const auth = await assertJwtUserAuth(requestAuthorization(req));
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  const method = req.method?.toUpperCase();

  if (method === "GET") {
    try {
      const row = await selectBrokerByUserId(auth.user.userId);
      if (!row) {
        json(res, 404, { error: "Broker profile not found" });
        return;
      }
      json(res, 200, mapBrokerRowToProfile(row));
    } catch (err) {
      console.error("GET /api/v1/broker/profile failed", sanitizeErrorForLog(err));
      json(res, 500, { error: "Internal server error" });
    }
    return;
  }

  if (method === "PATCH") {
    const body = BrokerProfilePatchSchema.safeParse(readJsonBody(req));
    if (!body.success) {
      json(res, 400, { error: body.error.issues });
      return;
    }

    try {
      const row = await upsertBrokerProfile(auth.user.userId, body.data);
      json(res, 200, mapBrokerRowToProfile(row));
    } catch (err) {
      console.error("PATCH /api/v1/broker/profile failed", sanitizeErrorForLog(err));
      json(res, 500, { error: "Internal server error" });
    }
    return;
  }

  json(res, 405, { error: "Method not allowed" });
}
