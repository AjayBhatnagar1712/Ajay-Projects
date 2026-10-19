import pg from "pg";
import { adaptBlobWrite } from "./blobSyncAdapter.js";

const { Pool } = pg;

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function resolvePostgresUrl(): string | undefined {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.VERCEL_POSTGRES_URL;
  if (!url || url === "local" || url === "pglite" || url === "mock") return undefined;
  return url;
}

/** True when Vercel should use direct pg (avoids bundling drizzle/pglite from @workspace/db). */
export function usePostgres(): boolean {
  if (process.env.USE_MOCK_DB === "1") return false;
  return !!resolvePostgresUrl();
}

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  const connectionString = resolvePostgresUrl();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      // max:1 — serverless functions fan out across many instances; keep per-instance pool minimal and rely on Supabase's transaction pooler for multiplexing.
      max: 1,
    });
  }
  return pool;
}

export async function accountHasProfile(phone: string, role: string): Promise<boolean> {
  const p = normalizePhone(phone);
  if (role === "tenant") {
    const result = await getPool().query<{ ok: number }>(
      `SELECT 1 AS ok FROM user_data
       WHERE phone = $1 AND role = 'tenant'
         AND data_key IN ('profile', 'tenant_workspace')
       LIMIT 1`,
      [p],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }
  const result = await getPool().query<{ ok: number }>(
    `SELECT 1 AS ok FROM user_data
     WHERE phone = $1 AND role = $2 AND data_key = 'profile'
     LIMIT 1`,
    [p, role],
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function getAccountData(
  phone: string,
  role: string,
): Promise<Record<string, string>> {
  const p = normalizePhone(phone);
  const result = await getPool().query<{ data_key: string; value: string }>(
    `SELECT data_key, value FROM user_data WHERE phone = $1 AND role = $2`,
    [p, role],
  );
  const out: Record<string, string> = {};
  for (const row of result.rows) out[row.data_key] = row.value;
  return out;
}

export async function getRolesForPhone(phone: string): Promise<string[]> {
  const p = normalizePhone(phone);
  const e164Candidates = phoneVariantsForPartyMatch(p);
  const result = await getPool().query<{ role: string }>(
    `SELECT DISTINCT role FROM (
       SELECT role FROM user_data
       WHERE phone = $1 AND (
         data_key = 'profile'
         OR (role = 'tenant' AND data_key = 'tenant_workspace')
       )
       UNION
       SELECT ap.role
       FROM agreement_parties ap
       WHERE ap.phone = ANY($2::text[])
         AND ap.role IN ('owner', 'tenant')
     ) roles`,
    [p, e164Candidates],
  );
  return result.rows.map((r: { role: string }) => r.role).filter(Boolean);
}

/** Match JWT 10-digit phone to agreement_parties E.164 storage. */
export function phoneVariantsForPartyMatch(phone10: string): string[] {
  const digits = normalizePhone(phone10);
  if (digits.length !== 10) return [phone10];
  return Array.from(new Set([digits, `+91${digits}`, `91${digits}`]));
}

export async function getAccountSummariesForPhone(
  phone: string,
): Promise<Array<{ role: string; displayName: string }>> {
  const p = normalizePhone(phone);
  const result = await getPool().query<{ role: string; value: string }>(
    `SELECT role, value FROM user_data
     WHERE phone = $1 AND data_key = 'profile'`,
    [p],
  );

  return result.rows.map((row) => {
    let displayName = "";
    try {
      const parsed = JSON.parse(row.value) as { name?: string };
      displayName = parsed.name?.trim() ?? "";
    } catch {
      /* ignore malformed profile */
    }
    return { role: row.role, displayName };
  });
}

export async function setAccountDataKey(
  phone: string,
  role: string,
  dataKey: string,
  value: string,
): Promise<void> {
  const p = normalizePhone(phone);
  await getPool().query(
    `INSERT INTO user_data (phone, role, data_key, value, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (phone, role, data_key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [p, role, dataKey, value],
  );
  void adaptBlobWrite(p, role, dataKey, value);
}

export async function setAccountDataBulk(
  phone: string,
  role: string,
  entries: Record<string, string>,
): Promise<void> {
  for (const [dataKey, value] of Object.entries(entries)) {
    if (typeof value === "string") await setAccountDataKey(phone, role, dataKey, value);
  }
}

/** Run a parameterized SQL query against the shared Postgres pool. */
export async function queryRows<T extends pg.QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params);
  return result.rows;
}
