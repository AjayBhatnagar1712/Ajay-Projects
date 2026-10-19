/**
 * One-time backfill: user_data blobs → relational tables via BlobSyncAdapter.
 * Safe to re-run (idempotent upserts). Never modifies user_data.
 *
 * Usage:
 *   DATABASE_URL=<connection-string> npx tsx scripts/migrate-blobs-to-relational.ts [--mode=dry-run|staging|production] [--confirm=MIGRATE_PRODUCTION]
 */
import pg from "pg";

type Mode = "dry-run" | "staging" | "production";

type UserDataRow = {
  phone: string;
  role: string;
  data_key: string;
  value: string;
};

type RowOutcome = "ok" | "error" | "skipped" | "parse_error";

const RECOGNISED_KEYS = new Set([
  "profile",
  "properties",
  "tenants",
  "agreements",
  "owner_tenant_inquiries",
  "broker_property_inquiries",
  "owner_tenant_invites",
]);

const MONEY_FIELDS = [
  "monthlyRent",
  "securityDeposit",
  "monthlyMaintenance",
  "brokerageAmount",
  "maintenanceCharges",
] as const;

function parseArgs(): { mode: Mode; confirm?: string } {
  let mode: Mode = "dry-run";
  let confirm: string | undefined;

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--mode=")) {
      const raw = arg.slice("--mode=".length);
      if (raw === "dry-run" || raw === "staging" || raw === "production") {
        mode = raw;
      } else {
        console.error(`Unknown mode: ${raw}`);
        process.exit(1);
      }
    } else if (arg.startsWith("--confirm=")) {
      confirm = arg.slice("--confirm=".length);
    }
  }

  return { mode, confirm };
}

function rowLabel(phone: string, role: string, dataKey: string): string {
  return `${phone}/${role}/${dataKey}`;
}

function isEmptyOrNonNumericMoney(value: unknown): boolean {
  if (value == null || value === "") return true;
  return Number.isNaN(parseFloat(String(value)));
}

function warnMoneyFields(item: Record<string, unknown>, context: string): void {
  for (const field of MONEY_FIELDS) {
    if (!(field in item)) continue;
    const value = item[field];
    if (isEmptyOrNonNumericMoney(value)) {
      console.log(`[WARN] ${context}: ${field} is non-numeric or empty (${String(value)})`);
    }
  }
}

function warnBase64Images(item: Record<string, unknown>, context: string): void {
  const images = item.images;
  if (!Array.isArray(images)) return;
  const base64Count = images.filter(
    (img) => typeof img === "string" && img.startsWith("data:"),
  ).length;
  if (base64Count > 0) {
    console.log(
      `[WARN] ${context}: ${base64Count} base64 image(s) in images array (will go to images_legacy)`,
    );
  }
}

function warnAgreementCustomText(item: Record<string, unknown>, context: string): void {
  const customText = item.customText;
  if (customText == null || customText === "") return;
  if (typeof customText !== "string") return;
  try {
    JSON.parse(customText);
  } catch {
    console.log(
      `[WARN] ${context}: customText present but fails JSON parse (will be stored as plain agreement_text)`,
    );
  }
}

