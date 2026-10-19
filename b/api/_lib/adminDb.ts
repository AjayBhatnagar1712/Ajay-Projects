/**
 * Admin portal Postgres queries — aggregates user_data for stats, users, and properties.
 */
import { queryRows, usePostgres } from "./vercelSyncDb.js";

/** Platform-wide statistics for the admin dashboard. */
export interface AdminStats {
  totalUsers: number;
  totalOwners: number;
  totalBrokers: number;
  totalProperties: number;
  newUsersThisWeek: number;
}

/** A registered user profile from user_data. */
export interface AdminUserRecord {
  phone: string;
  role: string;
  name: string;
  updatedAt: string;
}

/** A property flattened from a user_data properties blob. */
export interface AdminPropertyRecord {
  ownerPhone: string;
  address: string;
  type: string;
  status: string;
  updatedAt: string;
}

interface ProfileRow {
  phone: string;
  role: string;
  value: string;
  updated_at: Date;
}

interface PropertiesRow {
  phone: string;
  value: string;
  updated_at: Date;
}

interface CountRow {
  count: string;
}

interface PropertyCountRow {
  property_count: string;
}

function toIsoString(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function parseProfileName(value: string): string {
  try {
    const parsed = JSON.parse(value) as { name?: unknown };
    return typeof parsed.name === "string" ? parsed.name.trim() : "";
  } catch {
    return "";
  }
}

interface StoredProperty {
  address?: unknown;
  propertyType?: unknown;
  status?: unknown;
}

/**
 * Loads aggregate platform statistics from Postgres user_data.
 * @throws When Postgres is not configured.
 */
export async function fetchAdminStats(): Promise<AdminStats> {
  if (!usePostgres()) {
    throw new Error("DATABASE_URL is not configured");
  }

  const [totalUsersRow] = await queryRows<CountRow>(
    `SELECT COUNT(*)::text AS count FROM user_data WHERE data_key = 'profile'`,
  );
  const [totalOwnersRow] = await queryRows<CountRow>(
    `SELECT COUNT(*)::text AS count FROM user_data WHERE data_key = 'profile' AND role = 'owner'`,
  );
  const [totalBrokersRow] = await queryRows<CountRow>(
    `SELECT COUNT(*)::text AS count FROM user_data WHERE data_key = 'profile' AND role = 'broker'`,
  );
  const [newUsersRow] = await queryRows<CountRow>(
    `SELECT COUNT(*)::text AS count FROM user_data
     WHERE data_key = 'profile' AND updated_at >= NOW() - INTERVAL '7 days'`,
  );
  const [propertiesRow] = await queryRows<PropertyCountRow>(
    `SELECT COALESCE(SUM(
       CASE
         WHEN value IS NULL OR value = '' OR value = '[]' THEN 0
         WHEN jsonb_typeof(value::jsonb) = 'array' THEN jsonb_array_length(value::jsonb)
         ELSE 0
       END
     ), 0)::text AS property_count
     FROM user_data
     WHERE data_key = 'properties'`,
  );

  return {
    totalUsers: Number(totalUsersRow?.count ?? 0),
    totalOwners: Number(totalOwnersRow?.count ?? 0),
    totalBrokers: Number(totalBrokersRow?.count ?? 0),
    totalProperties: Number(propertiesRow?.property_count ?? 0),
    newUsersThisWeek: Number(newUsersRow?.count ?? 0),
  };
}

/**
 * Loads all user profiles from Postgres user_data.
 * @throws When Postgres is not configured.
 */
export async function fetchAdminUsers(): Promise<AdminUserRecord[]> {
  if (!usePostgres()) {
    throw new Error("DATABASE_URL is not configured");
  }

  const rows = await queryRows<ProfileRow>(
    `SELECT phone, role, value, updated_at
     FROM user_data
     WHERE data_key = 'profile'
     ORDER BY updated_at DESC`,
  );

  return rows.map((row) => ({
    phone: row.phone,
    role: row.role,
    name: parseProfileName(row.value),
    updatedAt: toIsoString(row.updated_at),
  }));
}

/**
 * Loads and flattens all properties from Postgres user_data properties blobs.
 * @throws When Postgres is not configured.
 */
export async function fetchAdminProperties(): Promise<AdminPropertyRecord[]> {
  if (!usePostgres()) {
    throw new Error("DATABASE_URL is not configured");
  }

  const rows = await queryRows<PropertiesRow>(
    `SELECT phone, value, updated_at
     FROM user_data
     WHERE data_key = 'properties'
     ORDER BY updated_at DESC`,
  );

  const properties: AdminPropertyRecord[] = [];

  for (const row of rows) {
    let parsed: StoredProperty[] = [];
    try {
      const raw = JSON.parse(row.value) as unknown;
      if (Array.isArray(raw)) {
        parsed = raw as StoredProperty[];
      }
    } catch {
      continue;
    }

    const updatedAt = toIsoString(row.updated_at);

    for (const property of parsed) {
      properties.push({
        ownerPhone: row.phone,
        address: typeof property.address === "string" ? property.address : "",
        type: typeof property.propertyType === "string" ? property.propertyType : "",
        status: typeof property.status === "string" ? property.status : "",
        updatedAt,
      });
    }
  }

  return properties;
}

/** A feedback submission returned by GET /api/admin/feedback. */
export interface AdminFeedbackRecord {
  id: string;
  message: string;
  rating: number;
  category: string;
  userPhone: string | null;
  userRole: string | null;
  pageUrl: string | null;
  createdAt: string;
}

interface FeedbackRow {
  id: string;
  message: string;
  rating: number;
  category: string;
  user_phone: string | null;
  user_role: string | null;
  page_url: string | null;
  created_at: Date;
}

/**
 * Loads all feedback submissions ordered by newest first.
 * @throws When Postgres is not configured.
 */
export async function fetchAdminFeedback(): Promise<AdminFeedbackRecord[]> {
  if (!usePostgres()) {
    throw new Error("DATABASE_URL is not configured");
  }

  const rows = await queryRows<FeedbackRow>(
    `SELECT id, message, rating, category, user_phone, user_role, page_url, created_at
     FROM feedback
     ORDER BY created_at DESC`,
  );

  return rows.map((row) => ({
    id: row.id,
    message: row.message,
    rating: row.rating,
    category: row.category,
    userPhone: row.user_phone,
    userRole: row.user_role,
    pageUrl: row.page_url,
    createdAt: toIsoString(row.created_at),
  }));
}
