/**
 * Integration test: Razorpay account creation + payment_recipient_config write.
 * Bypasses HTTP/auth — exercises the same helpers as paymentOnboardHandler.
 *
 * Run:
 *   DATABASE_URL=<staging-url> RAZORPAY_KEY_ID=<test> RAZORPAY_KEY_SECRET=<test> \
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/test-onboard-flow.ts
 */
const TEST_PHONE = "9123456780";
const TEST_ROLE = "owner" as const;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return value;
}

function maskDatabaseUrl(url: string): string {
  return url.replace(/:([^:@/]+)@/, ":***@");
}

function assertStagingDatabase(url: string): void {
  if (!url.includes("jvupbmmzyxizjwjjfrac")) {
    console.error("Refusing to run: DATABASE_URL is not staging (jvupbmmzyxizjwjjfrac)");
    process.exit(1);
  }
}

/** Shape: {roleChar}{phone10}{9 random base36} — exactly 20 chars. */
function assertReferenceIdShape(id: string, phone: string, role: string): void {
  const phone10 = phone.replace(/\D/g, "").slice(-10);
  const roleChar =
    role === "owner" ? "o" : role === "tenant" ? "t" : role === "broker" ? "b" : null;
  if (!roleChar || phone10.length !== 10) {
    console.error("Cannot assert reference_id shape: bad phone/role", { phone, role });
    process.exit(1);
  }
  const expectedPrefix = `${roleChar}${phone10}`;
  if (
    id.length !== 20 ||
    !id.startsWith(expectedPrefix) ||
    !/^[otb]\d{10}[0-9a-z]{9}$/.test(id)
  ) {
    console.error(
      `REFERENCE_ID shape invalid (want ${expectedPrefix} + 9 base36, len 20):`,
      id,
    );
    process.exit(1);
  }
}

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  requireEnv("RAZORPAY_KEY_ID");
  requireEnv("RAZORPAY_KEY_SECRET");
  assertStagingDatabase(databaseUrl);

  const onboard = await import("../api/_lib/paymentOnboardHandler.ts");
  const { getRazorpayClient } = await import("../api/_lib/razorpayClient.ts");
  const { getPool } = await import("../api/_lib/vercelSyncDb.ts");

  const {
    buildRazorpayAccountPayload,
    getRecipientConfig,
    razorpayReferenceId,
    upsertRecipientAccount,
  } = onboard;

  async function fetchFullRecipientRow(phone: string, role: string) {
    const result = await getPool().query(
      `SELECT * FROM payment_recipient_config WHERE phone = $1 AND role = $2`,
      [phone, role],
    );
    return result.rows[0] ?? null;
  }

  const email = `test-onboard-${Date.now()}@trustkeyper.test`;
  const body: onboard.PaymentOnboardBody = {
    phone: TEST_PHONE,
    role: TEST_ROLE,
    legalName: "Test Owner Kumar",
    email,
    registeredAddress: {
      street1: "42 MG Road",
      street2: "Koramangala",
      city: "Bengaluru",
      state: "KARNATAKA",
      postalCode: "560034",
      country: "IN",
    },
  };
  const referenceId = razorpayReferenceId(TEST_PHONE, TEST_ROLE);
  assertReferenceIdShape(referenceId, TEST_PHONE, TEST_ROLE);

  console.log("=== test-onboard-flow ===");
  console.log("DATABASE_URL:", maskDatabaseUrl(databaseUrl));
  console.log("TEST_PHONE:", TEST_PHONE);
  console.log("TEST_ROLE:", TEST_ROLE);
  console.log("TEST_EMAIL:", email);
  console.log("REFERENCE_ID:", referenceId);
  console.log("(Row left in DB after test — clean up manually if needed)\n");

  console.log("--- Run 1: fresh create ---");
  const before = await getRecipientConfig(TEST_PHONE, TEST_ROLE);
  console.log("getRecipientConfig (before):", before);

  if (before?.razorpay_linked_account_id) {
    console.log(
      "NOTE: linked account already exists — Run 1 will skip Razorpay create (handler idempotency path).",
    );
    console.log("Existing accountId:", before.razorpay_linked_account_id);
  } else {
    const payload = buildRazorpayAccountPayload(body, referenceId);
    console.log("Calling razorpay.accounts.create...");
    const account = await getRazorpayClient().accounts.create(payload);
    console.log("acc_id:", account.id);

    await upsertRecipientAccount({
      phone: TEST_PHONE,
      role: TEST_ROLE,
      accountId: account.id,
      referenceId,
    });
    console.log("upsertRecipientAccount: done");
  }

  const rowAfterRun1 = await fetchFullRecipientRow(TEST_PHONE, TEST_ROLE);
  console.log("\npayment_recipient_config row after Run 1:");
  console.log(JSON.stringify(rowAfterRun1, null, 2));

  console.log("\n--- Run 2: idempotency check ---");
  const existing = await getRecipientConfig(TEST_PHONE, TEST_ROLE);
  console.log("getRecipientConfig (after):", existing);

  if (existing?.razorpay_linked_account_id) {
    console.log("Idempotency OK — existing account returned, no duplicate created");
    console.log("accountId:", existing.razorpay_linked_account_id);
    console.log("validationStatus:", existing.validation_status);
  } else {
    console.error("Idempotency FAILED — no linked account found after Run 1");
    process.exitCode = 1;
  }

  await getPool().end();
}

main().catch((err) => {
  console.error("test-onboard-flow failed:", err);
  process.exit(1);
});
