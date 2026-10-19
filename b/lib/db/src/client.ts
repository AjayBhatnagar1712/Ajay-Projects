import path from "node:path";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import pg from "pg";
import { ensureTenantInvitationsTable, ensureUserDataTable } from "./ensureSchema.js";
import * as schema from "./schema/index.js";

const { Pool } = pg;

type DbInstance = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

let pool: pg.Pool | null = null;
let dbInstance: DbInstance | null = null;
let pgliteClient: { close: () => Promise<void> } | null = null;
let initPromise: Promise<void> | null = null;

export function isEmbeddedLocalDb(): boolean {
  const url = process.env.DATABASE_URL;
  return url === "local" || url === "pglite" || process.env.USE_PGLITE === "1";
}

export function pgliteDataDir(): string {
  if (process.env.PGLITE_DATA_DIR) {
    return path.isAbsolute(process.env.PGLITE_DATA_DIR)
      ? process.env.PGLITE_DATA_DIR
      : path.resolve(process.cwd(), process.env.PGLITE_DATA_DIR);
  }
  // api-server cwd is artifacts/api-server; monorepo root is two levels up
  return path.resolve(process.cwd(), "../../.data/pglite");
}

function resolvePostgresUrl(): string | undefined {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.VERCEL_POSTGRES_URL;

  if (!url || url === "local" || url === "pglite") return undefined;
  return url;
}

async function initEmbeddedDb(): Promise<void> {
  if (dbInstance) return;
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite(pgliteDataDir());
  await ensureUserDataTable((sql: string) => client.exec(sql));
  await ensureTenantInvitationsTable((sql: string) => client.exec(sql));
  pgliteClient = client;
  dbInstance = drizzle({ client, schema });
}

function initPostgresPool(): void {
  const connectionString = resolvePostgresUrl();
  if (!connectionString || dbInstance) return;
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  dbInstance = drizzlePg(pool, { schema });
}

/** Call once before handling API traffic (starts embedded Postgres when DATABASE_URL=local). */
export async function ensureDbReady(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (isEmbeddedLocalDb()) {
      await initEmbeddedDb();
    } else {
      initPostgresPool();
    }
  })();
  return initPromise;
}

export function getDb(): DbInstance | null {
  if (isEmbeddedLocalDb()) {
    return dbInstance;
  }
  const connectionString = resolvePostgresUrl();
  if (!connectionString) return null;
  if (!dbInstance) initPostgresPool();
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
  if (pgliteClient) {
    await pgliteClient.close();
    pgliteClient = null;
  }
  dbInstance = null;
  initPromise = null;
}
