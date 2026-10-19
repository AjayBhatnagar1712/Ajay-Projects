import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { normalizePhone } from "@workspace/sync-store";

const { Pool } = pg;

export type InvitationStatus = "pending" | "accepted" | "declined" | "expired";

export type TenantInvitationRecord = {
  id: string;
  token: string;
  ownerPhone: string;
  ownerName: string;
  propertyId: string;
  propertyLabel: string;
  tenantName: string;
  tenantPhone: string;
  monthlyRent: string;
  maintenanceIncluded: boolean;
  monthlyMaintenance: string;
  securityDeposit: string;
  startDate: string;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  createdAt: string;
};

export type CreateInvitationInput = {
  ownerPhone: string;
  ownerName: string;
  propertyId: string;
  propertyLabel: string;
  tenantName: string;
  tenantPhone: string;
  monthlyRent: string;
  maintenanceIncluded: boolean;
  monthlyMaintenance: string;
  securityDeposit: string;
  startDate: string;
  expiresAt: Date;
};

function resolveDataDir(): string {
  if (process.env.VERCEL) return path.join("/tmp", "trustkeyper-data");
  const cwd = process.cwd().replace(/\\/g, "/");
  if (cwd.includes("/artifacts/api-server")) {
    return path.resolve(process.cwd(), "../../.data");
  }
  return path.join(process.cwd(), ".data");
}

const DATA_DIR = resolveDataDir();
const FILE_PATH = path.join(DATA_DIR, "tenant_invitations.json");

type FileInvitationStore = Record<string, TenantInvitationRecord>;

function resolvePostgresUrl(): string | undefined {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.VERCEL_POSTGRES_URL;
  if (!url || url === "local" || url === "pglite" || url === "mock") return undefined;
  return url;
}

export function useInvitationPostgres(): boolean {
  if (process.env.USE_MOCK_DB === "1") return false;
  return !!resolvePostgresUrl();
}

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  const connectionString = resolvePostgresUrl();
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 3,
    });
  }
  return pool;
}

