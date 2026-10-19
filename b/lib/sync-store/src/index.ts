import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  isMockDbEnabled,
  readMockStore,
  writeMockStore,
} from "./mockStore.js";

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "trustkeyper-data")
  : path.join(process.cwd(), ".data");
const FILE_PATH = path.join(DATA_DIR, "user_data.json");
const BLOB_PATHNAME = "trustkeyper-user-data.json";

type FileStore = Record<string, Record<string, string>>;

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-10);
}

function accountId(phone: string, role: string): string {
  return `${normalizePhone(phone)}:${role}`;
}

// Lazy-load potentially server-only modules to avoid bundlers pulling them
// into browser builds. Returns an object with any exported helpers we need.
let dbHelpersCache: any = null;
async function loadDbHelpers() {
  if (dbHelpersCache !== null) return dbHelpersCache;
  try {
    let dbMod: any = {};
    let clientMod: any = {};
    try {
      dbMod = await import("@workspace/db");
    } catch {
      dbMod = {};
    }
    try {
      clientMod = await import("@workspace/db/client");
    } catch {
      clientMod = {};
    }

    dbHelpersCache = {
      queryAccountData: dbMod.queryAccountData,
      queryEntryByDataKey: dbMod.queryEntryByDataKey,
      queryRolesWithProfileForPhone: dbMod.queryRolesWithProfileForPhone,
      upsertAccountDataKey: dbMod.upsertAccountDataKey,
      getDb: clientMod.getDb,
      ensureDbReady: clientMod.ensureDbReady,
    };
  } catch {
    dbHelpersCache = {};
  }
  return dbHelpersCache;
}

async function readBlobStore(): Promise<FileStore | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  try {
    const blobMod = await import("@vercel/blob").catch(() => null);
    if (!blobMod) return {};
    const meta = await blobMod.head(BLOB_PATHNAME, { token });
    const res = (await fetch(meta.url)) as {
      status: number;
      json(): Promise<unknown>;
    };
    if (res.status < 200 || res.status >= 300) return {};
    return (await res.json()) as FileStore;
  } catch {
    return {};
  }
}

async function writeBlobStore(store: FileStore): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;
  const blobMod = await import("@vercel/blob").catch(() => null);
  if (!blobMod) return;
  await blobMod.put(BLOB_PATHNAME, JSON.stringify(store), {
    access: "public",
    token,
    addRandomSuffix: false,
  });
}

async function readFileStore(): Promise<FileStore> {
  const blob = await readBlobStore();
  if (blob !== null) return blob;

  try {
    const raw = await readFile(FILE_PATH, "utf8");
    return JSON.parse(raw) as FileStore;
  } catch {
    return {};
  }
}

async function writeFileStore(store: FileStore): Promise<void> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await writeBlobStore(store);
    return;
  }
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FILE_PATH, JSON.stringify(store), "utf8");
}

export async function getAccountData(
  phone: string,
  role: string,
): Promise<Record<string, string>> {
  const p = normalizePhone(phone);
  if (isMockDbEnabled()) {
    const mock = await readMockStore();
    return mock[accountId(p, role)] ?? {};
  }

  const db = await loadDbHelpers();
  if (db.getDb && db.getDb()) {
    try {
      if (db.ensureDbReady) await db.ensureDbReady();
      return db.queryAccountData ? await db.queryAccountData(p, role) : {};
    } catch {
      /* fall through to file / blob store */
    }
  }

  const store = await readFileStore();
  return store[accountId(p, role)] ?? {};
}

export async function accountHasProfile(phone: string, role: string): Promise<boolean> {
  const data = await getAccountData(phone, role);
  if (typeof data.profile === "string" && data.profile.length > 0) return true;
  if (role === "tenant" && typeof data.tenant_workspace === "string" && data.tenant_workspace.length > 0) {
    return true;
  }
  return false;
}

export async function setAccountDataKey(
  phone: string,
  role: string,
  dataKey: string,
  value: string,
): Promise<void> {
  const p = normalizePhone(phone);
  if (isMockDbEnabled()) {
    const mock = await readMockStore();
    const id = accountId(p, role);
    if (!mock[id]) mock[id] = {};
    mock[id][dataKey] = value;
    await writeMockStore(mock);
    return;
  }

  const db = await loadDbHelpers();
  if (db.getDb && db.getDb()) {
    try {
      if (db.ensureDbReady) await db.ensureDbReady();
      if (db.upsertAccountDataKey) await db.upsertAccountDataKey(p, role, dataKey, value);
      return;
    } catch {
      /* fall through to file / blob store */
    }
  }

  const store = await readFileStore();
  const id = accountId(p, role);
  if (!store[id]) store[id] = {};
  store[id][dataKey] = value;
  await writeFileStore(store);
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

export interface AccountRoleSummary {
  role: string;
  displayName: string;
}

export async function getAccountSummariesForPhone(phone: string): Promise<AccountRoleSummary[]> {
  const roles = await getRolesForPhone(phone);
  const summaries: AccountRoleSummary[] = [];

  for (const role of roles) {
    const data = await getAccountData(phone, role);
    let displayName = "";
    if (typeof data.profile === "string" && data.profile.length > 0) {
      try {
        const parsed = JSON.parse(data.profile) as { name?: string };
        displayName = parsed.name?.trim() ?? "";
      } catch {
        /* ignore malformed profile */
      }
    }
    summaries.push({ role, displayName });
  }

  return summaries;
}

export async function getRolesForPhone(phone: string): Promise<string[]> {
  const p = normalizePhone(phone);
  if (isMockDbEnabled()) {
    const mock = await readMockStore();
    const roles: string[] = [];
    for (const [key, data] of Object.entries(mock) as [string, Record<string, string>][]) {
      if (!key.startsWith(`${p}:`)) continue;
      if (data.profile) roles.push(key.split(":")[1] ?? "");
    }
    return roles.filter(Boolean);
  }

  const db = await loadDbHelpers();
  if (db.getDb && db.getDb()) {
    try {
      if (db.ensureDbReady) await db.ensureDbReady();
      return db.queryRolesWithProfileForPhone ? await db.queryRolesWithProfileForPhone(p) : [];
    } catch {
      /* fall through */
    }
  }

  const store = await readFileStore();
  const roles: string[] = [];
  for (const [key, data] of Object.entries(store) as [string, Record<string, string>][]) {
    if (!key.startsWith(`${p}:`)) continue;
    if (data.profile) roles.push(key.split(":")[1] ?? "");
  }
  return roles.filter(Boolean);
}

export async function findEntryByDataKey(
  dataKey: string,
): Promise<{ phone: string; role: string; value: string } | null> {
  if (isMockDbEnabled()) {
    const mock = await readMockStore();
    for (const [id, data] of Object.entries(mock) as [string, Record<string, string>][]) {
      const value = data[dataKey];
      if (!value) continue;
      const [phone, role] = id.split(":");
      if (!phone || !role) continue;
      return { phone, role, value };
    }
    return null;
  }

  const db = await loadDbHelpers();
  if (db.getDb && db.getDb()) {
    try {
      if (db.ensureDbReady) await db.ensureDbReady();
      if (db.queryEntryByDataKey) {
        const row = await db.queryEntryByDataKey(dataKey);
        if (row) return row;
      }
    } catch {
      /* fall through to file / blob store */
    }
  }

  const store = await readFileStore();
  for (const [id, data] of Object.entries(store) as [string, Record<string, string>][]) {
    const value = data[dataKey];
    if (!value) continue;
    const [phone, role] = id.split(":");
    if (!phone || !role) continue;
    return { phone, role, value };
  }

  return null;
}
