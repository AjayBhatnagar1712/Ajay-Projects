/**
 * Backfill property_id and tenant_id FKs left null after blob migration.
 * Safe to re-run — only updates rows with exactly one unambiguous match.
 *
 * Usage:
 *   DATABASE_URL=<connection-string> NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/backfill-foreign-keys.ts
 */
import pg from "pg";

type Counts = { updated: number; skipped: number };

type Summary = {
  agreementsPropertyId: Counts;
  agreementsTenantId: Counts;
  propertyInquiries: Counts;
  propertyInvites: Counts;
};

function phoneLast10(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
}

async function findMatchingPropertyIds(
  pool: pg.Pool,
  accountPhone: string,
  label: string,
): Promise<string[]> {
  const title = label.trim();
  if (!title) return [];

  const result = await pool.query<{ id: string }>(
    `SELECT id
     FROM public.properties
     WHERE account_phone = $1
       AND (
         id = $2
         OR trim(lower(coalesce(nickname, ''))) = trim(lower($2))
         OR trim(lower(coalesce(address, ''))) = trim(lower($2))
         OR (
           coalesce(nickname, '') <> ''
           AND trim(lower($2)) LIKE '%' || trim(lower(nickname)) || '%'
         )
         OR (
           coalesce(address, '') <> ''
           AND trim(lower($2)) LIKE '%' || trim(lower(address)) || '%'
         )
       )`,
    [accountPhone, title],
  );

  return result.rows.map((row) => row.id);
}

async function applyUniquePropertyMatch(
  pool: pg.Pool,
  table: "agreements" | "property_inquiries" | "property_invites",
  rowId: string,
  accountPhone: string,
  label: string,
  counts: Counts,
): Promise<void> {
  const matches = await findMatchingPropertyIds(pool, accountPhone, label);

  if (matches.length === 1) {
    const propertyId = matches[0];
    await pool.query(
      `UPDATE public.${table} SET property_id = $1 WHERE id = $2 AND property_id IS NULL`,
      [propertyId, rowId],
    );
    console.log(`[OK] ${table}/${rowId} property_id → ${propertyId}`);
    counts.updated += 1;
    return;
  }

  const reason =
    matches.length === 0
      ? `no unique property match for "${label}"`
      : `ambiguous property match (${matches.length}) for "${label}"`;
  const skipLabel =
    table === "agreements" ? `agreement ${rowId}` : `${table}/${rowId}`;
  console.log(`[SKIP] ${skipLabel} — ${reason}`);
  counts.skipped += 1;
}

async function passAgreementsPropertyId(pool: pg.Pool, counts: Counts): Promise<void> {
  console.log("\n=== Pass 1: agreements.property_id ===");

  const rows = await pool.query<{
    id: string;
    account_phone: string;
    property_title: string;
  }>(
    `SELECT id, account_phone, property_title
     FROM public.agreements
     WHERE property_id IS NULL
       AND coalesce(trim(property_title), '') <> ''
     ORDER BY id`,
  );

  for (const row of rows.rows) {
    await applyUniquePropertyMatch(
      pool,
      "agreements",
      row.id,
      row.account_phone,
      row.property_title,
      counts,
    );
  }
}