function rowToRecord(row: Record<string, unknown>): TenantInvitationRecord {
  return {
    id: String(row.id),
    token: String(row.token),
    ownerPhone: String(row.owner_phone),
    ownerName: String(row.owner_name),
    propertyId: String(row.property_id),
    propertyLabel: String(row.property_label),
    tenantName: String(row.tenant_name),
    tenantPhone: String(row.tenant_phone),
    monthlyRent: String(row.monthly_rent ?? ""),
    maintenanceIncluded: Boolean(row.maintenance_included),
    monthlyMaintenance: String(row.monthly_maintenance ?? ""),
    securityDeposit: String(row.security_deposit ?? ""),
    startDate: String(row.start_date ?? ""),
    status: String(row.status) as InvitationStatus,
    expiresAt: new Date(String(row.expires_at)).toISOString(),
    acceptedAt: row.accepted_at ? new Date(String(row.accepted_at)).toISOString() : null,
    declinedAt: row.declined_at ? new Date(String(row.declined_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function effectiveStatus(record: TenantInvitationRecord): InvitationStatus {
  if (record.status !== "pending") return record.status;
  if (new Date(record.expiresAt).getTime() < Date.now()) return "expired";
  return "pending";
}

function withEffectiveStatus(record: TenantInvitationRecord): TenantInvitationRecord {
  const status = effectiveStatus(record);
  return status === record.status ? record : { ...record, status };
}

async function readFileStore(): Promise<FileInvitationStore> {
  try {
    const raw = await readFile(FILE_PATH, "utf8");
    return JSON.parse(raw) as FileInvitationStore;
  } catch {
    return {};
  }
}

async function writeFileStore(store: FileInvitationStore): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FILE_PATH, JSON.stringify(store), "utf8");
}

export function generateInviteToken(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `inv_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export async function createInvitation(
  input: CreateInvitationInput,
): Promise<TenantInvitationRecord> {
  const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const token = generateInviteToken();
  const ownerPhone = normalizePhone(input.ownerPhone);

  if (useInvitationPostgres()) {
    const result = await getPool().query(
      `INSERT INTO tenant_invitations (
        id, token, owner_phone, owner_name, property_id, property_label,
        tenant_name, tenant_phone, monthly_rent, maintenance_included,
        monthly_maintenance, security_deposit, start_date, status, expires_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',$14)
      RETURNING *`,
      [
        id,
        token,
        ownerPhone,
        input.ownerName,
        input.propertyId,
        input.propertyLabel,
        input.tenantName,
        input.tenantPhone,
        input.monthlyRent,
        input.maintenanceIncluded,
        input.monthlyMaintenance,
        input.securityDeposit,
        input.startDate,
        input.expiresAt.toISOString(),
      ],
    );
    return withEffectiveStatus(rowToRecord(result.rows[0] as Record<string, unknown>));
  }

  const store = await readFileStore();
  const record: TenantInvitationRecord = {
    id,
    token,
    ownerPhone,
    ownerName: input.ownerName,
    propertyId: input.propertyId,
    propertyLabel: input.propertyLabel,
    tenantName: input.tenantName,
    tenantPhone: input.tenantPhone,
    monthlyRent: input.monthlyRent,
    maintenanceIncluded: input.maintenanceIncluded,
    monthlyMaintenance: input.monthlyMaintenance,
    securityDeposit: input.securityDeposit,
    startDate: input.startDate,
    status: "pending",
    expiresAt: input.expiresAt.toISOString(),
    acceptedAt: null,
    declinedAt: null,
    createdAt: new Date().toISOString(),
  };
  store[token] = record;
  await writeFileStore(store);
  return record;
}

export async function listInvitationsForOwner(
  ownerPhone: string,
): Promise<TenantInvitationRecord[]> {
  const phone = normalizePhone(ownerPhone);
  if (useInvitationPostgres()) {
    const result = await getPool().query(
      `SELECT * FROM tenant_invitations WHERE owner_phone = $1 ORDER BY created_at DESC`,
      [phone],
    );
    return result.rows.map((r) =>
      withEffectiveStatus(rowToRecord(r as Record<string, unknown>)),
    );
  }
  const store = await readFileStore();
  return Object.values(store)
    .filter((r) => normalizePhone(r.ownerPhone) === phone)
    .map(withEffectiveStatus)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getInvitationByToken(
  token: string,
): Promise<TenantInvitationRecord | null> {
  if (!token.trim()) return null;
  if (useInvitationPostgres()) {
    const result = await getPool().query(
      `SELECT * FROM tenant_invitations WHERE token = $1 LIMIT 1`,
      [token],
    );
    if (!result.rowCount) return null;
    return withEffectiveStatus(rowToRecord(result.rows[0] as Record<string, unknown>));
  }
  const store = await readFileStore();
  const record = store[token];
  return record ? withEffectiveStatus(record) : null;
}

async function updateInvitationStatus(
  token: string,
  status: "accepted" | "declined",
): Promise<TenantInvitationRecord | null> {
  const existing = await getInvitationByToken(token);
  if (!existing) return null;
  if (existing.status !== "pending") return existing;

  const now = new Date().toISOString();
  if (useInvitationPostgres()) {
    const col = status === "accepted" ? "accepted_at" : "declined_at";
    const result = await getPool().query(
      `UPDATE tenant_invitations
       SET status = $2, ${col} = NOW(), updated_at = NOW()
       WHERE token = $1 AND status = 'pending'
       RETURNING *`,
      [token, status],
    );
    if (!result.rowCount) return existing;
    return withEffectiveStatus(rowToRecord(result.rows[0] as Record<string, unknown>));
  }

  const store = await readFileStore();
  const record = store[token];
  if (!record || record.status !== "pending") return existing;
  const updated: TenantInvitationRecord = {
    ...record,
    status,
    acceptedAt: status === "accepted" ? now : record.acceptedAt,
    declinedAt: status === "declined" ? now : record.declinedAt,
  };
  store[token] = updated;
  await writeFileStore(store);
  return withEffectiveStatus(updated);
}

export async function acceptInvitation(token: string): Promise<{
  record: TenantInvitationRecord | null;
  error?: "not_found" | "expired" | "already_final";
}> {
  const existing = await getInvitationByToken(token);
  if (!existing) return { record: null, error: "not_found" };
  if (existing.status === "accepted" || existing.status === "declined") {
    return { record: existing, error: "already_final" };
  }
  if (existing.status === "expired") return { record: existing, error: "expired" };
  const updated = await updateInvitationStatus(token, "accepted");
  return { record: updated };
}

export async function declineInvitation(token: string): Promise<{
  record: TenantInvitationRecord | null;
  error?: "not_found" | "expired" | "already_final";
}> {
  const existing = await getInvitationByToken(token);
  if (!existing) return { record: null, error: "not_found" };
  if (existing.status === "accepted" || existing.status === "declined") {
    return { record: existing, error: "already_final" };
  }
  if (existing.status === "expired") return { record: existing, error: "expired" };
  const updated = await updateInvitationStatus(token, "declined");
  return { record: updated };
}