function dryRunDescribe(
  phone: string,
  role: string,
  dataKey: string,
  value: string,
): RowOutcome {
  const label = rowLabel(phone, role, dataKey);

  if (!RECOGNISED_KEYS.has(dataKey)) {
    console.log(`[DRY RUN] ${label} → skipped (unrecognised key)`);
    return "skipped";
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`[DRY RUN] ${label} → parse error: ${message}`);
    return "parse_error";
  }

  const context = label;

  switch (dataKey) {
    case "profile": {
      if (typeof parsed !== "object" || parsed === null) {
        console.log(`[DRY RUN] ${label} → parse error: profile value is not an object`);
        return "parse_error";
      }
      console.log(
        `[DRY RUN] ${label} → would write 1 record to profiles and 1 record to payment_accounts`,
      );
      return "ok";
    }
    case "properties": {
      if (!Array.isArray(parsed)) {
        console.log(`[DRY RUN] ${label} → parse error: properties value is not an array`);
        return "parse_error";
      }
      let coOwnerCount = 0;
      for (const item of parsed) {
        if (typeof item !== "object" || item === null) continue;
        const record = item as Record<string, unknown>;
        warnMoneyFields(record, context);
        warnBase64Images(record, context);
        const coOwners = record.coOwners;
        if (Array.isArray(coOwners)) coOwnerCount += coOwners.length;
      }
      console.log(
        `[DRY RUN] ${label} → would write ${parsed.length} record(s) to properties and ${coOwnerCount} record(s) to property_co_owners`,
      );
      return "ok";
    }
    case "tenants": {
      if (!Array.isArray(parsed)) {
        console.log(`[DRY RUN] ${label} → parse error: tenants value is not an array`);
        return "parse_error";
      }
      console.log(`[DRY RUN] ${label} → would write ${parsed.length} record(s) to tenants`);
      return "ok";
    }
    case "agreements": {
      if (!Array.isArray(parsed)) {
        console.log(`[DRY RUN] ${label} → parse error: agreements value is not an array`);
        return "parse_error";
      }
      for (const item of parsed) {
        if (typeof item !== "object" || item === null) continue;
        const record = item as Record<string, unknown>;
        warnMoneyFields(record, context);
        warnAgreementCustomText(record, context);
      }
      console.log(`[DRY RUN] ${label} → would write ${parsed.length} record(s) to agreements`);
      return "ok";
    }
    case "owner_tenant_inquiries":
    case "broker_property_inquiries": {
      if (!Array.isArray(parsed)) {
        console.log(`[DRY RUN] ${label} → parse error: inquiries value is not an array`);
        return "parse_error";
      }
      for (const item of parsed) {
        if (typeof item !== "object" || item === null) continue;
        warnMoneyFields(item as Record<string, unknown>, context);
      }
      console.log(
        `[DRY RUN] ${label} → would write ${parsed.length} record(s) to property_inquiries`,
      );
      return "ok";
    }
    case "owner_tenant_invites": {
      if (!Array.isArray(parsed)) {
        console.log(`[DRY RUN] ${label} → parse error: invites value is not an array`);
        return "parse_error";
      }
      for (const item of parsed) {
        if (typeof item !== "object" || item === null) continue;
        warnMoneyFields(item as Record<string, unknown>, context);
      }
      console.log(
        `[DRY RUN] ${label} → would write ${parsed.length} record(s) to property_invites`,
      );
      return "ok";
    }
    default:
      console.log(`[DRY RUN] ${label} → skipped (unrecognised key)`);
      return "skipped";
  }
}

async function fetchUserDataRows(pool: pg.Pool): Promise<UserDataRow[]> {
  const result = await pool.query<UserDataRow>(
    `SELECT phone, role, data_key, value FROM public.user_data ORDER BY phone, role, data_key`,
  );
  return result.rows;
}

async function main(): Promise<void> {
  const { mode, confirm } = parseArgs();

  if (mode === "production" && confirm !== "MIGRATE_PRODUCTION") {
    console.error(
      "Production migration requires --confirm=MIGRATE_PRODUCTION. Aborting without changes.",
    );
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || connectionString === "local" || connectionString === "pglite") {
    console.error("DATABASE_URL must be set to a Postgres connection string.");
    process.exit(1);
  }

  console.log(`Mode: ${mode}`);
  console.log(`Reading from: ${connectionString.replace(/:([^:@/]+)@/, ":***@")}`);

  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const rows = await fetchUserDataRows(pool);
  await pool.end();

  console.log(`Found ${rows.length} user_data row(s)\n`);

  const adaptBlobWrite =
    mode === "dry-run"
      ? null
      : (await import("../api/_lib/blobSyncAdapter.js")).adaptBlobWrite;

  const summary = {
    total: rows.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  };

  for (const row of rows) {
    const { phone, role, data_key: dataKey, value } = row;
    const label = rowLabel(phone, role, dataKey);

    if (mode === "dry-run") {
      const outcome = dryRunDescribe(phone, role, dataKey, value);
      if (outcome === "ok") summary.succeeded += 1;
      else if (outcome === "skipped") summary.skipped += 1;
      else summary.failed += 1;
      continue;
    }

    const result = await adaptBlobWrite!(phone, role, dataKey, value);

    if (result.status === "ok") {
      console.log(`[${label}] → ok`);
      summary.succeeded += 1;
    } else if (result.status === "skipped") {
      console.log(`[${label}] → skipped (unrecognised key)`);
      summary.skipped += 1;
    } else {
      console.log(`[${label}] → error: ${result.message}`);
      summary.failed += 1;
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Total rows:  ${summary.total}`);
  console.log(`Succeeded:   ${summary.succeeded}`);
  console.log(`Failed:      ${summary.failed}`);
  console.log(`Skipped:     ${summary.skipped}`);
}

main().catch((err) => {
  console.error("Migration script failed:", err);
  process.exit(1);
});