async function passAgreementsTenantId(pool: pg.Pool, counts: Counts): Promise<void> {
  console.log("\n=== Pass 2: agreements.tenant_id ===");

  const rows = await pool.query<{
    id: string;
    account_phone: string;
    tenant_contact: string;
  }>(
    `SELECT id, account_phone, tenant_contact
     FROM public.agreements
     WHERE tenant_id IS NULL
       AND coalesce(trim(tenant_contact), '') <> ''
     ORDER BY id`,
  );

  for (const row of rows.rows) {
    const digits = phoneLast10(row.tenant_contact);
    if (digits.length !== 10) {
      console.log(
        `[SKIP] agreement ${row.id} — no unique tenant match for "${row.tenant_contact}" (invalid phone)`,
      );
      counts.skipped += 1;
      continue;
    }

    const matches = await pool.query<{ id: string }>(
      `SELECT id
       FROM public.tenants
       WHERE account_phone = $1
         AND right(regexp_replace(phone, '\\D', '', 'g'), 10) = $2`,
      [row.account_phone, digits],
    );

    if (matches.rows.length === 1) {
      const tenantId = matches.rows[0].id;
      await pool.query(
        `UPDATE public.agreements SET tenant_id = $1 WHERE id = $2 AND tenant_id IS NULL`,
        [tenantId, row.id],
      );
      console.log(`[OK] agreements/${row.id} tenant_id → ${tenantId}`);
      counts.updated += 1;
    } else {
      const reason =
        matches.rows.length === 0
          ? `no unique tenant match for "${row.tenant_contact}"`
          : `ambiguous tenant match (${matches.rows.length}) for "${row.tenant_contact}"`;
      console.log(`[SKIP] agreement ${row.id} — ${reason}`);
      counts.skipped += 1;
    }
  }
}

async function passPropertyInquiries(pool: pg.Pool, counts: Counts): Promise<void> {
  console.log("\n=== Pass 3a: property_inquiries.property_id ===");

  const rows = await pool.query<{
    id: string;
    account_phone: string;
    property_label: string;
  }>(
    `SELECT id, account_phone, property_label
     FROM public.property_inquiries
     WHERE property_id IS NULL
     ORDER BY id`,
  );

  for (const row of rows.rows) {
    await applyUniquePropertyMatch(
      pool,
      "property_inquiries",
      row.id,
      row.account_phone,
      row.property_label,
      counts,
    );
  }
}

async function passPropertyInvites(pool: pg.Pool, counts: Counts): Promise<void> {
  console.log("\n=== Pass 3b: property_invites.property_id ===");

  const rows = await pool.query<{
    id: string;
    account_phone: string;
    property_label: string;
  }>(
    `SELECT id, account_phone, property_label
     FROM public.property_invites
     WHERE property_id IS NULL
     ORDER BY id`,
  );

  for (const row of rows.rows) {
    await applyUniquePropertyMatch(
      pool,
      "property_invites",
      row.id,
      row.account_phone,
      row.property_label,
      counts,
    );
  }
}

function printSummary(summary: Summary): void {
  console.log("\n--- Summary ---");
  console.log(
    `agreements.property_id: updated ${summary.agreementsPropertyId.updated}, skipped ${summary.agreementsPropertyId.skipped}`,
  );
  console.log(
    `agreements.tenant_id:   updated ${summary.agreementsTenantId.updated}, skipped ${summary.agreementsTenantId.skipped}`,
  );
  console.log(
    `property_inquiries:     updated ${summary.propertyInquiries.updated}, skipped ${summary.propertyInquiries.skipped}`,
  );
  console.log(
    `property_invites:       updated ${summary.propertyInvites.updated}, skipped ${summary.propertyInvites.skipped}`,
  );
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || connectionString === "local" || connectionString === "pglite") {
    console.error("DATABASE_URL must be set to a Postgres connection string.");
    process.exit(1);
  }

  console.log(`Reading from: ${connectionString.replace(/:([^:@/]+)@/, ":***@")}`);

  const pool = createPool(connectionString);

  const summary: Summary = {
    agreementsPropertyId: { updated: 0, skipped: 0 },
    agreementsTenantId: { updated: 0, skipped: 0 },
    propertyInquiries: { updated: 0, skipped: 0 },
    propertyInvites: { updated: 0, skipped: 0 },
  };

  try {
    await passAgreementsPropertyId(pool, summary.agreementsPropertyId);
    await passAgreementsTenantId(pool, summary.agreementsTenantId);
    await passPropertyInquiries(pool, summary.propertyInquiries);
    await passPropertyInvites(pool, summary.propertyInvites);
    printSummary(summary);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
