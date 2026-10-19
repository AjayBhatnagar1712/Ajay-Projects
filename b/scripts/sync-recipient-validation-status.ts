/**
 * One-off / ops: re-fetch Route product activation from Razorpay and mirror
 * into payment_recipient_config via syncRecipientValidationFromRazorpay.
 *
 * Run (staging only):
 *   DATABASE_URL=<staging-jvup…> RAZORPAY_KEY_ID=<test> RAZORPAY_KEY_SECRET=<test> \
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm exec tsx scripts/sync-recipient-validation-status.ts \
 *   [--phone=9000000021] [--role=owner]
 *
 * Default: syncs both 9000000020 and 9000000021 (owner).
 */
function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return value;
}

function assertStagingDatabase(url: string): void {
  if (!url.includes("jvupbmmzyxizjwjjfrac")) {
    console.error("Refusing to run: DATABASE_URL is not staging (jvupbmmzyxizjwjjfrac)");
    process.exit(1);
  }
}

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const DEFAULT_TARGETS: Array<{ phone: string; role: string }> = [
  { phone: "9000000020", role: "owner" },
  { phone: "9000000021", role: "owner" },
];

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  requireEnv("RAZORPAY_KEY_ID");
  requireEnv("RAZORPAY_KEY_SECRET");
  assertStagingDatabase(databaseUrl);

  const phoneArg = parseArg("phone");
  const roleArg = parseArg("role") ?? "owner";
  const targets = phoneArg
    ? [{ phone: phoneArg.replace(/\D/g, "").slice(-10), role: roleArg }]
    : DEFAULT_TARGETS;

  const { getPool } = await import("../api/_lib/vercelSyncDb.ts");
  const { syncRecipientValidationFromRazorpay } = await import(
    "../api/_lib/razorpayRouteHelpers.ts"
  );

  console.log("=== sync-recipient-validation-status ===");
  console.log("targets:", targets);

  for (const { phone, role } of targets) {
    const result = await getPool().query<{
      razorpay_linked_account_id: string | null;
      razorpay_product_id: string | null;
      validation_status: string;
      activated_at: Date | null;
    }>(
      `SELECT razorpay_linked_account_id, razorpay_product_id, validation_status, activated_at
       FROM payment_recipient_config
       WHERE phone = $1 AND role = $2`,
      [phone, role],
    );
    const row = result.rows[0];
    if (!row) {
      console.log(`[${phone}/${role}] no row — skip`);
      continue;
    }
    if (!row.razorpay_linked_account_id || !row.razorpay_product_id) {
      console.log(`[${phone}/${role}] missing linked account or product id — skip`, row);
      continue;
    }

    console.log(`[${phone}/${role}] before:`, {
      validation_status: row.validation_status,
      activated_at: row.activated_at,
      accountId: row.razorpay_linked_account_id,
      productId: row.razorpay_product_id,
    });

    const synced = await syncRecipientValidationFromRazorpay({
      linkedAccountId: row.razorpay_linked_account_id,
      productId: row.razorpay_product_id,
      currentValidationStatus: row.validation_status,
    });

    const after = await getPool().query(
      `SELECT validation_status, activated_at, updated_at
       FROM payment_recipient_config
       WHERE phone = $1 AND role = $2`,
      [phone, role],
    );

    console.log(`[${phone}/${role}] razorpay activation:`, synced.activationStatus);
    console.log(`[${phone}/${role}] mapped validation:`, synced.validationStatus);
    console.log(`[${phone}/${role}] row changed:`, synced.synced);
    console.log(`[${phone}/${role}] after:`, after.rows[0]);
  }

  await getPool().end();
}

main().catch((err) => {
  console.error("sync-recipient-validation-status failed:", err);
  process.exit(1);
});
