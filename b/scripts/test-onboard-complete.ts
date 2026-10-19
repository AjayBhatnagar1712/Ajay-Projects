/**
 * Integration test: onboarding steps 2-4 (stakeholder, product, bank/TnC).
 * Bypasses HTTP/auth — calls executePaymentOnboardComplete from paymentOnboardHandler.
 *
 * Run:
 *   DATABASE_URL=<staging-url> RAZORPAY_KEY_ID=<test> RAZORPAY_KEY_SECRET=<test> \
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/test-onboard-complete.ts
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

function buildCompleteBody(stakeholderEmail: string) {
  return {
    phone: TEST_PHONE,
    role: TEST_ROLE,
    stakeholderName: "Test Owner Kumar",
    stakeholderEmail,
    pan: "ABCPK1234D",
    residentialAddress: {
      street: "42 MG Road, Koramangala",
      city: "Bengaluru",
      state: "KARNATAKA",
      postalCode: "560034",
      country: "IN",
    },
    bankAccountNumber: "1234567890",
    bankIfsc: "HDFC0000001",
    bankBeneficiaryName: "Test Owner Kumar",
    tncAccepted: true as const,
  };
}

async function ensureLinkedAccount(
  onboard: typeof import("../api/_lib/paymentOnboardHandler.ts"),
  getRazorpayClient: typeof import("../api/_lib/razorpayClient.ts").getRazorpayClient,
): Promise<void> {
  const { buildRazorpayAccountPayload, getRecipientConfig, razorpayReferenceId, upsertRecipientAccount } =
    onboard;

  const existing = await getRecipientConfig(TEST_PHONE, TEST_ROLE);
  if (existing?.razorpay_linked_account_id) {
    console.log("Step 1 precondition OK — linked account exists:", existing.razorpay_linked_account_id);
    return;
  }

  console.log("No linked account — running increment 1 create first...");
  const email = `test-onboard-${Date.now()}@trustkeyper.test`;
  const referenceId = razorpayReferenceId(TEST_PHONE, TEST_ROLE);
  assertReferenceIdShape(referenceId, TEST_PHONE, TEST_ROLE);
  const payload = buildRazorpayAccountPayload(
    {
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
    },
    referenceId,
  );
  const account = await getRazorpayClient().accounts.create(payload);
  await upsertRecipientAccount({
    phone: TEST_PHONE,
    role: TEST_ROLE,
    accountId: account.id,
    referenceId,
  });
  console.log("Increment 1 create done — acc_id:", account.id);
}

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  requireEnv("RAZORPAY_KEY_ID");
  requireEnv("RAZORPAY_KEY_SECRET");
  assertStagingDatabase(databaseUrl);

  const onboard = await import("../api/_lib/paymentOnboardHandler.ts");
  const { getRazorpayClient } = await import("../api/_lib/razorpayClient.ts");
  const { getPool } = await import("../api/_lib/vercelSyncDb.ts");
  const { executePaymentOnboardComplete } = onboard;

  async function fetchConfigRow() {
    const result = await getPool().query(
      `SELECT * FROM payment_recipient_config WHERE phone = $1 AND role = $2`,
      [TEST_PHONE, TEST_ROLE],
    );
    return result.rows[0] ?? null;
  }

  async function fetchKycRow() {
    const result = await getPool().query(
      `SELECT * FROM payment_recipient_kyc WHERE phone = $1 AND role = $2`,
      [TEST_PHONE, TEST_ROLE],
    );
    return result.rows[0] ?? null;
  }

  console.log("=== test-onboard-complete ===");
  console.log("DATABASE_URL:", maskDatabaseUrl(databaseUrl));
  console.log("TEST_PHONE:", TEST_PHONE);
  console.log("TEST_ROLE:", TEST_ROLE);
  console.log("(Rows left in DB — clean up manually if needed)\n");

  await ensureLinkedAccount(onboard, getRazorpayClient);

  const stakeholderEmail = `test-complete-${Date.now()}@trustkeyper.test`;
  const completeBody = buildCompleteBody(stakeholderEmail);

  console.log("\n--- Test A: full happy path (steps 2-4) ---");
  const resultA = await executePaymentOnboardComplete(completeBody);
  console.log("executePaymentOnboardComplete result:", JSON.stringify(resultA, null, 2));

  if (!resultA.ok) {
    console.error("Test A FAILED");
    process.exitCode = 1;
    await getPool().end();
    return;
  }

  console.log("\npayment_recipient_config after Test A:");
  console.log(JSON.stringify(await fetchConfigRow(), null, 2));
  console.log("\npayment_recipient_kyc after Test A:");
  console.log(JSON.stringify(await fetchKycRow(), null, 2));

  const stakeholderIdAfterA = resultA.stakeholderId;
  const productIdAfterA = resultA.productId;

  console.log("\n--- Test B: resumability (repeat same call) ---");
  const resultB = await executePaymentOnboardComplete(completeBody);
  console.log("executePaymentOnboardComplete result:", JSON.stringify(resultB, null, 2));

  if (!resultB.ok) {
    console.error("Test B FAILED — second call errored");
    process.exitCode = 1;
    await getPool().end();
    return;
  }

  const stepsSkipped =
    resultB.stepsRun.stakeholder === false &&
    resultB.stepsRun.product === false &&
    resultB.stepsRun.bank === true;
  const idsUnchanged =
    resultB.stakeholderId === stakeholderIdAfterA && resultB.productId === productIdAfterA;

  if (stepsSkipped && idsUnchanged) {
    console.log("Resumability OK — steps 2 and 3 skipped, IDs unchanged");
    console.log("stakeholderId:", resultB.stakeholderId);
    console.log("productId:", resultB.productId);
  } else {
    console.error("Test B FAILED — expected steps 2/3 skipped with unchanged IDs");
    console.error({ stepsRun: resultB.stepsRun, stakeholderIdAfterA, productIdAfterA });
    process.exitCode = 1;
  }

  await getPool().end();
}

main().catch((err) => {
  console.error("test-onboard-complete failed:", err);
  process.exit(1);
});
