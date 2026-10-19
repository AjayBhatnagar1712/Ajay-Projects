import { PROTOTYPE_SEED } from "./prototypeSeedData.js";

type FileStore = Record<string, Record<string, string>>;

/** In-memory store for Vercel prototype / local trials (non-persistent across cold starts). */
let store: FileStore | null = null;

function cloneStore(source: FileStore): FileStore {
  const next: FileStore = {};
  for (const [accountKey, data] of Object.entries(source)) {
    next[accountKey] = { ...data };
  }
  return next;
}

export function isMockDbEnabled(): boolean {
  if (process.env.USE_MOCK_DB === "1" || process.env.DATABASE_URL === "mock") {
    return true;
  }
  if (process.env.VERCEL === "1") {
    const url =
      process.env.DATABASE_URL ??
      process.env.POSTGRES_URL ??
      process.env.VERCEL_POSTGRES_URL;
    const hasPostgres = !!(url && url !== "local" && url !== "pglite");
    const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
    if (!hasPostgres && !hasBlob) return true;
  }
  return false;
}

export async function ensureMockStore(): Promise<FileStore> {
  if (store) return store;
  store = cloneStore(PROTOTYPE_SEED);
  return store;
}

export async function readMockStore(): Promise<FileStore> {
  return ensureMockStore();
}

export async function writeMockStore(next: FileStore): Promise<void> {
  store = cloneStore(next);
}
